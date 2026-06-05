---
description: Force-refresh .claude/docs (API spec + Notion pages) ignoring the throttle
allowed-tools: Bash(node scripts/sync-docs.mjs --force)
---

Run `node scripts/sync-docs.mjs --force` and report the result concisely:
which docs were created/updated/unchanged, and surface any skipped or failed
items (e.g. missing NOTION_TOKEN or unreachable API) with the one-line reason.
Do not take any other action.
