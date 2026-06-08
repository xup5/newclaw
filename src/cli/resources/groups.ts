import type { McpServerConfig } from '../../agent-config.js';
import { getDb, hasTable } from '../../db/connection.js';
import { getSessionsByAgentGroup, getSession } from '../../db/sessions.js';
import { getAgentConfig, updateAgentConfigJson, updateAgentConfigScalars } from '../../db/agent-configs.js';
import { killRunner, wakeRunner } from '../../runner-manager.js';
import { writeSessionMessage } from '../../session-manager.js';
import { listAvailableSkills, parseSkillSelection } from '../../skills.js';
import type { AgentConfigRow } from '../../types.js';
import { registerResource } from '../crud.js';

function presentConfig(row: AgentConfigRow): Record<string, unknown> {
  return {
    agent_group_id: row.agent_group_id,
    provider: row.provider,
    model: row.model,
    effort: row.effort,
    assistant_name: row.assistant_name,
    max_messages_per_prompt: row.max_messages_per_prompt,
    skills: JSON.parse(row.skills),
    mcp_servers: JSON.parse(row.mcp_servers),
    packages_npm: JSON.parse(row.packages_npm),
    host_paths: JSON.parse(row.host_paths),
    cli_scope: row.cli_scope,
    updated_at: row.updated_at,
  };
}

registerResource({
  name: 'group',
  plural: 'groups',
  table: 'agent_groups',
  description: 'Agent group — a logical agent identity with a host workspace, provider config, memory, and sessions.',
  idColumn: 'id',
  scopeField: 'id',
  columns: [
    { name: 'id', type: 'string', description: 'UUID.', generated: true },
    {
      name: 'name',
      type: 'string',
      description: 'Display name shown in logs, help output, and channel adapters.',
      required: true,
      updatable: true,
    },
    {
      name: 'folder',
      type: 'string',
      description: 'Directory name under groups/ on the host. Contains AGENTS.md, AGENTS.local.md, and agent.json.',
      required: true,
    },
    { name: 'created_at', type: 'string', description: 'Auto-set.', generated: true },
  ],
  operations: { list: 'open', get: 'open', create: 'approval', update: 'approval' },
  customOperations: {
    delete: {
      access: 'approval',
      description: 'Delete an agent group and dependent central DB rows. Use --id <group-id>.',
      handler: async (args) => {
        const id = args.id as string;
        if (!id) throw new Error('--id is required');
        const db = getDb();
        const exists = db.prepare('SELECT 1 FROM agent_groups WHERE id = ? LIMIT 1').get(id);
        if (!exists) throw new Error(`group not found: ${id}`);

        const hasAgentDestinations = hasTable(db, 'agent_destinations');
        const hasPendingApprovals = hasTable(db, 'pending_approvals');
        const cascade = db.transaction((groupId: string) => {
          const counts = {
            sessions: 0,
            pending_questions: 0,
            pending_approvals: 0,
            agent_destinations_owned: 0,
            agent_destinations_pointing: 0,
            pending_sender_approvals: 0,
            pending_channel_approvals: 0,
            messaging_group_agents: 0,
            agent_group_members: 0,
            user_roles: 0,
            agent_configs: 0,
          };
          if (hasAgentDestinations) {
            counts.agent_destinations_owned = db
              .prepare('DELETE FROM agent_destinations WHERE agent_group_id = ?')
              .run(groupId).changes;
            counts.agent_destinations_pointing = db
              .prepare('DELETE FROM agent_destinations WHERE target_type = ? AND target_id = ?')
              .run('agent', groupId).changes;
          }
          counts.pending_questions = db
            .prepare(
              'DELETE FROM pending_questions WHERE session_id IN (SELECT id FROM sessions WHERE agent_group_id = ?)',
            )
            .run(groupId).changes;
          if (hasPendingApprovals) {
            counts.pending_approvals = db
              .prepare(
                'DELETE FROM pending_approvals WHERE agent_group_id = ? OR session_id IN (SELECT id FROM sessions WHERE agent_group_id = ?)',
              )
              .run(groupId, groupId).changes;
          }
          counts.sessions = db.prepare('DELETE FROM sessions WHERE agent_group_id = ?').run(groupId).changes;
          counts.pending_sender_approvals = db
            .prepare('DELETE FROM pending_sender_approvals WHERE agent_group_id = ?')
            .run(groupId).changes;
          counts.pending_channel_approvals = db
            .prepare('DELETE FROM pending_channel_approvals WHERE agent_group_id = ?')
            .run(groupId).changes;
          counts.messaging_group_agents = db
            .prepare('DELETE FROM messaging_group_agents WHERE agent_group_id = ?')
            .run(groupId).changes;
          counts.agent_group_members = db
            .prepare('DELETE FROM agent_group_members WHERE agent_group_id = ?')
            .run(groupId).changes;
          counts.user_roles = db.prepare('DELETE FROM user_roles WHERE agent_group_id = ?').run(groupId).changes;
          counts.agent_configs = db.prepare('DELETE FROM agent_configs WHERE agent_group_id = ?').run(groupId).changes;
          db.prepare('DELETE FROM agent_groups WHERE id = ?').run(groupId);
          return counts;
        });
        return { deleted: id, removed: cascade(id) };
      },
    },
    restart: {
      access: 'approval',
      description: 'Restart active runners for a group. Use --id <group-id> [--message <text>].',
      handler: async (args, ctx) => {
        const id = (args.id as string) || (ctx.caller === 'agent' ? ctx.agentGroupId : undefined);
        if (!id) throw new Error('--id is required');
        const message = args.message as string | undefined;

        if (ctx.caller === 'agent') {
          if (message) writeWakeMessage(id, ctx.sessionId, message);
          killRunner(ctx.sessionId, 'restarted via ncl', message ? () => wakeOwnSession(ctx.sessionId) : undefined);
          return { restarted: 1 };
        }

        let restarted = 0;
        for (const session of getSessionsByAgentGroup(id)) {
          if (message) writeWakeMessage(id, session.id, message);
          killRunner(session.id, 'restarted via ncl', message ? () => wakeOwnSession(session.id) : undefined);
          restarted += 1;
        }
        return { restarted };
      },
    },
    'config get': {
      access: 'open',
      description: 'Show the agent config for a group. Use --id <group-id>.',
      handler: async (args) => {
        const id = args.id as string;
        if (!id) throw new Error('--id is required');
        const row = getAgentConfig(id);
        if (!row) throw new Error(`No agent config for group: ${id}`);
        return presentConfig(row);
      },
    },
    'config update': {
      access: 'approval',
      description:
        'Update agent config scalar fields. Use --id <group-id> and any of: --provider, --model, --effort, --assistant-name, --max-messages-per-prompt, --cli-scope.',
      handler: async (args) => {
        const id = args.id as string;
        if (!id) throw new Error('--id is required');
        const row = getAgentConfig(id);
        if (!row) throw new Error(`No agent config for group: ${id}`);

        const updates: Partial<
          Pick<
            AgentConfigRow,
            'provider' | 'model' | 'effort' | 'assistant_name' | 'max_messages_per_prompt' | 'cli_scope'
          >
        > = {};
        if (args.provider !== undefined) updates.provider = args.provider as string;
        if (args.model !== undefined) updates.model = args.model as string;
        if (args.effort !== undefined) updates.effort = args.effort as string;
        if (args.assistant_name !== undefined) updates.assistant_name = args.assistant_name as string;
        if (args.max_messages_per_prompt !== undefined)
          updates.max_messages_per_prompt = Number(args.max_messages_per_prompt);
        if (args['cli-scope'] !== undefined || args.cli_scope !== undefined) {
          const scope = (args['cli-scope'] ?? args.cli_scope) as string;
          if (!['disabled', 'group', 'global'].includes(scope)) {
            throw new Error('--cli-scope must be one of: disabled, group, global');
          }
          updates.cli_scope = scope;
        }
        if (Object.keys(updates).length === 0) throw new Error('Nothing to update.');
        updateAgentConfigScalars(id, updates);
        return presentConfig(getAgentConfig(id)!);
      },
    },
    'config list-skills': {
      access: 'open',
      description: 'List bundled skills available to agent groups.',
      handler: async () => {
        return listAvailableSkills().map((skill) => ({
          name: skill.name,
          description: skill.description ?? '',
          file: skill.filePath,
        }));
      },
    },
    'config set-skills': {
      access: 'approval',
      description:
        'Set skills for a group. Use --id <group-id> --skills all, --skills \'["discord"]\', or --skills discord,welcome.',
      handler: async (args) => {
        const id = args.id as string;
        const rawSkills = args.skills as string;
        if (!id || !rawSkills) throw new Error('--id and --skills are required');
        const row = getAgentConfig(id);
        if (!row) throw new Error(`No agent config for group: ${id}`);

        const skills = parseSkillsArg(rawSkills);
        updateAgentConfigJson(id, 'skills', skills);
        return { agent_group_id: id, skills };
      },
    },
    'config add-mcp-server': {
      access: 'approval',
      description:
        'Add an MCP server to a group. Use --id <group-id> --name <server-name> --command <cmd> [--args <json-array>] [--env <json-object>].',
      handler: async (args) => {
        const id = args.id as string;
        const name = args.name as string;
        const command = args.command as string;
        if (!id || !name || !command) throw new Error('--id, --name, and --command are required');
        const row = getAgentConfig(id);
        if (!row) throw new Error(`No agent config for group: ${id}`);
        const servers = JSON.parse(row.mcp_servers) as Record<string, McpServerConfig>;
        servers[name] = {
          command,
          args: args.args ? (JSON.parse(args.args as string) as string[]) : [],
          env: args.env ? (JSON.parse(args.env as string) as Record<string, string>) : {},
        };
        updateAgentConfigJson(id, 'mcp_servers', servers);
        return { added: name, servers };
      },
    },
    'config remove-mcp-server': {
      access: 'approval',
      description: 'Remove an MCP server from a group. Use --id <group-id> --name <server-name>.',
      handler: async (args) => {
        const id = args.id as string;
        const name = args.name as string;
        if (!id || !name) throw new Error('--id and --name are required');
        const row = getAgentConfig(id);
        if (!row) throw new Error(`No agent config for group: ${id}`);
        const servers = JSON.parse(row.mcp_servers) as Record<string, McpServerConfig>;
        if (!servers[name]) throw new Error(`MCP server "${name}" not found`);
        delete servers[name];
        updateAgentConfigJson(id, 'mcp_servers', servers);
        return { removed: name };
      },
    },
  },
});

function parseSkillsArg(raw: string): 'all' | string[] {
  const trimmed = raw.trim();
  if (trimmed === 'all') return 'all';
  if (trimmed.startsWith('[')) return parseSkillSelection(JSON.parse(trimmed));
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function writeWakeMessage(agentGroupId: string, sessionId: string, text: string): void {
  writeSessionMessage(agentGroupId, sessionId, {
    id: `restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: agentGroupId,
    channelType: 'agent',
    threadId: null,
    content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
    onWake: 1,
  });
}

function wakeOwnSession(sessionId: string): void {
  const session = getSession(sessionId);
  if (session) wakeRunner(session).catch(() => {});
}
