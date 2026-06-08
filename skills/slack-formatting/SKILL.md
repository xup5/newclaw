---
name: slack-formatting
description: Format messages for Slack-style mrkdwn when a Slack channel adapter is added later.
---

# Slack Formatting Skill

Use this skill only when the conversation is known to be in Slack.

## Formatting Reference

- Use `*bold*`, not `**bold**`.
- Use `_italic_`.
- Use backticks for inline code.
- Use triple-backtick code blocks for multi-line code.
- Use `<https://example.com|link text>` for named links.
- Prefer bullets over numbered lists.
- Avoid Markdown tables and headings; use short bold labels instead.

## Example

```text
*Build Result*

- Status: passing
- Commit: `abc123`
- Details: <https://ci.example.com/build/123|View build>
```
