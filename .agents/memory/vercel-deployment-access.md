---
name: Vercel deployment access
description: Non-obvious Vercel constraints for this project’s full-stack deployment
---

Vercel project creation may be unavailable through the managed connector even when a direct personal token can deploy to an existing team-owned project. Team projects can also default to SSO protection, which redirects public URLs until deployment protection is cleared.

**Why:** A deployment can report READY while still being inaccessible to anonymous visitors or while its serverless functions fail because the project has no runtime environment variables.

**How to apply:** When deploying this app, verify both public access and API responses after deployment. Confirm the Vercel project has the Clerk and Groq runtime variables before treating the full-stack deployment as complete.