# Function Reference

## Host Startup

- `main()` in `src/index.ts`: runs startup sequence and leaves long-running
  polls active.
- `dispatchResponse()` in `src/index.ts`: sends button/action responses to the
  first registered response handler that claims them.
- `shutdown()` in `src/index.ts`: runs registered shutdown callbacks, stops
  polls, stops the CLI socket, tears down channels, and exits.

## Routing And Sessions

- `routeInbound()` in `src/router.ts`: validates sender/channel policy, resolves
  matching wirings, creates or finds sessions, writes inbound messages, and
  wakes runners.
- `resolveSession()` in `src/session-manager.ts`: implements `shared`,
  `per-thread`, and `agent-shared` session lookup semantics.
- `initSessionFolder()` in `src/session-manager.ts`: creates session folders and
  initializes `inbound.db` and `outbound.db`.
- `writeSessionMessage()` in `src/session-manager.ts`: host-only inbound insert,
  including attachment extraction.
- `writeSessionRouting()` in `src/session-manager.ts`: projects default reply
  routing into `inbound.db`.

## Runner Management

- `wakeRunner()` in `src/runner-manager.ts`: deduplicates concurrent wakeups and
  starts a runner when needed.
- `killRunner()` in `src/runner-manager.ts`: terminates an active runner and
  optionally invokes a restart callback on exit.
- `resolveProviderName()` in `src/runner-manager.ts`: session override,
  agent config, then `codex` default.
- `buildRunnerSpec()` in `src/runner-manager.ts`: builds the host process command,
  working directory, and environment for the runner.

## Runner Turn

- `main()` in `src/runner/index.ts`: opens session DBs, claims pending messages,
  calls the provider, writes a reply, and marks messages complete or failed.
- `openRunnerDbs()` in `src/runner/db.ts`: opens `inbound.db` read-only and
  `outbound.db` read/write.
- `getPendingMessages()` in `src/runner/db.ts`: fetches due pending inbound rows.
- `markProcessing()` and `markDone()` in `src/runner/db.ts`: write
  `processing_ack` state.
- `writeTextReply()` in `src/runner/db.ts`: inserts a chat reply into
  `messages_out`.
- `buildPrompt()` in `src/runner/format.ts`: combines group instructions and
  inbound messages into provider input.
- `registerProvider()` and `getProvider()` in `src/runner/providers.ts`: provider
  registry.

## Sweep And Recovery

- `startHostSweep()` and `stopHostSweep()` in `src/host-sweep.ts`: control the
  periodic sweep loop.
- `sweepSession()` in `src/host-sweep.ts`: syncs acknowledgments, wakes runners,
  enforces stale-runner rules, and handles recurrence.
- `decideStuckAction()` in `src/host-sweep.ts`: pure stale-decision function.
- `resetStuckProcessingRows()` in `src/host-sweep.ts`: retries or fails stuck
  messages and clears orphan processing claims.

## Config And Memory

- `configFromDb()` in `src/agent-config.ts`: converts an `agent_configs` DB row
  into runtime config.
- `materializeAgentConfig()` in `src/agent-config.ts`: writes
  `groups/<folder>/agent.json`.
- `composeGroupAgentsMd()` in `src/agents-md-compose.ts`: writes
  `groups/<folder>/AGENTS.md`.
- `listAvailableSkills()` in `src/skills.ts`: reads bundled skill directories
  and parses `SKILL.md` frontmatter.
- `loadSelectedSkills()` in `src/skills.ts`: returns all skills or the named
  subset requested by `agent_configs.skills`.
- `parseSkillSelection()` in `src/skills.ts`: validates the DB representation
  for skill selection.
- `migrateGroupsToAgentsLocal()` in `src/agents-md-compose.ts`: one-time rename
  from old local memory filenames when present.
- `initGroupFilesystem()` in `src/group-init.ts`: ensures group workspace,
  local memory, and config row exist.

## CLI

- `dispatch()` in `src/cli/dispatch.ts`: resolves commands, enforces agent CLI
  scope, optionally requests approval, and runs handlers.
- `registerResource()` in `src/cli/crud.ts`: builds CRUD commands for resource
  definitions.
- `startCliServer()` in `src/cli/socket-server.ts`: listens on `data/ncl.sock`.
- `formatTransportError()` in `src/cli/transport-errors.ts`: user-facing socket
  failure messages.
