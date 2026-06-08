import fs from 'fs';
import path from 'path';

import type { InboundRow } from './db.js';

export function buildPrompt(messages: InboundRow[]): string {
  const agentDir = process.env.ANOTHERCLAW_AGENT_DIR || process.cwd();
  const instructions = readOptional(path.join(agentDir, 'AGENTS.md'));
  const renderedMessages = messages.map(renderMessage).join('\n\n');
  return [instructions, '## Incoming Messages', renderedMessages].filter(Boolean).join('\n\n');
}

function renderMessage(message: InboundRow): string {
  const parsed = parseJson(message.content);
  const text = typeof parsed?.text === 'string' ? parsed.text : message.content;
  const sender = typeof parsed?.sender === 'string' ? parsed.sender : 'user';
  return [
    `### ${message.id}`,
    `kind: ${message.kind}`,
    `timestamp: ${message.timestamp}`,
    `sender: ${sender}`,
    '',
    text,
  ].join('\n');
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readOptional(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
}
