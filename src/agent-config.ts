import fs from 'fs';
import path from 'path';

import { GROUPS_DIR } from './config.js';
import { getAgentConfig } from './db/agent-configs.js';
import { getAgentGroup } from './db/agent-groups.js';
import type { AgentConfigRow, AgentGroup } from './types.js';

const GLOBAL_MCP_CONFIG_PATH = '.mcp.json';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  instructions?: string;
}

export interface HostPathConfig {
  hostPath: string;
  readonly?: boolean;
}

export interface AgentConfig {
  mcpServers: Record<string, McpServerConfig>;
  packages: { npm: string[] };
  hostPaths: HostPathConfig[];
  skills: string[] | 'all';
  provider?: string;
  groupName?: string;
  assistantName?: string;
  agentGroupId?: string;
  maxMessagesPerPrompt?: number;
  model?: string;
  effort?: string;
}

export function loadGlobalMcpServers(
  configPath = path.join(process.cwd(), GLOBAL_MCP_CONFIG_PATH),
): Record<string, McpServerConfig> {
  if (!fs.existsSync(configPath)) return {};
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { mcpServers?: unknown };
  if (!raw.mcpServers || typeof raw.mcpServers !== 'object' || Array.isArray(raw.mcpServers)) return {};
  return raw.mcpServers as Record<string, McpServerConfig>;
}

export function mergeMcpServers(groupServers: Record<string, McpServerConfig>): Record<string, McpServerConfig> {
  return { ...loadGlobalMcpServers(), ...groupServers };
}

export function configFromDb(row: AgentConfigRow, group: AgentGroup): AgentConfig {
  const groupMcpServers = JSON.parse(row.mcp_servers) as Record<string, McpServerConfig>;
  return {
    mcpServers: mergeMcpServers(groupMcpServers),
    packages: {
      npm: JSON.parse(row.packages_npm) as string[],
    },
    hostPaths: JSON.parse(row.host_paths) as HostPathConfig[],
    skills: JSON.parse(row.skills) as string[] | 'all',
    provider: row.provider ?? undefined,
    groupName: group.name,
    assistantName: row.assistant_name ?? group.name,
    agentGroupId: group.id,
    maxMessagesPerPrompt: row.max_messages_per_prompt ?? undefined,
    model: row.model ?? undefined,
    effort: row.effort ?? undefined,
  };
}

export function materializeAgentConfig(agentGroupId: string): AgentConfig {
  const group = getAgentGroup(agentGroupId);
  if (!group) throw new Error(`Agent group not found: ${agentGroupId}`);

  const row = getAgentConfig(agentGroupId);
  if (!row) throw new Error(`Agent config not found for agent group: ${agentGroupId}`);

  const config = configFromDb(row, group);
  const p = path.join(GROUPS_DIR, group.folder, 'agent.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + '\n');
  return config;
}
