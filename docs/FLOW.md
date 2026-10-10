# Execution flows

Evidence-based chains with real file and function names. `[Inferred]` marks steps not verified at runtime. Update this file whenever a change alters one of these paths.

_Last updated: 2026-10-10 (session 2). Per-user persistence, the Bearer-token auth fix, and the Groq model chain are implemented in code. **None of this is deployed yet** (see [PRODUCTION_CUTOVER.md](PRODUCTION_CUTOVER.md))._

## 1. Frontend boot
`artifacts/prompt-arena/index.html` → `src/main.tsx` `createRoot` → `ErrorBoundary` → `App` (`src/App.tsx`)
→ `TooltipProvider` → `WouterRouter base=BASE_URL`
→ `ClerkProviderWithRoutes`. The publishable key is `VITE_CLERK_PUBLISHABLE_KEY` used as-is: `pk_test_` means development mode, `pk_live_` means production.
→ `QueryClientProvider` → `AppStateProvider` (`src/context/app-context.tsx`):
  - registers `setAuthTokenGetter(() => getToken())` once, during its first render, so every API call carries a fresh Clerk token;
  - exposes `auth.userId`;
  - drops all user-scoped cached queries when the user changes;
  - runs `useGetProgress` with key `[...'/api/progress', {user}]`, only when signed in.
→ `Router` → routes `/` Practice, `/progress`, `/welcome`, `/sign-in/*`, `/sign-up/*`.

## 2. API request pipeline
`customFetch` (`lib/api-client-react/src/custom-fetch.ts`) adds `Authorization: Bearer <token>` when the getter returns one. The session cookie is also sent, because the request is same-origin.
→ Vercel rewrites `/api/*` to `api/index.js` (a bundle of `app.ts`) `[Inferred: production on 5prompts.vercel.app]`
→ `artifacts/api-server/src/app.ts`: `pinoHttp` → `clerkProxyMiddleware` → `cors` → `cookieParser` → `express.json` → `clerkMiddleware` (configured `CLERK_PUBLISHABLE_KEY`; **a header token takes priority over the cookie**) → `/api` → `routes/index.ts` → `health`, then `createArenaRouter(defaultArenaDeps)`.

## 3. Identify the caller (every arena route)
`currentUser(req)` (`routes/arena.ts`) → `deps.getUserId` = `getAuth(req).userId` (null means guest)
→ `ensureAppUser(db, clerkUserId, loadClerkProfile)` (`lib/db/src/progress-store.ts`):
  1. `SELECT app_users WHERE clerk_user_id = ?`. If found, done (the usual case).
  2. Otherwise `clerkClient.users.getUser` (one Clerk API call per new user). If the primary email is **verified** and matches an existing `app_users.email` (imported, or from the old dev instance), `UPDATE` that row's `clerk_user_id`. This is relinking.
  3. Otherwise `INSERT ... ON CONFLICT DO NOTHING`, then re-SELECT. This is safe when two first requests arrive at once.

## 4. Get my next task
`Practice` → `useGetTask` (key `[...'/api/task', {user}]`, enabled once Clerk has loaded) → `GET /api/task`
→ signed in: `listAttempts(db, user.id)` → `nextTaskFor(history)` (`lib/progress.ts`) = the earliest task by order that this user hasn't attempted.
→ guest: `guestTask(cookie prompt_arena_free_attempts)`.
Response is `Cache-Control: no-store`. **No shared counter exists any more.**

## 5. Submit a prompt (core loop)
1. `Practice.submitPrompt` (`pages/practice.tsx`) checks a task is loaded, the prompt is at least 10 characters, auth is loaded, and the guest UX cap (localStorage).
2. `POST /api/evaluate` → `arenaRouter`:
   - Validate the body (400) → `findTask` (404) → `currentUser` (before spending any Groq call).
   - Guest with cookie ≥ 2 → 401.
   - Signed-in user with ≥ `EVALUATIONS_PER_USER_PER_DAY` attempts in the last 24h (`countAttemptsSince`) → 429.
   - `evaluatePrompt` → `evaluateWithModels(completeWithGroq, configuredModels())` (`lib/evaluation.ts`):
     - Each model in `GROQ_MODELS` order gets one attempt, at most 12s each, within a 25s total budget.
     - The system message (`buildEvaluationPrompt`) holds the coach instructions. The user message (`buildStudentMessage`) holds the student's prompt inside `<student_prompt>` tags.
     - `parseModelEvaluation` validates and normalises the reply.
     - Every model returned 429 → `CoachBusyError` → 503 "Lots of students are practising". Any other failure → 502.
   - Signed in: `recordAttempt` (an INSERT into `attempts`; on failure → 503 "couldn't save, submit again") and clear the guest cookie. Guest: increment the cookie.
3. Client `onSuccess`: show `FeedbackCard`, keep the current task card on screen, `progress.refresh()`. **"Try the next rep"** → `nextTask()` → refetch `/api/task`.
   Client `onError`: guest 401 → sign-in dialog; signed-in 401 → "could not confirm your sign-in"; otherwise the server's message. The prompt is kept.

## 6. Progress and checkpoint
`GET /api/progress` → `requireUser` → `listAttempts` → `buildProgress(history, now, APP_TIMEZONE)`: distinct tasks completed, average of scored attempts, current concept, **real day streak** (`dayStreak`), and the scores.
`POST /api/checkpoint` → `buildCheckpoint(history)`: last 5 scored attempts, strongest and weakest concept.
Unhandled errors (for example, the database is unreachable) → the router's error handler → JSON 500.

## 7. Data model (`lib/db/src/schema/index.ts`, migration `lib/db/migrations/0000_init_progress.sql`)
- `app_users`: id, clerk_user_id (unique), email (unique, lower-case), names, source (`signup` / `replit_import`), legacy_user_id, timestamps.
- `attempts`: id, user_id → app_users (cascade), task_id, concept, score (null only for imported rows), flaws (jsonb), source (`evaluation` / `import`), created_at. Indexed on (user_id, created_at).
Identity (passwords, OAuth) stays in Clerk; Postgres stores only learning data and the link to the Clerk account.

## 8. Importing users (Replit CSV or potential-users JSON)
Potential users: raw pasted list → `build:users` → `convertPotentialUsers` (`lib/potential-users.ts`) → `data/dataForUsers.json`.

`pnpm --filter @workspace/api-server run import:users -- <csv> [--apply]` → `scripts/import-replit-users.ts` → `validateImport` (`lib/import-users.ts`; detects CSV or JSON; JSON rows get `source = 'potential_user'`) → `importUsers` (`lib/db/src/import-store.ts`). It runs in one transaction, is a dry run unless `--apply` is given, never overwrites, and is idempotent.
