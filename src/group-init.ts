import fs from 'fs';
import path from 'path';

import { GROUPS_DIR } from './config.js';
import { ensureAgentConfig } from './db/agent-configs.js';
import { log } from './log.js';
import type { AgentGroup } from './types.js';

export function initGroupFilesystem(group: AgentGroup, opts?: { instructions?: string }): void {
  const initialized: string[] = [];
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
    initialized.push('groupDir');
  }

  const localFile = path.join(groupDir, 'AGENTS.local.md');
  if (!fs.existsSync(localFile)) {
    fs.writeFileSync(localFile, opts?.instructions ? opts.instructions + '\n' : '');
    initialized.push('AGENTS.local.md');
  }

  ensureAgentConfig(group.id);
  initialized.push('agent_configs');

  if (initialized.length > 0) {
    log.info('Initialized group filesystem', {
      group: group.name,
      folder: group.folder,
      id: group.id,
      steps: initialized,
    });
  }
}
