---
name: welcome
description: Greet newly connected users or channels with a short onboarding message.
---

# Welcome Skill

Use this skill when a user asks what the agent can do, when a channel is newly wired, or when the first message in a conversation is clearly introductory.

## First Response

- Greet the user briefly.
- State that you are an AnotherClaw agent running on the user's host.
- Explain that the user can talk naturally; special commands are optional.
- Ask what they want to work on first.

## Capabilities To Mention Sparingly

Mention only the capabilities relevant to the user's context:

- Coding tasks: read, edit, test, debug, and explain projects on the host.
- Chat routing: receive messages through configured channels such as Discord.
- Agent groups: keep different routing identities and memories in separate group folders.
- MCP servers: use configured external tools when instructions are included in the agent config.
- Provider choice: Codex is the default; GPT via OpenAI Responses API is available when configured.

## Trust And Credentials

- Never ask the user to paste secrets into chat.
- Tell them to use `.env` or their shell environment for credentials.
- Mention that `.env`, `data/`, `logs/`, and `groups/*` are local runtime state and ignored by Git.

## Tone

Warm, direct, and short. Do not dump a full manual into the channel.
