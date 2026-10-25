import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// One row per learner. Identity (passwords, OAuth) lives in Clerk; this table only
// links a Clerk user to their learning data.
//
// Why both clerk_user_id and email? Clerk user IDs differ between Clerk instances.
// When we move from the development instance to a production instance, every user
// gets a new Clerk ID. Matching on a verified email lets a returning user be linked
// back to their existing row (and progress) on first sign-in. See ensureAppUser().
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique(),
  // Stored lower-cased. Nullable because some sign-in methods have no email.
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Chosen during onboarding (one of PROFILE_ROLES). Null = onboarding not finished.
  role: text("role"),
  // School or organisation, when known (e.g. from the potential-users list).
  school: text("school"),
  // "signup" = created on first sign-in, "replit_import" = imported from the old app,
  // "potential_user" = pre-registered from an outreach list (not signed up yet).
  source: text("source").notNull().default("signup"),
  // The user's ID in the old system (e.g. the development Clerk ID), for traceability.
  legacyUserId: text("legacy_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per evaluated practice attempt. Progress, the next task, the streak and
// the checkpoint are all computed from these rows.
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    concept: text("concept").notNull(),
    // Null only for progress imported without a score.
    score: integer("score"),
    flaws: jsonb("flaws").$type<string[]>().notNull().default([]),
    // "evaluation" = scored by the coach, "import" = migrated from the old app.
    source: text("source").notNull().default("evaluation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("attempts_user_created_idx").on(table.userId, table.createdAt)],
);

export type AppUser = typeof appUsers.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
