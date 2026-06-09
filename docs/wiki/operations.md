# Operations

## Run

```bash
pnpm install
pnpm run build
pnpm run dev
```

## Configure Provider

```bash
ncl groups config update --id <group-id> --provider codex
ncl groups config update --id <group-id> --provider gpt --model gpt-5
```

Codex provider requirements:

- `codex` on `PATH`
- Codex CLI already authenticated

GPT provider requirements:

- `OPENAI_API_KEY`
- optional `OPENAI_BASE_URL`

## Manage Groups

```bash
ncl groups list
ncl groups get --id <group-id>
ncl groups config get --id <group-id>
ncl groups restart --id <group-id>
```

## Session Files

Session files live under:

```text
data/sessions/<agent-group-id>/<session-id>/
  inbound.db
  outbound.db
  outbox/
  .heartbeat
```

Use the project query helper for ad-hoc DB inspection:

```bash
pnpm exec tsx scripts/q.ts data/anotherclaw.db "select id,name from agent_groups"
```

## Add A Provider

1. Add a provider implementation in `src/runner/providers.ts` or split a new
   file and import it there.
2. Register it with `registerProvider({ name, run })`.
3. Store provider-specific settings in `agent_configs` only if they are shared
   across sessions.
4. Keep routing, delivery, session DBs, and channel adapters provider-agnostic.
