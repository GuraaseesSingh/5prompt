# Engineering decision log

Append-only. Never rewrite history: when a decision changes, add a new entry and mark the old one `superseded by D-xxx`.

**Decided by:** `Me` = explicitly approved by the project owner · `AI` = implementation choice made autonomously by the AI within an approved task.
**Status:** proposed → approved → implemented → superseded.

Template:
```
## D-000 Title
Date · Status · Decided by
Context / problem:
Requirements & constraints:
Options considered:
Chosen & why:
Rejected & why:
Risks / consequences:
Files affected:
Verification:
```

---

## D-001 Stop excluding Windows x64 native binaries
2026-10-10 · implemented · AI (the owner approved "download node modules and whatever necessary")
- **Context:** `pnpm-workspace.yaml` overrides removed every non-Linux native binary to slim Replit installs. On Windows, Vite failed with `MODULE_NOT_FOUND` for `@rollup/rollup-win32-x64-msvc`, so the frontend could not be built or run locally.
- **Options:** (a) re-allow only the 4 win32-x64 binaries (esbuild, rollup, lightningcss, tailwind oxide); (b) develop only on Replit/WSL; (c) remove all platform overrides.
- **Chosen:** (a). It is the smallest change, and pnpm installs only the binary that matches the OS, so Linux/Replit installs are unchanged.
- **Rejected:** (b) blocks local learning and debugging; (c) is a larger lockfile change than needed.
- **Risks:** `pnpm-lock.yaml` gains 4 optional entries. Replit's `--frozen-lockfile` install stays valid because the lockfile was regenerated consistently.
- **Files:** `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
- **Verified:** `vite build` failed before and succeeds after (on Windows). A Linux install has not been re-run.

## D-002 Split `routes/arena.ts` into curriculum, evaluation and HTTP layers
2026-10-10 · implemented · AI
- **Context:** One 444-line file mixed task data, LLM prompting and parsing, and HTTP handlers. That made it hard to read and impossible to unit-test the parsing without calling Groq.
- **Chosen:** `lib/tasks.ts` (data plus `findTask`), `lib/evaluation.ts` (prompt, parsing, Groq calls), `routes/arena.ts` (HTTP only). Task data was moved verbatim by script.
- **Rejected:** a full service/repository layering. That is premature until persistence exists (see D-008).
- **Verified:** typecheck passes; 19 tests pass.

## D-003 Groq calls: 12s timeout, no SDK retries, keep the fallback model
2026-10-10 · implemented · AI
- **Context:** groq-sdk defaults to a 60s timeout with 2 retries. Primary plus fallback could take minutes, but Vercel kills the function at 30s (`vercel.json`).
- **Chosen:** `timeout: 12_000`, `maxRetries: 0`, giving a worst case of about 24s. A rate-limited (429) primary goes straight to the fallback model, which has its own separate quota.
- **Rejected:** keeping SDK retries. Retrying against the same rate-limited model mostly wastes the time budget.
- **Risk:** a slow but successful reply over 12s now fails over to the fallback model. Watch the logs for `Primary Groq evaluation failed`.

## D-004 Vitest for API tests
2026-10-10 · implemented · AI
- **Context:** there were no tests at all.
- **Options:** Vitest, Jest, `node:test`.
- **Chosen:** Vitest. It uses the Vite/esbuild toolchain already in the repo, runs TypeScript and ESM with no config, and has built-in mocking (needed to fake Clerk and Groq).
- **Rejected:** Jest (needs extra TS/ESM setup); `node:test` (local Node 22 cannot import this repo's extensionless TS paths without a loader).
- **Files:** `artifacts/api-server/package.json` (`test` script plus devDependency), root `package.json` (`pnpm test`).

## D-005 Show honest errors instead of fake data
2026-10-10 · implemented · AI (within the owner's request to fix the audited bugs)
- **Context:** on any API failure the UI showed a hard-coded 7/10 evaluation, a demo task, and made-up progress (completed 2, streak 3, average 6.8). Students saw fake feedback as real, and outages were invisible.
- **Chosen:** remove `demoEvaluation`, `demoTask`, `fallbackProgress` and `fallbackCheckpoint`. Show an error with a retry, and keep the user's prompt so they can resubmit.
- **Risk:** during outages users now *see* errors. This is intended.
- **Files:** `pages/practice.tsx`, `pages/progress.tsx`, new `lib/api-error.ts`.

## D-006 Reject unknown task IDs (404)
2026-10-10 · implemented · AI
- **Context:** `/evaluate` silently graded an unknown `taskId` against the *global* current task, so feedback could refer to a different brief than the one on screen.
- **Files:** `routes/arena.ts`. Test: `arena.test.ts` "rejects unknown task IDs".

---

## D-007 Send the Clerk session token as a Bearer header (fix for Bug A)
2026-10-10 · **implemented in code, not deployed** · Decided by: AI. The owner delegated the approach in session 2 ("figure out the best way to finish the work yourself") and reserved approval for production auth changes and real-data migration. The quiz was offered but not taken.
- **Context:** RC2. Clerk renews an expired session cookie server-side only for GET requests, so a POST `/evaluate` with an expired cookie looked like a guest.
- **Options:** (a) frontend sends `Authorization: Bearer <getToken()>`; (b) change submit to GET (wrong semantics); (c) loosen the guest check (hides the symptom).
- **Chosen:** (a). Registered once in `AppStateProvider` via `setAuthTokenGetter`; if `getToken()` fails it falls back to the cookie. The server also clears the guest cookie once a user is recognised.
- **Files:** `prompt-arena/src/context/app-context.tsx`, `api-server/src/routes/arena.ts`.
- **Verified:** server behaviour by tests (a signed-in user with guest cookie = 2 gets 200 and the cookie is cleared). **Not verified:** a real browser plus Clerk session. This needs a manual test with real keys.

## D-008 Persist attempts per user in Postgres (fix for Bugs B and C)
2026-10-10 · **implemented in code, not deployed; migration not applied** · Decided by: AI (approach); owner approval required before migrating or deploying.
- **Context:** RC1, the global in-memory `attempts` array.
- **Requirements:** per-user progress that survives restarts, multiple serverless instances, sign-out/sign-in and refresh; safe for 200+ existing accounts; works on Vercel.
- **Chosen:** tables `app_users` and `attempts` (Drizzle; the migration is reviewed SQL in `lib/db/migrations`). Next task = earliest task the user hasn't attempted (`nextTaskFor`), so there's no shared counter and double-submits can't skip tasks. Progress, checkpoint and a real day streak are computed per user.
- **Rejected:** a `current_task` counter column (needs locking and can drift; deriving from history is always consistent); Redis/KV (another service, and we need relational history anyway); keeping Replit's database tied to the Replit workspace (fragile for a Vercel-hosted app).
- **Provider recommendation:** Neon serverless Postgres (free tier, pooled connections suit serverless, and it's what Vercel's Postgres integration uses). Alternative: Supabase.
- **Verified:** 53 tests, including real SQL in PGlite using the same migration: two users are independent, 25 concurrent users, a double-submit, persistence across a "new instance", and the email relink.

## D-009 Prompt-injection hardening plus a per-user daily cap
2026-10-10 · **implemented in code, not deployed** · Decided by: AI
- The student's prompt moved from the system message into a separate user message inside `<student_prompt>` tags; the tags are stripped from user input.
- A per-user cap of `EVALUATIONS_PER_USER_PER_DAY` (default 40, rolling 24h, enforced before the Groq call) means one user can't drain the shared Groq quota.
- **Still open:** guests can reset their free attempts by clearing cookies (needs a server-side guest identity, e.g. hashed IP plus a signed ID); this is low priority now that signed-in usage is capped.

## D-010 Reject using multiple Groq accounts as fallbacks; use a model chain within one account
2026-10-10 · implemented · Decided by: AI (the owner proposed 4–5 accounts)
- **Context:** the owner suggested 4–5 Groq account keys as fallbacks.
- **Finding:** Groq's Acceptable Use Policy forbids exceeding rate limits "by registering multiple accounts or orchestrating usage between multiple organizations", and its Terms forbid circumventing free-tier limits. Violating this risks suspension of **all** the accounts at once, which would mean a full outage. Also, keys from the *same* organization share one limit, so they wouldn't help anyway.
- **Chosen:** one account and key; a configurable chain of models (`GROQ_MODELS`), each with its own published per-model limit; one attempt per model; a 25s total budget; an honest 503 "busy" when every model is rate-limited; a per-user daily cap (D-009).
- **Recommended next:** measure real token usage, and move to Groq's paid Developer tier if the free limits are hit regularly. A second *provider* is a legitimate future option for failover.

## D-011 Use the configured Clerk publishable key, not one derived from the hostname
2026-10-10 · implemented in code, not deployed · Decided by: AI
- **Context:** `publishableKeyFromHost` returns dev keys unchanged, but for live keys it builds a key for `clerk.<current hostname>`, which is wrong on `*.vercel.app` and `www.`.
- **Chosen:** use `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_PUBLISHABLE_KEY` directly, and derive from the host only if no key is configured. Behaviour with today's dev key is identical.

## D-012 Link returning users by *verified* email across Clerk instances
2026-10-10 · implemented in code · Decided by: AI
- **Context:** moving from the dev to the production Clerk instance gives every user a new Clerk ID.
- **Chosen:** `ensureAppUser` links a new Clerk ID to an existing `app_users` row only when Clerk reports the primary email as verified. Unverified emails are never used for linking (tested), so nobody can claim someone else's progress.

## D-013 One repo-root `.env` (git-ignored) plus `.env.example`; real exports git-ignored
2026-10-10 · implemented · Decided by: AI
- Vite `envDir` points to the repo root; the API's `start` and `import:users` scripts use Node's `--env-file-if-exists`. Production values live in the Vercel dashboard. `data/import/*` is ignored except the example and README (students' personal data).

## D-014 Seed potential users from the outreach list into `app_users`
2026-10-10 · implemented in code; **seeding the real database needs owner approval** · Decided by: AI (format and approach), at the owner's request
- **Context:** the owner pasted about 187 potential users (teachers at partner schools) in mixed formats: tab-separated rows, markdown tables with `\@` escapes and `mailto:` links, and a partial hand-made JSON.
- **Chosen:** a deterministic converter (`lib/potential-users.ts`, `build:users`) instead of hand-editing. It never guesses broken emails, keeps raw values, lists every skipped row in `needs_review`, and groups school spelling variants by a punctuation-insensitive key. Records go into `app_users` with `source = 'potential_user'`, plus a new nullable `school` column. The initial migration was regenerated, because it had never been applied anywhere.
- **Rejected:** a separate `leads` table (people would need moving between tables at sign-up; one table plus `source` and email linking is simpler); hand-editing the JSON (error-prone and not repeatable).
- **Privacy:** these are real people's names and emails. Both data files are git-ignored (`data/*`), tests use fake data only, and the importer reports by row number. No emails are sent and no accounts are created. Contacting these people should follow consent and India's DPDP Act.
- **Verified:** 63 tests; the real JSON was seeded into an in-memory PGlite (182 created, re-run created 0, dry run wrote nothing).
