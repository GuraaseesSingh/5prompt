# Production cutover runbook

The steps to take the per-user persistence and production Clerk changes live on **5prompts.vercel.app**. Every step marked 🔒 needs the owner's explicit approval at that moment.

## What you need to provide (set it yourself; never paste secrets into chat)
| Item | Where it comes from | Where it goes |
|---|---|---|
| A domain you own, e.g. `5prompt.app` | Any registrar | Vercel → Project → Domains. **Clerk production does not work on `*.vercel.app`.** |
| `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (same `pk_live_…` value) | Clerk dashboard (your own account) → production instance → API keys | Vercel env vars (Production scope) |
| `CLERK_SECRET_KEY` (`sk_live_…`) | Same place | Vercel env vars (Production). Never in the frontend. |
| `DATABASE_URL` (the **pooled** connection string) | Neon (free tier), or the Vercel Marketplace → Neon | Vercel env vars, plus your local `.env` for running migrations |
| `GROQ_API_KEY` (one key, one account) | console.groq.com | Vercel env vars (it probably already exists there) |
| Optional: `GROQ_MODELS`, `APP_TIMEZONE` (e.g. `Asia/Kolkata`), `EVALUATIONS_PER_USER_PER_DAY` | You choose | Vercel env vars |
| User export CSV | Replit / old Clerk (see `data/import/README.md`) | `data/import/replit-users.csv` locally (git-ignored) |

Keep development keys for local use and Vercel *Preview* deployments.

## Steps
1. **Database:** create a Neon project. Put its pooled URL in your local `.env` as `DATABASE_URL`.
2. 🔒 **Apply the migration** (additive: it only creates the `app_users` and `attempts` tables):
   `pnpm --filter @workspace/db run migrate`
3. 🔒 **Seed potential users** from `data/dataForUsers.json` (182 people), and optionally the Replit export: dry run first, then `--apply` (see `data/import/README.md`). Take a Neon backup or branch first.
4. **Clerk production instance:** create it in your Clerk account, add your domain, and configure the DNS records Clerk shows. Enable the same sign-in methods as today; Google login needs your own Google OAuth credentials in production.
5. 🔒 **Set the Vercel env vars** listed above (Production scope).
6. 🔒 **Deploy.** After changing env vars, redeploy (old functions keep the old environment).
7. **Verify on the live site:** sign up; do 2 tasks; refresh (progress kept); sign out and back in (same task); a second account starts at task 1; `/api/healthz` returns 200.
8. Tell students the new address. The old `*.vercel.app` address can redirect to the custom domain (Vercel → Domains → Redirect).

## Existing users
- **Learning progress:** none exists to migrate. The live code (`api/index.js`) keeps attempts only in server memory (`var attempts = []`), so it was never saved.
- **Accounts:** they live in the development Clerk instance. Option A (recommended): users sign up again on the production site **with the same email**. If you imported them first, `ensureAppUser` links them to their imported row automatically, via verified email only. Option B: Clerk's user import (bulk-creates users in production; passwords migrate only if a password-hash export is available). Decide after you see what the Replit export contains.

## Rollback
- Code: redeploy the previous Vercel deployment (Vercel → Deployments → Promote).
- Auth: switch the Clerk env vars back to the development keys and redeploy.
- Database: the migration only adds new tables, so the old code ignores them. An import can be undone with `DELETE FROM app_users WHERE source = 'replit_import' AND clerk_user_id IS NULL`, but **only for people who have not signed in yet**. Once linked, a user's real attempts hang off that row, and deleting it would cascade to them. Take a Neon backup or branch before importing.
