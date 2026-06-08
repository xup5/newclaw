import Database from 'better-sqlite3';
import fs from 'fs';

export interface InboundRow {
  id: string;
  kind: string;
  timestamp: string;
  content: string;
}

let inbound: Database.Database;
let outbound: Database.Database;

export function openRunnerDbs(): void {
  if (!process.env.ANOTHERCLAW_INBOUND_DB || !process.env.ANOTHERCLAW_OUTBOUND_DB) {
    throw new Error('ANOTHERCLAW_INBOUND_DB and ANOTHERCLAW_OUTBOUND_DB are required');
  }
  inbound = new Database(process.env.ANOTHERCLAW_INBOUND_DB, { readonly: true });
  outbound = new Database(process.env.ANOTHERCLAW_OUTBOUND_DB);
  outbound.pragma('journal_mode = DELETE');
  outbound.pragma('busy_timeout = 5000');
}

export function getPendingMessages(limit: number): InboundRow[] {
  return inbound
    .prepare(
      `SELECT id, kind, timestamp, content
       FROM messages_in
       WHERE status = 'pending'
         AND (process_after IS NULL OR datetime(process_after) <= datetime('now'))
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .all(limit) as InboundRow[];
}

export function markProcessing(messageId: string): void {
  outbound
    .prepare(
      `INSERT INTO processing_ack (message_id, status, status_changed)
       VALUES (?, 'processing', datetime('now'))
       ON CONFLICT(message_id) DO UPDATE SET
         status = 'processing',
         status_changed = datetime('now')`,
    )
    .run(messageId);
}

export function markDone(messageId: string, status: 'completed' | 'failed'): void {
  outbound
    .prepare(
      `INSERT INTO processing_ack (message_id, status, status_changed)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(message_id) DO UPDATE SET
         status = excluded.status,
         status_changed = excluded.status_changed`,
    )
    .run(messageId, status);
}

export function writeTextReply(inReplyTo: string, text: string): void {
  outbound
    .prepare(
      `INSERT INTO messages_out (
        id, seq, in_reply_to, timestamp, kind, content
      ) VALUES (
        @id, @seq, @in_reply_to, datetime('now'), 'chat', @content
      )`,
    )
    .run({
      id: `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      seq: nextOddSeq(),
      in_reply_to: inReplyTo,
      content: JSON.stringify({ text }),
    });
}

export function touchHeartbeat(): void {
  const heartbeat = process.env.ANOTHERCLAW_HEARTBEAT_PATH;
  if (!heartbeat) return;
  fs.closeSync(fs.openSync(heartbeat, 'a'));
  fs.utimesSync(heartbeat, new Date(), new Date());
}

function nextOddSeq(): number {
  const maxSeq = (outbound.prepare('SELECT COALESCE(MAX(seq), -1) AS m FROM messages_out').get() as { m: number }).m;
  const next = maxSeq < 1 ? 1 : maxSeq + 2;
  return next % 2 === 1 ? next : next + 1;
}
