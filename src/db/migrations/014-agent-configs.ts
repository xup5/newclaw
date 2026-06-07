import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration014: Migration = {
  version: 14,
  name: 'agent-configs',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE agent_configs (
        agent_group_id        TEXT PRIMARY KEY REFERENCES agent_groups(id) ON DELETE CASCADE,
        provider              TEXT,
        model                 TEXT,
        effort                TEXT,
        assistant_name        TEXT,
        max_messages_per_prompt INTEGER,
        skills                TEXT NOT NULL DEFAULT '"all"',
        mcp_servers           TEXT NOT NULL DEFAULT '{}',
        packages_npm          TEXT NOT NULL DEFAULT '[]',
        host_paths            TEXT NOT NULL DEFAULT '[]',
        cli_scope             TEXT NOT NULL DEFAULT 'group',
        updated_at            TEXT NOT NULL
      );
    `);
  },
};
