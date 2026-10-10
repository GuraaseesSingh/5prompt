// Imports learners exported from the old Replit app into app_users (and, optionally,
// their completed tasks into attempts). Safety rules:
// - Dry run by default; nothing is written unless apply is requested.
// - Never overwrites or deletes: existing emails are skipped, not updated.
// - Idempotent: re-running the same file adds nothing new.
// - All writes happen in one transaction: either everything is imported or nothing
//   (see importUsers in lib/db/src/import-store.ts).
// - Reports problems by row number, never by printing personal data.
import { normaliseEmail, type ImportUser } from "@workspace/db";
import { findTask } from "./tasks";

export type { ImportUser };

export const IMPORT_COLUMNS = ["email", "first_name", "last_name", "created_at", "legacy_user_id", "completed_task_ids"] as const;

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RawRecord = { row: number; get: (field: string) => string | null };

export type ValidatedImport = {
  users: ImportUser[];
  problems: string[];
  /** Stored in app_users.source. */
  source: "replit_import" | "potential_user";
};

/** Accepts either the CSV export or the potential-users JSON (data/dataForUsers.json). */
export function validateImport(text: string): ValidatedImport {
  return text.trimStart().startsWith("{") ? validateJson(text) : validateCsv(text);
}

function validateCsv(text: string): ValidatedImport {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { users: [], problems: ["The file is empty."], source: "replit_import" };

  const columns = header.map((name) => name.trim().toLowerCase());
  const missing = IMPORT_COLUMNS.filter((name) => name !== "completed_task_ids" && !columns.includes(name));
  if (missing.length) {
    return {
      users: [],
      problems: [`Missing column(s): ${missing.join(", ")}. Expected header: ${IMPORT_COLUMNS.join(",")}`],
      source: "replit_import",
    };
  }
  const records = rows.map((cells, index): RawRecord => ({
    row: index + 2, // +1 for the header, +1 for 1-based line numbers
    get: (field) => {
      const position = columns.indexOf(field);
      const value = position >= 0 ? cells[position]?.trim() : "";
      return value ? value : null;
    },
  }));
  return { ...validateRecords(records, "Row"), source: "replit_import" };
}

function validateJson(text: string): ValidatedImport {
  let document: { users?: unknown };
  try {
    document = JSON.parse(text) as { users?: unknown };
  } catch (error) {
    return { users: [], problems: [`The JSON is not valid: ${(error as Error).message}`], source: "potential_user" };
  }
  if (!Array.isArray(document.users)) {
    return { users: [], problems: ['The JSON must contain a "users" array.'], source: "potential_user" };
  }
  const records = document.users.map((item, index): RawRecord => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return {
      row: index + 1,
      get: (field) => {
        const value = entry[field];
        if (Array.isArray(value)) return value.join(";") || null;
        return typeof value === "string" && value.trim() ? value.trim() : null;
      },
    };
  });
  return { ...validateRecords(records, "User #"), source: "potential_user" };
}

function validateRecords(records: RawRecord[], label: string): { users: ImportUser[]; problems: string[] } {
  const users: ImportUser[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const { row, get } of records) {
    const where = label === "Row" ? `Row ${row}` : `${label}${row}`;
    const email = normaliseEmail(get("email"));
    if (!email || !EMAIL_PATTERN.test(email)) {
      problems.push(`${where}: missing or invalid email — skipped.`);
      continue;
    }
    if (seen.has(email)) {
      problems.push(`${where}: duplicate email (already in an earlier row) — skipped.`);
      continue;
    }
    seen.add(email);

    const createdRaw = get("created_at");
    const createdAt = createdRaw ? new Date(createdRaw) : null;
    if (createdAt && Number.isNaN(createdAt.getTime())) {
      problems.push(`${where}: created_at is not a valid date — using import time instead.`);
    }

    const completedTaskIds: string[] = [];
    for (const taskId of (get("completed_task_ids") ?? "").split(";").map((id) => id.trim()).filter(Boolean)) {
      if (findTask(taskId)) completedTaskIds.push(taskId);
      else problems.push(`${where}: unknown task id "${taskId}" — ignored.`);
    }

    users.push({
      row,
      email,
      firstName: get("first_name"),
      lastName: get("last_name"),
      school: get("school"),
      createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
      legacyUserId: get("legacy_user_id"),
      completedTaskIds,
    });
  }
  return { users, problems };
}
