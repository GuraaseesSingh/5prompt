import { describe, expect, it } from "vitest";
import { cleanEmail, cleanName, cleanSchool, convertPotentialUsers } from "./potential-users";

// Fake sample data only — real user lists are git-ignored and never used in tests.
const SAMPLE = [
  "Some instruction text that is not a row",
  "",
  "asha verma \tAsha.Verma@Example.com\tsample academy north ",
  "Ravi Kumar\tbroken@ex\tSample Academy North",
  "No Email Person\t\tSample Academy South",
  "dup.user@example.com \tdup.user@example.com \tSample Academy South",
  "",
  "| Ms. Neha Singh  | neha\\@example.org            | Sample School, Sector- 28-B, City |",
  "| --------------- | ---------------------------- | --------------------------------- |",
  "| Mr. Arun Das    | [arun@example.org](mailto\\:arun@example.org) | Sample School, Sector- 28B City |",
  "| Dr. Lee Wong    | lee\\@example. org             | Sample School Sector 28B City<br> |",
  "| Copy Person     | ASHA.VERMA@example.com       | Elsewhere |",
  "{",
  '  "users": [{ "email": "ignored@example.com" }]',
].join("\n");

describe("cleaners", () => {
  it("removes markdown escapes, mailto links and stray spaces from emails", () => {
    expect(cleanEmail("neha\\@example.org")).toBe("neha@example.org");
    expect(cleanEmail("[a@b.org](mailto\\:a@b.org)")).toBe("a@b.org");
    expect(cleanEmail(" X@Gmail. com ")).toBe("x@gmail.com");
  });

  it("splits titles from names and capitalises all-lowercase words only", () => {
    expect(cleanName("Ms. neha Singh")).toEqual({ title: "Ms.", full: "Neha Singh" });
    expect(cleanName("someone@example.com")).toEqual({ title: null, full: null });
    expect(cleanName("Janaki.V")).toEqual({ title: null, full: "Janaki.V" });
  });

  it("fixes known school typos and spacing", () => {
    expect(cleanSchool("akal accedmy  bharana ")).toBe("Akal Academy Bharana");
    expect(cleanSchool("Akal Aacdemy Killi")).toBe("Akal Academy Killi");
    expect(cleanSchool(" Akal Academy,Teja singh wala")).toBe("Akal Academy Teja Singh Wala");
    expect(cleanSchool("Jand Sahib(Ropar)")).toBe("Jand Sahib (Ropar)");
    expect(cleanSchool("Ramagy School Noida")).toBe("Ramagya School Noida");
  });
});

describe("convertPotentialUsers", () => {
  const result = convertPotentialUsers(SAMPLE);

  it("reads tab rows and markdown table rows, and ignores an old JSON block", () => {
    expect(result.rowsFound).toBe(8);
    expect(result.users.map((u) => u.email)).toEqual([
      "asha.verma@example.com",
      "dup.user@example.com",
      "neha@example.org",
      "arun@example.org",
      "lee@example.org",
    ]);
  });

  it("never guesses broken emails; lists every skipped row with a reason", () => {
    expect(result.needsReview.map((r) => [r.source_line, r.issue])).toEqual([
      [4, "invalid email (not guessed)"],
      [5, "missing email"],
      [6, "name missing (email was in the name column); imported without a name"],
      [12, "duplicate email (same as line 3)"],
    ]);
  });

  it("shows one spelling for variants of the same school", () => {
    const schools = result.users.filter((u) => u.email.endsWith("example.org")).map((u) => u.school);
    expect(new Set(schools).size).toBe(1);
  });

  it("produces import-ready fields", () => {
    expect(result.users[0]).toMatchObject({
      first_name: "Asha",
      last_name: "Verma",
      school: "Sample Academy North",
      status: "potential_user",
      onboarding_status: "not_invited",
    });
    expect(result.users[2]).toMatchObject({ title: "Ms.", first_name: "Neha", last_name: "Singh" });
  });
});
