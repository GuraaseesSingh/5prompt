# Importing users from the old Replit app

Real export files in this folder are **git-ignored**, because they contain students' personal data. Only `*.example.csv` and this README are committed.

## 1. Export
Export your users to a CSV named `replit-users.csv` in this folder, with this exact header (see `replit-users.example.csv`):

| Column | Required | Notes |
|---|---|---|
| `email` | yes | Used to link the person to their new production login. |
| `first_name`, `last_name` | no | |
| `created_at` | no | ISO date, e.g. `2026-09-12T10:15:00Z` |
| `legacy_user_id` | no | The old ID (e.g. the development Clerk `user_...` ID), kept for traceability |
| `completed_task_ids` | no | Only if the old system really stored progress. Task IDs separated by `;` (e.g. `role-01;role-02`). |

**Do not include** passwords, password hashes, phone numbers, session tokens, or anything else.

## 2. Dry run (writes nothing)
```
pnpm --filter @workspace/api-server run import:users -- ../../data/import/replit-users.csv
```

## 3. Apply (only after backing up the database and reviewing the dry run)
```
pnpm --filter @workspace/api-server run import:users -- ../../data/import/replit-users.csv --apply
```
It never overwrites or deletes anything: existing emails are left unchanged, and re-running adds nothing. When an imported person signs in to the new production Clerk with the **same verified email**, they are linked to their imported row automatically (`ensureAppUser` in `lib/db/src/progress-store.ts`).

After a successful import, delete the CSV from your computer.

## Potential users list (JSON)
`data/dataForUsers.json` (git-ignored) holds potential users from school outreach. It is generated from the pasted raw list `data/dataForUsers.raw.txt` (also git-ignored):
```
pnpm --filter @workspace/api-server run build:users -- ../../data/dataForUsers.raw.txt ../../data/dataForUsers.json
```
- `users`: import-ready records (email, names, title, school, status). The format is shown in `potential-users.example.json`, which contains fake data.
- `needs_review`: rows that were **not** imported (missing or invalid email), with the reason. Fix them in the raw file and re-run.

Seed (dry run first, then `--apply`):
```
pnpm --filter @workspace/api-server run import:users -- ../../data/dataForUsers.json
```
They are stored in `app_users` with `source = 'potential_user'` and no Clerk account. No emails are sent and no logins are created. When someone signs up with the same verified email, their row is linked automatically.
