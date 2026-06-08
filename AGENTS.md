# AnotherClaw

AnotherClaw is a host-native personal agent router. The service is a single Node
host process that receives channel messages, writes them to per-session SQLite
queues, wakes a local runner process, and delivers replies back through the
same channel adapter.

## Core Principles

- Codex is the default provider.
- GPT through OpenAI's Responses API is also supported.
- Providers stay behind `src/runner/providers.ts`.
- Runners execute directly on the host and inherit the host process
  permissions.
- Agent groups are routing and memory boundaries, not security boundaries.
- Session DBs remain the traffic contract: host writes `inbound.db`, runner
  writes `outbound.db`.

## Key Files

| File | Purpose |
| --- | --- |
| `src/index.ts` | Host startup and shutdown orchestration |
| `src/router.ts` | Inbound routing into sessions |
| `src/delivery.ts` | Outbound delivery polling |
| `src/host-sweep.ts` | Retry, recurrence, stale-runner detection, runner wakeups |
| `src/runner-manager.ts` | Host-native runner process management |
| `src/runner/index.ts` | One runner turn |
| `src/runner/providers.ts` | Codex/GPT provider abstraction |
| `src/agent-config.ts` | Agent config materialization |
| `src/agents-md-compose.ts` | `AGENTS.md` composition per agent group |
| `src/db/session-db.ts` | Session DB schemas and operations |
| `src/db/migrations/` | Central DB migrations |
| `docs/wiki/` | Rebuild design documentation |

## Development

Run commands directly.

```bash
pnpm install
pnpm run build
pnpm run dev
pnpm test
```

For ad-hoc DB reads, use:

```bash
pnpm exec tsx scripts/q.ts <db> "<sql>"
```

## Editing Rules

- Do not reintroduce the removed isolated runtime architecture.
- Do not add provider-specific logic to router, delivery, or session DB code.
- Keep provider integrations inside the runner provider abstraction.
- Keep docs in `docs/wiki/` current when changing architecture.
- Prefer deleting stale compatibility code over preserving unused branches.
