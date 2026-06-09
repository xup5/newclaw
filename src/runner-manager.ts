import { ChildProcess, execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { DATA_DIR, GROUPS_DIR, TIMEZONE } from './config.js';
import { materializeAgentConfig, type AgentConfig } from './agent-config.js';
import { getAgentGroup } from './db/agent-groups.js';
import { getDb, hasTable } from './db/connection.js';
import { initGroupFilesystem } from './group-init.js';
import { stopTypingRefresh } from './modules/typing/index.js';
import { log } from './log.js';
import { composeGroupAgentsMd } from './agents-md-compose.js';
import {
  heartbeatPath,
  markRunnerRunning,
  markRunnerStopped,
  sessionDir,
  writeSessionRouting,
} from './session-manager.js';
import type { AgentGroup, Session } from './types.js';

interface ActiveRunner {
  process: ChildProcess;
  name: string;
}

const activeRunners = new Map<string, ActiveRunner>();
const wakePromises = new Map<string, Promise<boolean>>();

export function getActiveRunnerCount(): number {
  return activeRunners.size;
}

export function isRunnerRunning(sessionId: string): boolean {
  return activeRunners.has(sessionId);
}

export function wakeRunner(session: Session): Promise<boolean> {
  if (activeRunners.has(session.id)) {
    log.debug('Runner already active', { sessionId: session.id });
    return Promise.resolve(true);
  }

  const existing = wakePromises.get(session.id);
  if (existing) return existing;

  const promise = spawnRunner(session)
    .then(() => true)
    .catch((err) => {
      log.warn('wakeRunner failed; host sweep will retry', { sessionId: session.id, err });
      return false;
    })
    .finally(() => {
      wakePromises.delete(session.id);
    });

  wakePromises.set(session.id, promise);
  return promise;
}

async function spawnRunner(session: Session): Promise<void> {
  const agentGroup = getAgentGroup(session.agent_group_id);
  if (!agentGroup) {
    log.error('Agent group not found', { agentGroupId: session.agent_group_id });
    return;
  }

  if (hasTable(getDb(), 'agent_destinations')) {
    const { writeDestinations } = await import('./modules/agent-to-agent/write-destinations.js');
    writeDestinations(agentGroup.id, session.id);
  }
  writeSessionRouting(agentGroup.id, session.id);

  const config = prepareRunnerFilesystem(agentGroup);
  const provider = resolveProviderName(config.provider);
  const runnerName = `anotherclaw-${agentGroup.folder}-${Date.now()}`;
  const spec = buildRunnerSpec(session, agentGroup, config, provider);

  fs.rmSync(heartbeatPath(agentGroup.id, session.id), { force: true });

  log.info('Spawning runner', { sessionId: session.id, agentGroup: agentGroup.name, runnerName, provider });
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeRunners.set(session.id, { process: child, name: runnerName });
  markRunnerRunning(session.id);

  child.stderr?.on('data', (data) => {
    for (const line of data.toString().trim().split('\n')) {
      if (line) log.debug(line, { runner: agentGroup.folder });
    }
  });
  child.stdout?.on('data', () => {});

  child.on('close', (code) => {
    activeRunners.delete(session.id);
    markRunnerStopped(session.id);
    stopTypingRefresh(session.id);
    log.info('Runner exited', { sessionId: session.id, code, runnerName });
    import('./delivery.js')
      .then(({ deliverSessionMessages }) => deliverSessionMessages(session))
      .catch((err) => log.error('Failed to deliver runner output after exit', { sessionId: session.id, err }));
  });

  child.on('error', (err) => {
    activeRunners.delete(session.id);
    markRunnerStopped(session.id);
    stopTypingRefresh(session.id);
    log.error('Runner spawn error', { sessionId: session.id, err, runnerName });
  });
}

export function killRunner(sessionId: string, reason: string, onExit?: () => void): void {
  const entry = activeRunners.get(sessionId);
  if (!entry) return;

  if (onExit) entry.process.once('close', onExit);
  log.info('Killing runner', { sessionId, reason, runnerName: entry.name });
  entry.process.kill('SIGTERM');
  setTimeout(() => {
    if (activeRunners.get(sessionId)?.process === entry.process) {
      entry.process.kill('SIGKILL');
    }
  }, 1500).unref();
}

export function resolveProviderName(configProvider: string | null | undefined): string {
  return (configProvider || 'codex').toLowerCase();
}

function prepareRunnerFilesystem(agentGroup: AgentGroup): AgentConfig {
  initGroupFilesystem(agentGroup);
  const config = materializeAgentConfig(agentGroup.id);
  composeGroupAgentsMd(agentGroup);
  fs.mkdirSync(path.join(DATA_DIR, 'v2-sessions', agentGroup.id), { recursive: true });
  return config;
}

function resolveExecutable(command: string): string {
  try {
    return execFileSync('bash', ['-lc', `command -v ${command}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    log.debug('Runner executable lookup failed', { command, err });
    throw new Error(`Runner requires "${command}" on PATH.`, { cause: err });
  }
}

function buildRunnerSpec(
  session: Session,
  agentGroup: AgentGroup,
  config: AgentConfig,
  provider: string,
): { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv } {
  const builtRunner = path.join(process.cwd(), 'dist', 'runner', 'index.js');
  const hasBuiltRunner = fs.existsSync(builtRunner);
  const command = hasBuiltRunner ? resolveExecutable('node') : resolveExecutable('tsx');
  const sessDir = sessionDir(agentGroup.id, session.id);
  const groupDir = path.resolve(GROUPS_DIR, agentGroup.folder);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TZ: TIMEZONE,
    ANOTHERCLAW_PROVIDER: provider,
    ANOTHERCLAW_MODEL: config.model,
    ANOTHERCLAW_EFFORT: config.effort,
    ANOTHERCLAW_MAX_MESSAGES_PER_PROMPT: String(config.maxMessagesPerPrompt ?? ''),
    ANOTHERCLAW_SESSION_DIR: sessDir,
    ANOTHERCLAW_AGENT_DIR: groupDir,
    ANOTHERCLAW_GLOBAL_DIR: path.join(GROUPS_DIR, 'global'),
    ANOTHERCLAW_AGENT_CONFIG_PATH: path.join(groupDir, 'agent.json'),
    ANOTHERCLAW_INBOUND_DB: path.join(sessDir, 'inbound.db'),
    ANOTHERCLAW_OUTBOUND_DB: path.join(sessDir, 'outbound.db'),
    ANOTHERCLAW_HEARTBEAT_PATH: heartbeatPath(agentGroup.id, session.id),
    ANOTHERCLAW_OUTBOX_DIR: path.join(sessDir, 'outbox'),
  };

  return {
    command,
    args: [hasBuiltRunner ? builtRunner : path.join(process.cwd(), 'src', 'runner', 'index.ts')],
    cwd: groupDir,
    env,
  };
}
