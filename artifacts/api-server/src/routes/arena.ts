import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import {
  EvaluatePromptBody,
  EvaluatePromptResponse,
  GetCheckpointResponse,
  GetProgressResponse,
  GetTaskResponse,
  ListTasksResponse,
  type Evaluation,
} from "@workspace/api-zod";
import {
  countAttemptsSince,
  ensureAppUser,
  getDb,
  listAttempts,
  recordAttempt,
  type AppUser,
  type ClerkProfile,
  type Database,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { CoachBusyError, evaluatePrompt } from "../lib/evaluation";
import { buildCheckpoint, buildProgress, guestTask, nextTaskFor } from "../lib/progress";
import { findTask, tasks } from "../lib/tasks";

export const GUEST_ATTEMPT_LIMIT = 2;
export const GUEST_ATTEMPTS_COOKIE = "prompt_arena_free_attempts";

/** Everything the routes need from the outside world. Tests swap in fakes. */
export type ArenaDeps = {
  db: () => Database;
  /** Clerk user ID of the signed-in caller, or null for a guest. */
  getUserId: (req: Request) => string | null;
  loadClerkProfile: (clerkUserId: string) => Promise<ClerkProfile>;
  evaluate: typeof evaluatePrompt;
  now: () => Date;
  /** Calendar used for the day streak. */
  timeZone: string;
  /** Max evaluations per signed-in user in any rolling 24 hours (protects the shared Groq quota). */
  dailyLimit: number;
};

async function loadClerkProfileFromClerk(clerkUserId: string): Promise<ClerkProfile> {
  const user = await clerkClient.users.getUser(clerkUserId);
  const primary = user.primaryEmailAddress;
  return {
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === "verified",
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export const defaultArenaDeps: ArenaDeps = {
  db: getDb,
  getUserId: (req) => getAuth(req)?.userId ?? null,
  loadClerkProfile: loadClerkProfileFromClerk,
  evaluate: evaluatePrompt,
  now: () => new Date(),
  timeZone: process.env.APP_TIMEZONE || "UTC",
  dailyLimit: Number(process.env.EVALUATIONS_PER_USER_PER_DAY) || 40,
};

function guestAttemptsUsed(req: Request): number {
  const value = Number(req.cookies?.[GUEST_ATTEMPTS_COOKIE] ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function createArenaRouter(deps: ArenaDeps = defaultArenaDeps): IRouter {
  const router: IRouter = Router();

  // Resolves the signed-in caller's app user, or null for guests.
  async function currentUser(req: Request): Promise<AppUser | null> {
    const clerkUserId = deps.getUserId(req);
    if (!clerkUserId) return null;
    return ensureAppUser(deps.db(), clerkUserId, () => deps.loadClerkProfile(clerkUserId));
  }

  async function requireUser(req: Request, res: Response): Promise<AppUser | null> {
    const user = await currentUser(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in to continue your practice." });
    }
    return user;
  }

  router.get("/tasks", (_req, res): void => {
    res.json(ListTasksResponse.parse(tasks));
  });

  // The caller's own next task: from their history if signed in, from the
  // free-attempt cookie if a guest. Never from a shared counter.
  router.get("/task", async (req, res): Promise<void> => {
    const user = await currentUser(req);
    const task = user ? nextTaskFor(await listAttempts(deps.db(), user.id)) : guestTask(guestAttemptsUsed(req));
    res.set("Cache-Control", "no-store");
    res.json(GetTaskResponse.parse(task));
  });

  router.post("/evaluate", async (req, res): Promise<void> => {
    const parsed = EvaluatePromptBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please write between 10 and 1500 characters before submitting." });
      return;
    }

    // Grading against a different task than the one on screen would produce
    // feedback that does not match the brief, so reject unknown task IDs.
    const task = findTask(parsed.data.taskId);
    if (!task) {
      res.status(404).json({ error: "That practice task no longer exists. Please reload the page." });
      return;
    }

    // Identify the caller BEFORE spending a Groq call.
    const user = await currentUser(req);
    const freeAttempts = guestAttemptsUsed(req);
    if (!user && freeAttempts >= GUEST_ATTEMPT_LIMIT) {
      res.status(401).json({ error: "Your two free reps are complete. Sign in to keep practicing." });
      return;
    }
    if (user) {
      const since = new Date(deps.now().getTime() - 24 * 60 * 60 * 1000);
      if ((await countAttemptsSince(deps.db(), user.id, since)) >= deps.dailyLimit) {
        res.status(429).json({ error: `You’ve done ${deps.dailyLimit} reps in the last 24 hours — great work! Take a break and come back tomorrow.` });
        return;
      }
    }

    let feedback: Evaluation;
    try {
      feedback = await deps.evaluate(task, parsed.data.userPrompt);
    } catch (error) {
      if (error instanceof CoachBusyError) {
        logger.warn("Groq rate limit reached on all models");
        res.status(503).json({ error: "Lots of students are practising right now. Please wait a minute and try again." });
        return;
      }
      logger.error({ err: error }, "Groq evaluation failed");
      res.status(502).json({ error: "The prompt coach is temporarily unavailable. Please try again." });
      return;
    }

    if (user) {
      try {
        await recordAttempt(deps.db(), {
          userId: user.id,
          taskId: task.id,
          concept: task.conceptFocus,
          score: feedback.score,
          flaws: feedback.flaws,
        });
      } catch (error) {
        // Be honest rather than show feedback whose progress silently vanished.
        logger.error({ err: error, userId: user.id }, "Failed to save attempt");
        res.status(503).json({ error: "We couldn’t save this attempt. Please submit it again." });
        return;
      }
      // A recognised account no longer needs the guest counter.
      if (req.cookies?.[GUEST_ATTEMPTS_COOKIE] !== undefined) {
        res.clearCookie(GUEST_ATTEMPTS_COOKIE);
      }
    } else {
      res.cookie(GUEST_ATTEMPTS_COOKIE, String(freeAttempts + 1), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
    }
    res.json(EvaluatePromptResponse.parse(feedback));
  });

  router.get("/progress", async (req, res): Promise<void> => {
    const user = await requireUser(req, res);
    if (!user) return;
    const history = await listAttempts(deps.db(), user.id);
    res.set("Cache-Control", "no-store");
    res.json(GetProgressResponse.parse(buildProgress(history, deps.now(), deps.timeZone)));
  });

  router.post("/checkpoint", async (req, res): Promise<void> => {
    const user = await requireUser(req, res);
    if (!user) return;
    const history = await listAttempts(deps.db(), user.id);
    res.json(GetCheckpointResponse.parse(buildCheckpoint(history)));
  });

  // Any unexpected failure (e.g. database unreachable) becomes an honest JSON
  // error instead of Express's default HTML page.
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    logger.error({ err: error }, "Unhandled arena route error");
    res.status(500).json({ error: "Something went wrong on our side. Your progress is safe — please try again." });
  });

  return router;
}

export default createArenaRouter();
