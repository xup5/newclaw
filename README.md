# AnotherClaw

AnotherClaw is a host-native personal agent router. It receives messages from chat
channels, stores them in per-session SQLite files, wakes a local agent runner,
and delivers the runner's replies back through the originating channel.

The rebuild is intentionally small:

- Codex is the default provider.
- GPT via the OpenAI Responses API is also supported.
- Provider code lives behind `src/runner/providers.ts`.
- Runners execute directly on the host with the same OS permissions as the
  service process.
- Session traffic still uses `inbound.db` and `outbound.db` so message flow is
  deterministic and recoverable.

## Quick Start

```bash
pnpm install
pnpm run build
pnpm run dev
```

Set one of:

```bash
# Codex CLI provider
codex login

# GPT provider
export OPENAI_API_KEY=...
ncl groups config update --id <group-id> --provider gpt --model gpt-5
```

## Main Concepts

- `agent_groups`: named agent identities with a host workspace under `groups/`.
- `messaging_groups`: external chat/channel surfaces.
- `messaging_group_agents`: wiring between chats and agents.
- `sessions`: a conversation runtime keyed by agent group, messaging group, and thread.
- `inbound.db`: host-owned message queue for runner input.
- `outbound.db`: runner-owned queue for replies and processing acknowledgments.
- `skills/<name>/SKILL.md`: bundled prompt instruction skills injected into
  generated group `AGENTS.md` files according to `agent_configs.skills`.

## Documentation

Start with [docs/wiki/index.md](docs/wiki/index.md).
