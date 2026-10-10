# 5prompt (repo: Prompt-Arena)

Guided prompt-writing practice for students and teachers. A user gets a task, writes a prompt, and an LLM (Groq) scores it 1–10 with specific flaws and a rewrite. Guests get 2 free attempts, then sign in (Clerk).

## You are a mentor as well as a coding agent
Follow [docs/LEARNING.md](docs/LEARNING.md) in every session. In short: explain meaningful changes, debug from evidence, add tests, never claim something works without showing proof, and run the **quiz-before-major-changes** protocol for high-risk work. A passed quiz is not approval.

## Map
- `artifacts/prompt-arena/` — React 19 + Vite frontend (wouter, TanStack Query, Clerk). Entry: `src/main.tsx` → `src/App.tsx`. Shared auth/progress state: `src/context/app-context.tsx`.
- `artifacts/api-server/` — Express 5 API. `src/app.ts` (middleware) → `src/routes/arena.ts` (HTTP, `createArenaRouter(deps)`) → `src/lib/progress.ts` (per-user rules), `src/lib/evaluation.ts` (Groq model chain), `src/lib/tasks.ts` (curriculum).
- `lib/api-spec/openapi.yaml` — API contract, the source of truth. Orval generates `lib/api-client-react` (hooks) and `lib/api-zod` (schemas). Never hand-edit `generated/`.
- `lib/db/` — Drizzle + Postgres: schema (`app_users`, `attempts`), queries (`progress-store.ts`, `import-store.ts`), reviewed SQL in `migrations/`, `testing.ts` (in-process PGlite for tests).
- `data/import/` — Replit user import template (real exports are git-ignored).
- `api/` — generated Vercel bundle of the API (built by `scripts/build-vercel-api.mjs`). Do not edit by hand.
- `artifacts/mockup-sandbox/` — Replit design sandbox, not part of the product.

## Commands (pnpm only)
- `pnpm install` · `pnpm run typecheck` · `pnpm test`
- DB: `pnpm --filter @workspace/db run generate` (after schema edits; review the SQL) · `run migrate` (🔒 production needs approval)
- `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Frontend dev: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/5prompt run dev`
- API dev: `PORT=8080 pnpm --filter @workspace/api-server run dev` (needs Clerk keys; without `CLERK_SECRET_KEY` every route returns 500)
- Env: copy `.env.example` → `.env` (repo root, git-ignored). Never print values. Production values live in Vercel.
- Production rollout: [docs/PRODUCTION_CUTOVER.md](docs/PRODUCTION_CUTOVER.md)

## Standards
- Vite does not typecheck, so a "successful" build can still crash. Always run `pnpm run typecheck`.
- Never show made-up data (scores, progress) as if it were real. Show an honest error with a retry.
- Server-side checks are the real enforcement; client checks are only UX.
- Small, reviewable increments. No unrequested rewrites or new dependencies.
- Record meaningful decisions in [docs/DECISIONS.md](docs/DECISIONS.md) and update [docs/FLOW.md](docs/FLOW.md) when execution paths change.

## Rules specific to this codebase
- Progress is always derived from the user's own `attempts` rows. Never add shared or global mutable state to the API (it runs as many serverless instances).
- Key per-user frontend queries with `userScopedKey(...)` from `src/context/app-context.tsx`.
- Use one Groq account only (see D-010 in DECISIONS.md).

## Status
See [docs/CODEBASE_AUDIT.md](docs/CODEBASE_AUDIT.md) Part 3 for what is fixed, what is unverified, and what is still open.
