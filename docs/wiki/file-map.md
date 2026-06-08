# File Map

## Entry And Orchestration

- `src/index.ts`: starts DB migrations, channels, delivery polls, host sweep, and the `ncl` socket server.
- `src/router.ts`: routes inbound channel events into sessions.
- `src/delivery.ts`: delivers outbound session messages back to channel adapters.
- `src/host-sweep.ts`: syncs processing acknowledgments, wakes runners, retries stuck messages, and fans out recurring tasks.
- `src/runner-manager.ts`: starts and stops host-native runner processes.

## Runner

- `src/runner/index.ts`: one runner turn; read pending work, call provider, write reply.
- `src/runner/db.ts`: runner-side session DB reads/writes.
- `src/runner/format.ts`: converts inbound rows plus `AGENTS.md` into provider prompt text.
- `src/runner/providers.ts`: provider registry and current Codex/GPT providers.

## Configuration And Memory

- `src/agent-config.ts`: typed agent config and `agent.json` materialization.
- `src/db/agent-configs.ts`: CRUD for the `agent_configs` table.
- `src/agents-md-compose.ts`: composes `groups/<folder>/AGENTS.md` from base instructions, group memory, skills, and MCP instructions.
- `src/skills.ts`: discovers bundled `skills/<name>/SKILL.md` files and resolves `agent_configs.skills` selection.
- `src/group-init.ts`: initializes `groups/<folder>/AGENTS.local.md` and config rows.
- `skills/*/SKILL.md`: bundled instruction skills injected into composed `AGENTS.md`.

## Databases

- `src/db/connection.ts`: central DB connection.
- `src/db/migrations/*`: central DB migrations.
- `src/db/session-db.ts`: session DB schema and host-side operations.
- `src/db/sessions.ts`: session rows plus pending question/approval rows.
- `src/db/agent-groups.ts`: agent group CRUD helpers.
- `src/db/messaging-groups.ts`: messaging group and wiring helpers.

## Channels And CLI

- `src/channels/adapter.ts`: channel adapter contract.
- `src/channels/channel-registry.ts`: channel registration and startup.
- `src/channels/chat-sdk-bridge.ts`: bridge for Chat SDK based adapters.
- `src/channels/discord.ts`: bundled Discord adapter.
- `src/cli/*`: `ncl` command dispatch, socket transport, and resources.

## Modules

- `src/modules/approvals/*`: reusable human approval primitive and OneCLI approval bridge.
- `src/modules/interactive/*`: question response handling.
- `src/modules/scheduling/*`: scheduled and recurring task support.
- `src/modules/permissions/*`: user access and sender/channel approval flows.
- `src/modules/agent-to-agent/*`: agent destination routing.
- `src/modules/typing/*`: typing indicator refresh.
