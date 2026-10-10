import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Relative paths (resolved from lib/db, where the scripts run): absolute Windows
  // paths break drizzle-kit's file globbing.
  schema: "./src/schema/index.ts",
  // Reviewed, committed SQL migrations. Apply with `pnpm --filter @workspace/db run migrate`.
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
