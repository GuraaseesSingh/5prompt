import { and, asc, count, eq, gte } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { appUsers, attempts, type AppUser, type AttemptRow } from "./schema";

// Any Drizzle Postgres client with our schema: node-postgres in production,
// PGlite (in-process Postgres) in tests.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ClerkProfile = {
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Finds the app user for a Clerk user, creating or linking one on first sign-in.
 *
 * 1. Known Clerk ID → return that row (the common, fast path: one SELECT).
 * 2. Otherwise load the Clerk profile. If its email is *verified* and matches an
 *    existing row (e.g. imported from Replit, or created under the old development
 *    Clerk instance), link that row to this Clerk ID so the user keeps their progress.
 * 3. Otherwise insert a new row.
 *
 * Only verified emails are used for linking; otherwise someone could claim another
 * person's progress by signing up with an email they do not own.
 */
export async function ensureAppUser(
  db: Database,
  clerkUserId: string,
  loadProfile: () => Promise<ClerkProfile>,
): Promise<AppUser> {
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.clerkUserId, clerkUserId)).limit(1);
  if (existing) return existing;

  const profile = await loadProfile();
  const email = profile.emailVerified ? normaliseEmail(profile.email) : null;

  if (email) {
    const [linked] = await db
      .update(appUsers)
      .set({ clerkUserId, updatedAt: new Date() })
      .where(eq(appUsers.email, email))
      .returning();
    if (linked) return linked;
  }

  // ON CONFLICT DO NOTHING makes two simultaneous first requests safe: one insert
  // wins, the other is ignored, and both then read the same row.
  await db
    .insert(appUsers)
    .values({ clerkUserId, email, firstName: profile.firstName, lastName: profile.lastName })
    .onConflictDoNothing();

  const [created] = await db.select().from(appUsers).where(eq(appUsers.clerkUserId, clerkUserId)).limit(1);
  if (!created) {
    throw new Error("Could not create or find the app user for this Clerk account.");
  }
  return created;
}

export function normaliseEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export type NewAttempt = {
  userId: string;
  taskId: string;
  concept: string;
  score: number;
  flaws: string[];
};

export async function recordAttempt(db: Database, attempt: NewAttempt): Promise<void> {
  await db.insert(attempts).values(attempt);
}

/** All of a user's attempts, oldest first. */
export async function listAttempts(db: Database, userId: string): Promise<AttemptRow[]> {
  return db.select().from(attempts).where(eq(attempts.userId, userId)).orderBy(asc(attempts.createdAt), asc(attempts.id));
}

export async function countAttemptsSince(db: Database, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.source, "evaluation"), gte(attempts.createdAt, since)));
  return row?.value ?? 0;
}
