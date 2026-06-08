# Skills

AnotherClaw skills are prompt instruction bundles. They are intentionally
lighter than the old setup/runtime skill system: no plugin marketplace, no
container mounts, and no hidden installer flow.

## Storage

Bundled skills live in:

```text
skills/<name>/SKILL.md
```

Each file may start with simple frontmatter:

```markdown
---
name: discord
description: Format and operate well in Discord channels and direct messages.
---
```

The Markdown body is the instruction payload.

## Loading

Every agent group has an `agent_configs.skills` value:

- `"all"` loads every bundled skill.
- `["discord", "welcome"]` loads only the named skills.

On runner wake, `src/agents-md-compose.ts` reads the selected skills and writes
them into `groups/<folder>/AGENTS.md` under `## Skills`. The runner prompt is
then built from that composed file plus the incoming message batch.

## Management

List available skills:

```bash
ncl groups config list-skills
```

Set a group to all skills:

```bash
ncl groups config set-skills --id <group-id> --skills all
```

Set explicit skills:

```bash
ncl groups config set-skills --id <group-id> --skills discord,welcome,host-native-coding
```

or:

```bash
ncl groups config set-skills --id <group-id> --skills '["discord","welcome"]'
```

## Current Bundled Skills

- `discord`: Discord formatting, setup notes, and troubleshooting.
- `welcome`: short onboarding behavior for new users or channels.
- `host-native-coding`: host-native coding workflow and verification rules.
- `slack-formatting`: Slack mrkdwn guidance for future Slack channel use.
