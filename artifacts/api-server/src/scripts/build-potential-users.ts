// Builds the import-ready JSON from the raw pasted list.
//   pnpm --filter @workspace/api-server run build:users -- ../../data/dataForUsers.raw.txt ../../data/dataForUsers.json
// Both files are git-ignored (personal data).
import { readFile, writeFile } from "node:fs/promises";
import { convertPotentialUsers } from "../lib/potential-users";

async function main() {
  const [input, output] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!input || !output) {
    console.error("Usage: build:users -- <raw-input.txt> <output.json>");
    process.exit(1);
  }
  const { rowsFound, users, needsReview } = convertPotentialUsers(await readFile(input, "utf8"));
  const schools = new Set(users.map((user) => user.school_key).filter(Boolean));

  const document = {
    schema_version: 1,
    product: "5prompt",
    dataset: "potential_users",
    generated_at: new Date().toISOString(),
    source: "Pasted lists (tab-separated rows and markdown tables): name | email | school",
    import_policy: {
      key: "email (lower-cased, unique)",
      preserve_existing_users: true,
      create_auth_accounts: false,
      send_emails: false,
      generate_passwords: false,
      link_on_signup: "When this person signs up with the same verified email, their record is linked automatically.",
    },
    summary: {
      rows_found: rowsFound,
      ready_to_import: users.length,
      needs_review: needsReview.length,
      schools: schools.size,
    },
    users,
    needs_review: needsReview,
  };

  await writeFile(output, JSON.stringify(document, null, 2) + "\n", "utf8");
  console.log(`Rows found: ${rowsFound}`);
  console.log(`Ready to import: ${users.length}`);
  console.log(`Needs review: ${needsReview.length}`);
  for (const item of needsReview) console.log(`  line ${item.source_line}: ${item.issue}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
