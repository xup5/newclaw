import fs from 'fs';
import path from 'path';

import { GROUPS_DIR } from './config.js';
import { mergeMcpServers, type McpServerConfig } from './agent-config.js';
import { getAgentConfig } from './db/agent-configs.js';
import { log } from './log.js';
import { loadSelectedSkills, parseSkillSelection } from './skills.js';
import type { AgentGroup } from './types.js';

const COMPOSED_HEADER = '<!-- Composed at runner start. Edit AGENTS.local.md for group-specific memory. -->';

export function composeGroupAgentsMd(group: AgentGroup): void {
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  const configRow = getAgentConfig(group.id);
  const groupMcpServers: Record<string, McpServerConfig> = configRow
    ? (JSON.parse(configRow.mcp_servers) as Record<string, McpServerConfig>)
    : {};
  const mcpServers = mergeMcpServers(groupMcpServers);

  const parts = [COMPOSED_HEADER, '', baseInstructions(group)];
  const localFile = path.join(groupDir, 'AGENTS.local.md');
  if (!fs.existsSync(localFile)) fs.writeFileSync(localFile, '');

  const local = fs.readFileSync(localFile, 'utf8').trim();
  if (local) {
    parts.push('## Group Memory', local);
  }

  const skills = loadSelectedSkills(configRow ? parseSkillSelection(JSON.parse(configRow.skills) as unknown) : 'all');
  if (skills.length > 0) {
    parts.push('## Skills', skills.map(renderSkill).join('\n\n'));
  }

  const mcpInstructions = Object.entries(mcpServers)
    .filter(([, mcp]) => mcp.instructions)
    .map(([name, mcp]) => `### ${name}\n${mcp.instructions}`);
  if (mcpInstructions.length > 0) {
    parts.push('## MCP Tools', mcpInstructions.join('\n\n'));
  }

  writeAtomic(path.join(groupDir, 'AGENTS.md'), parts.join('\n\n') + '\n');
}

function renderSkill(skill: { name: string; description?: string; body: string }): string {
  const lines = [`### ${skill.name}`];
  if (skill.description) lines.push('', skill.description);
  lines.push('', skill.body);
  return lines.join('\n');
}

export function migrateGroupsToAgentsLocal(): void {
  if (!fs.existsSync(GROUPS_DIR)) return;

  const actions: string[] = [];
  for (const entry of fs.readdirSync(GROUPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const groupDir = path.join(GROUPS_DIR, entry.name);
    const oldLocal = path.join(groupDir, 'AGENTS.local.md');
    const local = path.join(groupDir, 'AGENTS.local.md');
    if (fs.existsSync(oldLocal) && !fs.existsSync(local)) {
      fs.renameSync(oldLocal, local);
      actions.push(`${entry.name}/AGENTS.local.md`);
    }
  }

  if (actions.length > 0) {
    log.info('Migrated group memory files', { actions });
  }
}

function baseInstructions(group: AgentGroup): string {
  return [
    `# ${group.name}`,
    '',
    'You are a host-native coding agent managed by AnotherClaw.',
    'You run directly on the user-owned host and may read or write the host filesystem according to normal OS permissions.',
    'Use the session databases only for AnotherClaw message traffic; use ordinary files and tools for project work.',
  ].join('\n');
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}
