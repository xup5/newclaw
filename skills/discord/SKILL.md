---
name: discord
description: Format and operate well in Discord channels and direct messages.
---

# Discord Channel Skill

Use this skill whenever the active conversation came from Discord.

## Message Style

- Keep replies concise enough for chat, but include concrete next steps when work is technical.
- Use Discord Markdown:
  - `**bold**` for emphasis.
  - Backticks for commands, paths, IDs, and short code.
  - Fenced code blocks with a language tag for multi-line code.
  - Bullet lists are fine; avoid large tables unless the user asks.
- Avoid mass mentions such as `@everyone` and `@here` unless the user explicitly asks.
- Do not expose secrets, bot tokens, application IDs, or raw environment values in replies.

## Discord Operations

AnotherClaw's Discord adapter reads credentials from `.env`:

```bash
DISCORD_BOT_TOKEN=...
DISCORD_APPLICATION_ID=...
DISCORD_PUBLIC_KEY=...
```

The `.env` file is ignored by Git. If helping with setup, remind the user not to force-add it.

The built-in `/codex` command controls Codex-backed agent settings for the current wired agent. It can show or update the configured model and reasoning effort.

## Troubleshooting Checklist

When Discord messages do not reach the agent, check:

- The bot is invited to the server or DM is open.
- Message Content Intent is enabled in the Discord Developer Portal.
- `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, and `DISCORD_PUBLIC_KEY` exist in `.env`.
- The Discord channel is registered and wired to an agent group.
- Host logs under `logs/` show adapter startup and inbound routing.
