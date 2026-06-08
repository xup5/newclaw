---
name: host-native-coding
description: Work safely and effectively as a coding agent with direct host access.
---

# Host-Native Coding Skill

AnotherClaw runners execute directly on the user's host. Treat that access as powerful and normal for this project, but keep changes controlled.

## Working Rules

- Read the relevant code before editing.
- Prefer existing project patterns over new abstractions.
- Keep changes scoped to the user's request.
- Use `rg` for code search when available.
- Use the project's package manager and scripts for verification.
- Do not overwrite unrelated user changes.
- Do not commit secrets, `.env`, runtime DBs, logs, or generated group files.

## Verification

For TypeScript changes in this repo, prefer:

```bash
pnpm run build
pnpm test
pnpm run lint
```

If a command cannot run, report the exact reason.

## Git

- Check `git status --short` before committing.
- Commit only intentional changes.
- Keep commit messages specific and factual.
