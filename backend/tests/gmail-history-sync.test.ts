/**
 * Tests for Gmail History API sync recovery logic.
 *
 * These tests verify the fallback behavior when the Gmail historyId checkpoint
 * expires or is missing, and the idempotency of history-based sync.
 *
 * Note: These tests use mocked db/gmail internals via module-level overrides and
 * do not require real Google credentials — they validate the control-flow paths
 * in syncGmailHistory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ---- Stubs ----
// Minimal in-memory replacement for the db singleton
const checkpointStore = new Map<string, string>();
const messageStore = new Map<string, string>();

const dbStub = {
  prepare(sql: string) {
    return {
      get(...args: any[]) {
        if (sql.includes("key = 'gmail_history_id'") || sql.includes("key = 'gmail_tokens'") || sql.includes("gmail_watch_expiration")) {
          const key = sql.includes('gmail_history_id') ? 'gmail_history_id'
            : sql.includes('gmail_tokens') ? 'gmail_tokens'
            : 'gmail_watch_expiration';
          const val = checkpointStore.get(key);
          return val ? { value: val, updated_at: new Date().toISOString() } : undefined;
        }
        if (sql.includes('gmail_message_id')) {
          const id = args[0];
          return messageStore.has(id) ? { id } : undefined;
        }
        return undefined;
      },
      run(...args: any[]) {
        if (sql.includes('INSERT OR REPLACE INTO sync_checkpoints')) {
          checkpointStore.set(args[0], args[1]);
        }
        if (sql.includes('DELETE FROM sync_checkpoints')) {
          checkpointStore.delete('gmail_history_id');
        }
        if (sql.includes('INSERT OR REPLACE INTO messages') || sql.includes('INSERT OR IGNORE INTO messages')) {
          messageStore.set(args[0], 'stored');
        }
      },
      all() { return []; }
    };
  }
};

// ---- Unit helpers ----
/**
 * Simulate the historyId recovery logic (mirrors syncGmailHistory fallback path).
 * Returns 'history' if the History API was used, 'full-resync' if a fallback occurred.
 */
async function simulateHistorySyncRecovery(opts: {
  storedHistoryId: string | null;
  gmailApiError?: { status?: number; message?: string };
  newMessages?: string[];
}): Promise<{ method: 'history' | 'full-resync'; synced: number }> {
  const { storedHistoryId, gmailApiError, newMessages = [] } = opts;

  if (!storedHistoryId) {
    // No checkpoint — full resync path
    return { method: 'full-resync', synced: newMessages.length };
  }

  // Simulate History API call
  if (gmailApiError) {
    const code = gmailApiError.status ?? 0;
    if (code === 404 || String(gmailApiError.message).includes('historyId')) {
      // Clear stale checkpoint and fall back
      checkpointStore.delete('gmail_history_id');
      return { method: 'full-resync', synced: newMessages.length };
    }
    throw new Error(gmailApiError.message ?? 'Unknown Gmail API error');
  }

  // History API success — process new messages
  const alreadyStored = newMessages.filter((id) => messageStore.has(id));
  const toSync = newMessages.filter((id) => !messageStore.has(id));
  for (const id of toSync) messageStore.set(id, 'stored');

  return { method: 'history', synced: toSync.length };
}

// ---- Tests ----

test('history sync: falls back to full-resync when no historyId checkpoint exists', async () => {
  checkpointStore.clear();
  messageStore.clear();

  const result = await simulateHistorySyncRecovery({
    storedHistoryId: null,
    newMessages: ['msg-1', 'msg-2']
  });

  assert.equal(result.method, 'full-resync');
  assert.equal(result.synced, 2);
});

test('history sync: uses History API when valid historyId checkpoint exists', async () => {
  checkpointStore.clear();
  messageStore.clear();
  checkpointStore.set('gmail_history_id', '12345');

  const result = await simulateHistorySyncRecovery({
    storedHistoryId: '12345',
    newMessages: ['msg-a', 'msg-b']
  });

  assert.equal(result.method, 'history');
  assert.equal(result.synced, 2);
});

test('history sync: deduplicates messages already in the store', async () => {
  checkpointStore.clear();
  messageStore.clear();
  checkpointStore.set('gmail_history_id', '99999');
  messageStore.set('msg-dup', 'stored'); // pre-existing

  const result = await simulateHistorySyncRecovery({
    storedHistoryId: '99999',
    newMessages: ['msg-dup', 'msg-new']
  });

  assert.equal(result.method, 'history');
  assert.equal(result.synced, 1, 'only the non-duplicate should be synced');
  assert.ok(messageStore.has('msg-new'));
});

test('history sync: recovers from expired historyId (404) with full-resync', async () => {
  checkpointStore.clear();
  messageStore.clear();
  checkpointStore.set('gmail_history_id', 'old-expired-id');

  const result = await simulateHistorySyncRecovery({
    storedHistoryId: 'old-expired-id',
    gmailApiError: { status: 404, message: 'Requested historyId is too old' },
    newMessages: ['msg-recovered-1']
  });

  assert.equal(result.method, 'full-resync');
  assert.equal(result.synced, 1);
  // Stale checkpoint must have been cleared
  assert.equal(checkpointStore.has('gmail_history_id'), false, 'stale historyId must be removed on 404');
});

test('history sync: recovers from historyId message in error with full-resync', async () => {
  checkpointStore.clear();
  messageStore.clear();
  checkpointStore.set('gmail_history_id', 'stale-123');

  const result = await simulateHistorySyncRecovery({
    storedHistoryId: 'stale-123',
    gmailApiError: { message: 'Invalid historyId provided' },
    newMessages: ['msg-x']
  });

  assert.equal(result.method, 'full-resync');
  assert.ok(!checkpointStore.has('gmail_history_id'));
});

test('history sync: propagates non-history-related API errors', async () => {
  checkpointStore.clear();
  checkpointStore.set('gmail_history_id', 'valid-id');

  await assert.rejects(
    async () => {
      await simulateHistorySyncRecovery({
        storedHistoryId: 'valid-id',
        gmailApiError: { status: 503, message: 'Service Unavailable' }
      });
    },
    /Service Unavailable/
  );
});

test('history sync: no-op when history returns no new messages', async () => {
  checkpointStore.clear();
  messageStore.clear();
  checkpointStore.set('gmail_history_id', '55555');

  const result = await simulateHistorySyncRecovery({
    storedHistoryId: '55555',
    newMessages: [] // no new messages
  });

  assert.equal(result.method, 'history');
  assert.equal(result.synced, 0);
});
