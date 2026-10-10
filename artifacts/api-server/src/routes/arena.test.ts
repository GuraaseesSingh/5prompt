import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import cookieParser from "cookie-parser";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { appUsers, attempts, type ClerkProfile, type Database } from "@workspace/db";
import { createTestDatabase } from "@workspace/db/testing";
import { CoachBusyError } from "../lib/evaluation";
import { createArenaRouter, GUEST_ATTEMPTS_COOKIE, type ArenaDeps } from "./arena";

// Real routes + real SQL (PGlite, in-process Postgres with the production
// migrations). Only Clerk and Groq are faked. The test picks the signed-in user
// with an "x-test-user" header.

const evaluate = vi.fn<ArenaDeps["evaluate"]>();
const profiles = new Map<string, ClerkProfile>();
let db: Database;
let closeDb: () => Promise<void>;
let server: Server;
let baseUrl: string;

const NOW = new Date("2026-10-10T12:00:00Z");

beforeAll(async () => {
  ({ db, close: closeDb } = await createTestDatabase());
  const deps: ArenaDeps = {
    db: () => db,
    getUserId: (req) => (req.headers["x-test-user"] as string | undefined) ?? null,
    loadClerkProfile: async (id) => profiles.get(id) ?? { email: null, emailVerified: false, firstName: null, lastName: null },
    evaluate,
    now: () => NOW,
    timeZone: "UTC",
    dailyLimit: 3,
  };
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", createArenaRouter(deps));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(async () => {
  server.close();
  await closeDb();
});

beforeEach(async () => {
  await db.delete(attempts);
  await db.delete(appUsers);
  profiles.clear();
  evaluate.mockReset();
  evaluate.mockImplementation(async (task) => ({
    score: 6,
    conceptFocus: task.conceptFocus,
    flaws: ["The role is vague."],
    improvedRewrite: "Act as a biology teacher…",
    encouragement: "You’re on the right track.",
  }));
});

type Options = { user?: string; cookie?: string };
function headers({ user, cookie }: Options = {}): Record<string, string> {
  return { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}), ...(cookie ? { cookie } : {}) };
}
async function getTask(options?: Options) {
  const res = await fetch(`${baseUrl}/task`, { headers: headers(options) });
  return (await res.json()) as { id: string; order: number };
}
function submit(taskId: string, options?: Options) {
  return fetch(`${baseUrl}/evaluate`, {
    method: "POST",
    headers: headers(options),
    body: JSON.stringify({ taskId, userPrompt: "Explain photosynthesis to a 12-year-old." }),
  });
}
async function progress(options?: Options) {
  const res = await fetch(`${baseUrl}/progress`, { headers: headers(options) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("per-user task sequencing (Bug B)", () => {
  it("gives each user their own next task, unaffected by other users", async () => {
    await submit("role-01", { user: "alice" });
    await submit("role-02", { user: "alice" });
    await submit("role-03", { user: "alice" });

    expect((await getTask({ user: "alice" })).id).toBe("role-04");
    expect((await getTask({ user: "bob" })).id).toBe("role-01");
  });

  it("stays consistent when many users submit at the same time", async () => {
    const users = Array.from({ length: 25 }, (_, i) => `user_${i}`);
    await Promise.all(users.map((user) => submit("role-01", { user })));
    const next = await Promise.all(users.map((user) => getTask({ user })));
    expect(new Set(next.map((task) => task.id))).toEqual(new Set(["role-02"]));
  });

  it("does not skip a task when the same task is submitted twice at once", async () => {
    await Promise.all([submit("role-01", { user: "alice" }), submit("role-01", { user: "alice" })]);
    expect((await getTask({ user: "alice" })).id).toBe("role-02");
  });
});

describe("progress persists per user (Bug C)", () => {
  it("survives a new server instance because it lives in the database", async () => {
    await submit("role-01", { user: "alice" });
    await submit("role-02", { user: "alice" });

    // A brand-new router = a cold start / another serverless instance.
    const fresh = express().use(express.json()).use("/api", createArenaRouter({
      db: () => db,
      getUserId: () => "alice",
      loadClerkProfile: async () => ({ email: null, emailVerified: false, firstName: null, lastName: null }),
      evaluate,
      now: () => NOW,
      timeZone: "UTC",
      dailyLimit: 3,
    }));
    const other = fresh.listen(0);
    await new Promise((resolve) => other.once("listening", resolve));
    const res = await fetch(`http://127.0.0.1:${(other.address() as AddressInfo).port}/api/progress`);
    const body = (await res.json()) as { completed: number; scores: number[]; streak: number };
    other.close();

    expect(body.completed).toBe(2);
    expect(body.scores).toEqual([6, 6]);
    expect(body.streak).toBe(1);
  });

  it("keeps users' progress separate", async () => {
    await submit("role-01", { user: "alice" });
    expect((await progress({ user: "alice" })).body.completed).toBe(1);
    expect((await progress({ user: "bob" })).body.completed).toBe(0);
  });

  it("requires sign-in for progress", async () => {
    expect((await progress()).status).toBe(401);
  });
});

describe("guest limit and sign-in (Bug A)", () => {
  it("lets a guest try two tasks, then asks them to sign in", async () => {
    const first = await submit("role-01");
    expect(first.headers.get("set-cookie")).toContain(`${GUEST_ATTEMPTS_COOKIE}=1`);
    expect((await getTask({ cookie: `${GUEST_ATTEMPTS_COOKIE}=1` })).id).toBe("role-02");

    const blocked = await submit("role-03", { cookie: `${GUEST_ATTEMPTS_COOKIE}=2` });
    expect(blocked.status).toBe(401);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("does not apply the guest limit to a signed-in user, and clears the guest cookie", async () => {
    const res = await submit("role-01", { user: "alice", cookie: `${GUEST_ATTEMPTS_COOKIE}=2` });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`${GUEST_ATTEMPTS_COOKIE}=;`));
  });
});

describe("Clerk instance migration (dev → production)", () => {
  it("links a returning user to their existing row by verified email", async () => {
    profiles.set("dev_alice", { email: "Alice@School.org", emailVerified: true, firstName: "Alice", lastName: null });
    await submit("role-01", { user: "dev_alice" });

    // Same person, new production Clerk ID.
    profiles.set("prod_alice", { email: "alice@school.org", emailVerified: true, firstName: "Alice", lastName: null });
    expect((await progress({ user: "prod_alice" })).body.completed).toBe(1);
    expect(await db.select().from(appUsers)).toHaveLength(1);
  });

  it("never links by an unverified email", async () => {
    profiles.set("dev_alice", { email: "alice@school.org", emailVerified: true, firstName: null, lastName: null });
    await submit("role-01", { user: "dev_alice" });

    profiles.set("attacker", { email: "alice@school.org", emailVerified: false, firstName: null, lastName: null });
    expect((await progress({ user: "attacker" })).body.completed).toBe(0);
  });
});

describe("evaluation errors are honest", () => {
  it("rejects prompts shorter than 10 characters", async () => {
    const res = await fetch(`${baseUrl}/evaluate`, { method: "POST", headers: headers(), body: JSON.stringify({ taskId: "role-01", userPrompt: "short" }) });
    expect(res.status).toBe(400);
  });

  it("rejects unknown task IDs instead of grading a different task", async () => {
    expect((await submit("demo-task-1", { user: "alice" })).status).toBe(404);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("returns 502 and saves nothing when the AI call fails", async () => {
    evaluate.mockRejectedValue(new Error("Groq down"));
    const res = await submit("role-01", { user: "alice" });
    expect(res.status).toBe(502);
    expect((await progress({ user: "alice" })).body.completed).toBe(0);
  });

  it("returns 503 'busy' when every model is rate-limited", async () => {
    evaluate.mockRejectedValue(new CoachBusyError());
    const res = await submit("role-01", { user: "alice" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: expect.stringContaining("Lots of students") });
  });

  it("enforces the per-user daily limit before calling the AI", async () => {
    for (const id of ["role-01", "role-02", "role-03"]) await submit(id, { user: "alice" });
    const res = await submit("role-04", { user: "alice" });
    expect(res.status).toBe(429);
    expect(evaluate).toHaveBeenCalledTimes(3);
  });
});
