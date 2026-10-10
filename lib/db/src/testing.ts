// Test-only helper: a real Postgres engine (PGlite) running in-process, with the
// same migrations production uses. Tests exercise real SQL without a server.
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Database } from "./progress-store";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export async function createTestDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Database, close: () => client.close() };
}
