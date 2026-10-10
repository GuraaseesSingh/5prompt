// Usage (from the repo root):
//   Dry run (default, writes nothing):
//     pnpm --filter @workspace/api-server run import:users -- ../../data/import/replit-users.csv
//   Apply for real (only after reviewing the dry run and backing up the database):
//     pnpm --filter @workspace/api-server run import:users -- ../../data/import/replit-users.csv --apply
// Also accepts the potential-users JSON: ../../data/dataForUsers.json
// Needs DATABASE_URL (read from the repo-root .env).
import { readFile } from "node:fs/promises";
import { getDb, importUsers } from "@workspace/db";
import { validateImport } from "../lib/import-users";
import { findTask } from "../lib/tasks";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) {
    console.error("Usage: import:users -- <path-to-csv> [--apply]");
    process.exit(1);
  }

  const { users, problems, source } = validateImport(await readFile(file, "utf8"));
  console.log(`Valid rows: ${users.length}`);
  for (const problem of problems) console.log(`  ! ${problem}`);

  const summary = await importUsers(getDb(), users, { apply, source, conceptOf: (taskId) => findTask(taskId)!.conceptFocus });
  console.log(apply ? "APPLIED (committed to the database):" : "DRY RUN (nothing was written):");
  console.log(`  users to create / created: ${summary.usersCreated}`);
  console.log(`  users already present (left unchanged): ${summary.usersAlreadyPresent}`);
  console.log(`  imported task completions: ${summary.attemptsCreated}`);
  if (!apply) console.log("Re-run with --apply to write these changes.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Import failed; nothing was committed.", error instanceof Error ? error.message : error);
  process.exit(1);
});
