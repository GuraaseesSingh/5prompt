import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { appUsers, attempts, importUsers, type Database } from "@workspace/db";
import { createTestDatabase } from "@workspace/db/testing";
import { parseCsv, validateImport } from "./import-users";
import { findTask } from "./tasks";

const conceptOf = (taskId: string) => findTask(taskId)!.conceptFocus;
const exampleCsv = () => readFile(new URL("../../../../data/import/replit-users.example.csv", import.meta.url), "utf8");
const exampleJson = () => readFile(new URL("../../../../data/import/potential-users.example.json", import.meta.url), "utf8");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
});

describe("validateImport", () => {
  it("accepts the committed example template", async () => {
    const { users, problems } = validateImport(await exampleCsv());
    expect(problems).toEqual([]);
    expect(users.map((u) => u.email)).toEqual(["asha.student@example.com", "rohan.k@example.com", "ms.teacher@example.org"]);
    expect(users[2].lastName).toBe("Iyer, PhD");
    expect(users[0].completedTaskIds).toEqual(["role-01", "role-02"]);
  });

  it("reports bad rows by row number without echoing personal data", () => {
    const csv = "email,first_name,last_name,created_at,legacy_user_id,completed_task_ids\nnot-an-email,A,,,,\nb@x.org,B,,,,nope-99\nB@X.org,B2,,,,";
    const { users, problems } = validateImport(csv);
    expect(users).toHaveLength(1);
    expect(problems).toEqual([
      "Row 2: missing or invalid email — skipped.",
      'Row 3: unknown task id "nope-99" — ignored.',
      "Row 4: duplicate email (already in an earlier row) — skipped.",
    ]);
  });

  it("rejects a file with the wrong header", () => {
    expect(validateImport("mail,name\na@b.co,A").problems[0]).toContain("Missing column(s): email");
  });
});

describe("validateImport with the potential-users JSON", () => {
  it("accepts the committed example JSON and keeps the school", async () => {
    const { users, problems, source } = validateImport(await exampleJson());
    expect(problems).toEqual([]);
    expect(source).toBe("potential_user");
    expect(users.map((u) => [u.email, u.school])).toEqual([
      ["asha.teacher@example.com", "Sample Public School, City"],
      ["ravi.k@example.org", "Example Academy North"],
    ]);
  });

  it("explains invalid JSON instead of crashing", () => {
    expect(validateImport("{ not json").problems[0]).toContain("The JSON is not valid");
    expect(validateImport('{"people": []}').problems).toEqual(['The JSON must contain a "users" array.']);
  });
});

describe("importUsers", () => {
  let db: Database;
  let close: () => Promise<void>;
  beforeAll(async () => ({ db, close } = await createTestDatabase()));
  afterAll(() => close());
  beforeEach(async () => {
    await db.delete(attempts);
    await db.delete(appUsers);
  });

  it("dry run reports counts but writes nothing", async () => {
    const { users } = validateImport(await exampleCsv());
    const summary = await importUsers(db, users, { apply: false, conceptOf });
    expect(summary).toEqual({ usersCreated: 3, usersAlreadyPresent: 0, attemptsCreated: 3, applied: false });
    expect(await db.select().from(appUsers)).toHaveLength(0);
  });

  it("apply writes users and imported completions, and re-running adds nothing", async () => {
    const { users } = validateImport(await exampleCsv());
    await importUsers(db, users, { apply: true, conceptOf });
    const again = await importUsers(db, users, { apply: true, conceptOf });
    expect(again).toEqual({ usersCreated: 0, usersAlreadyPresent: 3, attemptsCreated: 0, applied: true });
    expect(await db.select().from(appUsers)).toHaveLength(3);
    expect(await db.select().from(attempts)).toHaveLength(3);
  });

  it("stores potential users with their school and source", async () => {
    const { users, source } = validateImport(await exampleJson());
    await importUsers(db, users, { apply: true, conceptOf, source });
    const rows = await db.select().from(appUsers);
    expect(rows.map((r) => [r.email, r.school, r.source, r.clerkUserId])).toEqual([
      ["asha.teacher@example.com", "Sample Public School, City", "potential_user", null],
      ["ravi.k@example.org", "Example Academy North", "potential_user", null],
    ]);
  });

  it("never overwrites an existing user", async () => {
    await db.insert(appUsers).values({ email: "rohan.k@example.com", firstName: "Existing", clerkUserId: "user_live_1" });
    const { users } = validateImport(await exampleCsv());
    await importUsers(db, users, { apply: true, conceptOf });
    const [rohan] = (await db.select().from(appUsers)).filter((u) => u.email === "rohan.k@example.com");
    expect(rohan.firstName).toBe("Existing");
    expect(rohan.clerkUserId).toBe("user_live_1");
  });
});
