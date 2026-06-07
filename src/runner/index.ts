import { buildPrompt } from './format.js';
import { getProvider } from './providers.js';
import { getPendingMessages, markDone, markProcessing, openRunnerDbs, touchHeartbeat, writeTextReply } from './db.js';

async function main(): Promise<void> {
  openRunnerDbs();
  touchHeartbeat();

  const limit = Math.max(1, Number(process.env.NEWCLAW_MAX_MESSAGES_PER_PROMPT) || 10);
  const messages = getPendingMessages(limit);
  if (messages.length === 0) return;

  for (const message of messages) markProcessing(message.id);

  try {
    const provider = getProvider(process.env.NEWCLAW_PROVIDER || 'codex');
    const text = await provider.run({
      prompt: buildPrompt(messages),
      cwd: process.env.NEWCLAW_AGENT_DIR || process.cwd(),
      model: process.env.NEWCLAW_MODEL || undefined,
      effort: process.env.NEWCLAW_EFFORT || undefined,
    });
    writeTextReply(messages[messages.length - 1].id, text || '(no response)');
    for (const message of messages) markDone(message.id, 'completed');
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    writeTextReply(messages[messages.length - 1].id, `Runner failed: ${text}`);
    for (const message of messages) markDone(message.id, 'failed');
  } finally {
    touchHeartbeat();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
