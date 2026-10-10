import { and, eq } from "drizzle-orm";
import type { Database } from "./progress-store";
import { appUsers, attempts } from "./schema";

/** One validated row from the Replit export (see artifacts/api-server/src/lib/import-users.ts). */
export type ImportUser = {
  row: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  school: string | null;
  createdAt: Date | null;
  legacyUserId: string | null;
  completedTaskIds: string[];
};

export type ImportSummary = {
  usersCreated: number;
  usersAlreadyPresent: number;
  attemptsCreated: number;
  applied: boolean;
};

/**
 * Writes imported users (and optional completed tasks) in ONE transaction.
 * - Never overwrites: an existing email is left unchanged.
 * - Idempotent: re-running adds no duplicate users or task completions.
 * - Dry run (apply: false) runs the exact same statements, then rolls back.
 */
export async function importUsers(
  db: Database,
  users: ImportUser[],
  options: { apply: boolean; conceptOf: (taskId: string) => string; source?: string },
): Promise<ImportSummary> {
  const summary: ImportSummary = { usersCreated: 0, usersAlreadyPresent: 0, attemptsCreated: 0, applied: options.apply };
  const ROLLBACK = new Error("dry-run rollback");

  try {
    await db.transaction(async (tx) => {
      for (const user of users) {
        const inserted = await tx
          .insert(appUsers)
          .values({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            school: user.school,
            source: options.source ?? "replit_import",
            legacyUserId: user.legacyUserId,
            ...(user.createdAt ? { createdAt: user.createdAt } : {}),
          })
          .onConflictDoNothing({ target: appUsers.email })
          .returning({ id: appUsers.id });
        if (inserted.length) summary.usersCreated += 1;
        else summary.usersAlreadyPresent += 1;

        if (!user.completedTaskIds.length) continue;
        const [row] = await tx.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, user.email)).limit(1);
        for (const taskId of user.completedTaskIds) {
          const [existing] = await tx
            .select({ id: attempts.id })
            .from(attempts)
            .where(and(eq(attempts.userId, row.id), eq(attempts.taskId, taskId)))
            .limit(1);
          if (existing) continue;
          await tx.insert(attempts).values({ userId: row.id, taskId, concept: options.conceptOf(taskId), score: null, source: "import" });
          summary.attemptsCreated += 1;
        }
      }
      if (!options.apply) throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  return summary;
}
