// Converts pasted lists of potential users (tab-separated rows and/or markdown
// tables: name | email | school) into clean, import-ready records.
// Rules: never guess a broken email; keep the raw values for traceability;
// put anything doubtful in `needsReview` instead of the import list.

export type PotentialUser = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  school: string | null;
  /** Punctuation/case-insensitive key; spelling variants of one school share it. */
  school_key: string | null;
  school_raw: string | null;
  role: "unknown";
  status: "potential_user";
  onboarding_status: "not_invited";
  source_line: number;
};

export type ReviewItem = {
  source_line: number;
  full_name: string | null;
  email_raw: string;
  school: string | null;
  issue: string;
};

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const TITLE = /^(ms|mrs|mr|dr)\.?\s+/i;

function collapse(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

/** Capitalise words typed fully in lower case ("akal academy" → "Akal Academy"); leave others alone. */
function capitaliseLowercaseWords(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z']*/g, (word) =>
    word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word,
  );
}

export function cleanEmail(raw: string): string {
  let value = raw.replace(/\\/g, "");
  const link = value.match(/\[([^\]]+)\]\(mailto:[^)]*\)/i);
  if (link) value = link[1];
  return value.replace(/\s+/g, "").toLowerCase();
}

export function cleanSchool(raw: string): string | null {
  let value = collapse(raw).replace(/\s*,\s*/g, ", ");
  if (!value) return null;
  value = value
    .replace(/\bakal\s+(?:a(?:cc|ac)edmy|aacdemy)\b/gi, "Akal Academy") // typos seen in the data
    .replace(/\bakal\s+academy\b,?/gi, "Akal Academy")
    .replace(/(\S)\(/g, "$1 (") // "Jand Sahib(Ropar)" → "Jand Sahib (Ropar)"
    .replace(/\bramagy\s+school\b/gi, "Ramagya School")
    .replace(/\bramagya\s+school\b/gi, "Ramagya School")
    .replace(/\bpubic\b/gi, "Public");
  return capitaliseLowercaseWords(value);
}

export function cleanName(raw: string): { title: string | null; full: string | null } {
  let value = collapse(raw);
  const title = value.match(TITLE);
  if (title) value = value.slice(title[0].length);
  if (!value || value.includes("@")) return { title: title ? normaliseTitle(title[1]) : null, full: null };
  return { title: title ? normaliseTitle(title[1]) : null, full: capitaliseLowercaseWords(value) };
}

export function schoolKey(school: string | null): string | null {
  const key = school?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return key ? key : null;
}

function normaliseTitle(title: string): string {
  const lower = title.toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1) + ".";
}

/** Extracts [line, name, email, school] rows from the pasted text. */
export function extractRows(text: string): { line: number; cells: [string, string, string] }[] {
  const rows: { line: number; cells: [string, string, string] }[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trimStart().startsWith("{")) break; // an old partial JSON block follows; ignore it
    if (line.trimStart().startsWith("|")) {
      const cells = line.split("|").slice(1, -1);
      if (cells.length >= 3 && !/^\s*-{3,}\s*$/.test(cells[0])) {
        rows.push({ line: i + 1, cells: [cells[0], cells[1], cells[2]] });
      }
    } else if (line.includes("\t")) {
      const cells = line.split("\t");
      rows.push({ line: i + 1, cells: [cells[0] ?? "", cells[1] ?? "", cells[2] ?? ""] });
    }
  }
  return rows;
}

export function convertPotentialUsers(text: string) {
  const users: PotentialUser[] = [];
  const needsReview: ReviewItem[] = [];
  const seen = new Map<string, number>();
  const rows = extractRows(text);

  for (const { line, cells } of rows) {
    const [nameRaw, emailRaw, schoolRaw] = cells;
    const { title, full } = cleanName(nameRaw);
    const email = cleanEmail(emailRaw);
    const school = cleanSchool(schoolRaw);
    const review = (issue: string) =>
      needsReview.push({ source_line: line, full_name: full, email_raw: collapse(emailRaw), school, issue });

    if (!email) {
      review("missing email");
      continue;
    }
    if (!EMAIL.test(email)) {
      review("invalid email (not guessed)");
      continue;
    }
    if (seen.has(email)) {
      review(`duplicate email (same as line ${seen.get(email)})`);
      continue;
    }
    seen.set(email, line);
    if (!full) {
      review("name missing (email was in the name column); imported without a name");
    }

    const [first, ...rest] = (full ?? "").split(" ");
    users.push({
      email,
      first_name: first || null,
      last_name: rest.length ? rest.join(" ") : null,
      full_name: full,
      title,
      school,
      school_key: schoolKey(school),
      school_raw: collapse(schoolRaw) || null,
      role: "unknown",
      status: "potential_user",
      onboarding_status: "not_invited",
      source_line: line,
    });
  }

  // Show one spelling per school: the most common variant among rows sharing a key.
  const variants = new Map<string, Map<string, number>>();
  for (const user of users) {
    if (!user.school_key || !user.school) continue;
    const counts = variants.get(user.school_key) ?? new Map<string, number>();
    counts.set(user.school, (counts.get(user.school) ?? 0) + 1);
    variants.set(user.school_key, counts);
  }
  for (const user of users) {
    const counts = user.school_key ? variants.get(user.school_key) : undefined;
    if (counts) user.school = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  }

  return { rowsFound: rows.length, users, needsReview };
}
