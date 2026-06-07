import type { AgentConfigRow } from '../types.js';
import { getDb } from './connection.js';

const SCALAR_COLUMNS = new Set([
  'provider',
  'model',
  'effort',
  'assistant_name',
  'max_messages_per_prompt',
  'cli_scope',
]);
const JSON_COLUMNS = new Set(['skills', 'mcp_servers', 'packages_npm', 'host_paths']);

export function getAgentConfig(agentGroupId: string): AgentConfigRow | undefined {
  return getDb().prepare('SELECT * FROM agent_configs WHERE agent_group_id = ?').get(agentGroupId) as
    | AgentConfigRow
    | undefined;
}

export function getAllAgentConfigs(): AgentConfigRow[] {
  return getDb().prepare('SELECT * FROM agent_configs').all() as AgentConfigRow[];
}

export function createAgentConfig(config: AgentConfigRow): void {
  getDb()
    .prepare(
      `INSERT INTO agent_configs (
        agent_group_id, provider, model, effort, assistant_name,
        max_messages_per_prompt, skills, mcp_servers, packages_npm,
        host_paths, cli_scope, updated_at
      ) VALUES (
        @agent_group_id, @provider, @model, @effort, @assistant_name,
        @max_messages_per_prompt, @skills, @mcp_servers, @packages_npm,
        @host_paths, @cli_scope, @updated_at
      )`,
    )
    .run(config);
}

export function ensureAgentConfig(agentGroupId: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO agent_configs (agent_group_id, updated_at)
       VALUES (?, ?)`,
    )
    .run(agentGroupId, new Date().toISOString());
}

export function updateAgentConfigScalars(
  agentGroupId: string,
  updates: Partial<
    Pick<AgentConfigRow, 'provider' | 'model' | 'effort' | 'assistant_name' | 'max_messages_per_prompt' | 'cli_scope'>
  >,
): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { agent_group_id: agentGroupId };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (!SCALAR_COLUMNS.has(key)) throw new Error(`Invalid scalar column: ${key}`);
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;

  fields.push('updated_at = @updated_at');
  values.updated_at = new Date().toISOString();
  getDb()
    .prepare(`UPDATE agent_configs SET ${fields.join(', ')} WHERE agent_group_id = @agent_group_id`)
    .run(values);
}

export function updateAgentConfigJson(
  agentGroupId: string,
  column: 'skills' | 'mcp_servers' | 'packages_npm' | 'host_paths',
  value: unknown,
): void {
  if (!JSON_COLUMNS.has(column)) throw new Error(`Invalid JSON column: ${column}`);
  getDb()
    .prepare(`UPDATE agent_configs SET ${column} = ?, updated_at = ? WHERE agent_group_id = ?`)
    .run(JSON.stringify(value), new Date().toISOString(), agentGroupId);
}

export function deleteAgentConfig(agentGroupId: string): void {
  getDb().prepare('DELETE FROM agent_configs WHERE agent_group_id = ?').run(agentGroupId);
}
