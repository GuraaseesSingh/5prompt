---
name: Groq model availability
description: Groq model identifiers can disappear or differ from informal names in implementation requests.
---

Use a currently published Groq model ID in production code and keep a current fallback. Informal identifiers such as `openai12000b` may not exist, while older models such as `mixtral-8x7b-32768` can be decommissioned.

**Why:** A real request against both requested identifiers failed: one was not found and the other was decommissioned.

**How to apply:** When changing Groq models, verify the exact live ID first and update both the primary and fallback together.