import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export * from "./schema";
export * from "./progress-store";
export * from "./import-store";

let cachedDb: ReturnType<typeof createDb> | null = null;

function createDb(connectionString: string) {
  // Serverless functions (Vercel) start many small instances, so keep each
  // instance's pool small. Use the provider's *pooled* connection string.
  const pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
  return drizzle(pool, { schema });
}

/**
 * Returns the shared database client, created on first use.
 * Lazy so that importing this package (e.g. in tests) does not require DATABASE_URL.
 */
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }
  cachedDb ??= createDb(process.env.DATABASE_URL);
  return cachedDb;
}
