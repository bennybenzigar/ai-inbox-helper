import { google, type Auth } from 'googleapis';
import { env } from '../config/env';
import { query } from '../database/database';
import { classifyIntent } from './intent.service';
import { createAIProvider } from './ai.service';
import { publishEvent } from './event-bus.service';
import { newId } from '../utils/ids';
import type { InboxRepository } from '../repositories/inbox.repository';
import type { Draft, Message } from '../models/types';

/** OAuth/Gmail adapter. */
export function createGoogleOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
}

export function gmailConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function gmailScopes(): string[] {
  return [
    'openid',
    'email',
    'https://www.googleapis.com/auth/gmail.readonly'
  ];
}

let cachedTokens: Auth.Credentials | null = null;
let cachedEmail: string | null = null;
let cachedLastSynced: string | null = null;
let cachedHistoryId: string | null = null;
let cachedWatchExpiration: string | null = null;

export async function initGmailService(): Promise<void> {
  try {
    const tokenRows = await query<{ value: string }>('SELECT value FROM connection_metadata WHERE key = $1', ['gmail_tokens']);
    if (tokenRows[0]?.value) {
      try { cachedTokens = JSON.parse(tokenRows[0].value); } catch {}
    }

    const emailRows = await query<{ value: string }>('SELECT value FROM connection_metadata WHERE key = $1', ['gmail_connected_email']);
    if (emailRows[0]?.value) cachedEmail = emailRows[0].value;

    const syncRows = await query<{ updated_at: string }>('SELECT updated_at FROM sync_checkpoints WHERE key = $1', ['gmail_last_synced']);
    if (syncRows[0]?.updated_at) cachedLastSynced = syncRows[0].updated_at;

    const histRows = await query<{ value: string }>('SELECT value FROM sync_checkpoints WHERE key = $1', ['gmail_history_id']);
    if (histRows[0]?.value) cachedHistoryId = histRows[0].value;

    const watchRows = await query<{ value: string }>('SELECT value FROM sync_checkpoints WHERE key = $1', ['gmail_watch_expiration']);
    if (watchRows[0]?.value) cachedWatchExpiration = watchRows[0].value;
  } catch (err) {
    console.warn('Note: Could not preload Gmail metadata from PostgreSQL yet:', err instanceof Error ? err.message : err);
  }
}

export function storeGmailTokens(tokens: Auth.Credentials, email?: string): void {
  cachedTokens = tokens;
  if (email) cachedEmail = email;
  const now = new Date().toISOString();
  query(
    `INSERT INTO connection_metadata(key, value, updated_at) VALUES($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    ['gmail_tokens', JSON.stringify(tokens), now]
  ).catch((err) => console.error('Failed to store Gmail tokens:', err));

  if (email) {
    query(
      `INSERT INTO connection_metadata(key, value, updated_at) VALUES($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      ['gmail_connected_email', email, now]
    ).catch((err) => console.error('Failed to store Gmail email:', err));
  }
}

export function getStoredGmailTokens(): Auth.Credentials | null {
  return cachedTokens;
}

export function isGmailConnected(): boolean {
  return Boolean(cachedTokens && (cachedTokens.access_token || cachedTokens.refresh_token));
}

export function getConnectedEmail(): string | null {
  return cachedEmail;
}

export function getLastSyncedAt(): string | null {
  return cachedLastSynced;
}

export function clearStoredGmailTokens(): void {
  cachedTokens = null;
  cachedEmail = null;
  query("DELETE FROM connection_metadata WHERE key LIKE 'gmail_%'").catch((err) => console.error(err));
}

export function getAuthenticatedOAuthClient(): any {
  const tokens = getStoredGmailTokens();
  if (!tokens) return null;
  const oauth = createGoogleOAuthClient();
  oauth.setCredentials(tokens);
  oauth.on('tokens', (newTokens) => {
    storeGmailTokens({ ...tokens, ...newTokens });
  });
  return oauth;
}

/** Returns the stored Gmail history ID checkpoint, or null if not set. */
function getStoredHistoryId(): string | null {
  return cachedHistoryId;
}

/** Saves a new Gmail history ID checkpoint. */
function saveHistoryId(historyId: string): void {
  cachedHistoryId = historyId;
  const now = new Date().toISOString();
  query(
    `INSERT INTO sync_checkpoints (key, value, updated_at) VALUES($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    ['gmail_history_id', historyId, now]
  ).catch((err) => console.error('Failed to save history ID:', err));
}

/**
 * Process new messages using the Gmail History API, starting from the stored
 * historyId checkpoint. Falls back to a full re-sync if the historyId is
 * expired or missing.
 *
 * This is idempotent — messages already in the DB are skipped.
 */
export async function syncGmailHistory(repo: InboxRepository): Promise<{ synced: number; method: 'history' | 'full-resync' }> {
  const auth = getAuthenticatedOAuthClient();
  if (!auth) throw new Error('Gmail is not connected. Authorize Gmail first.');

  const storedHistoryId = getStoredHistoryId();

  if (!storedHistoryId) {
    // No checkpoint — perform a full re-sync and establish the history ID
    const result = await syncGmailMessages(repo, 20);
    return { synced: result.synced, method: 'full-resync' };
  }

  const gmail = google.gmail({ version: 'v1', auth: auth as any });

  try {
    const historyRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: storedHistoryId,
      historyTypes: ['messageAdded']
    });

    const historyRecords = historyRes.data.history || [];
    let synced = 0;
    const aiProvider = createAIProvider();

    for (const record of historyRecords) {
      const added = record.messagesAdded || [];
      for (const item of added) {
        const msgRef = item.message;
        if (!msgRef?.id) continue;

        // Deduplication: skip if already stored
        const existing = await query('SELECT id FROM messages WHERE gmail_message_id = $1', [msgRef.id]);
        if (existing.length > 0) continue;

        try {
          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msgRef.id,
            format: 'full'
          });

          const parsed = parseGmailPayload(full.data);
          const { intent, confidence } = classifyIntent(parsed.subject, parsed.body);
          const msgId = newId();

          const message: Message = {
            id: msgId,
            source: 'gmail',
            senderName: parsed.senderName,
            senderEmail: parsed.senderEmail,
            subject: parsed.subject,
            body: parsed.body,
            receivedAt: parsed.receivedAt,
            intent,
            confidence,
            status: 'pending',
            gmailMessageId: parsed.gmailMessageId,
            hasAttachments: parsed.hasAttachments
          };

          await repo.insertMessage(message);

          const draftBody = await aiProvider.generateDraft(message);
          const now = new Date().toISOString();
          const draft: Draft = {
            id: newId(),
            messageId: msgId,
            body: draftBody,
            status: 'pending',
            isMock: aiProvider.name === 'mock',
            version: 1,
            createdAt: now,
            updatedAt: now,
            reviewedAt: null
          };

          await repo.insertDraft(draft);
          synced++;
        } catch (err) {
          console.warn(`Failed to process Gmail history message ${msgRef.id}:`, err instanceof Error ? err.message : err);
        }
      }
    }

    // Advance the history checkpoint
    const newHistoryId = historyRes.data.historyId;
    if (newHistoryId) saveHistoryId(newHistoryId);

    if (synced > 0) {
      await repo.addActivity('gmail-history-sync', `Processed ${synced} new messages via Gmail History API`);
      publishEvent('messages-updated', { synced, source: 'gmail-history' });
    }

    return { synced, method: 'history' };
  } catch (err: any) {
    // History ID expired (404) or invalid — fall back to full re-sync
    const code = err?.response?.status ?? err?.code;
    if (code === 404 || String(err?.message).includes('historyId')) {
      console.warn('Gmail historyId expired or invalid — performing full re-sync for recovery.');
      // Clear stale checkpoint before re-sync so we establish a fresh one
      await query("DELETE FROM sync_checkpoints WHERE key = 'gmail_history_id'");
      const result = await syncGmailMessages(repo, 20);
      return { synced: result.synced, method: 'full-resync' };
    }
    throw err;
  }
}

export async function syncGmailMessages(repo: InboxRepository, maxResults = 20): Promise<{ synced: number; total: number }> {
  const auth = getAuthenticatedOAuthClient();
  if (!auth) {
    throw new Error('Gmail is not connected. Authorize Gmail first.');
  }

  const gmail = google.gmail({ version: 'v1', auth: auth as any });
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults
  });

  const messageList = listRes.data.messages || [];
  let synced = 0;
  const aiProvider = createAIProvider();

  for (const mRef of messageList) {
    if (!mRef.id) continue;
    const existing = await query('SELECT id FROM messages WHERE gmail_message_id = $1', [mRef.id]);
    if (existing.length > 0) continue;

    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: mRef.id,
        format: 'full'
      });

      const parsed = parseGmailPayload(full.data);
      const { intent, confidence } = classifyIntent(parsed.subject, parsed.body);
      const msgId = newId();

      const message: Message = {
        id: msgId,
        source: 'gmail',
        senderName: parsed.senderName,
        senderEmail: parsed.senderEmail,
        subject: parsed.subject,
        body: parsed.body,
        receivedAt: parsed.receivedAt,
        intent,
        confidence,
        status: 'pending',
        gmailMessageId: parsed.gmailMessageId,
        hasAttachments: parsed.hasAttachments
      };

      await repo.insertMessage(message);

      const draftBody = await aiProvider.generateDraft(message);
      const now = new Date().toISOString();
      const draft: Draft = {
        id: newId(),
        messageId: msgId,
        body: draftBody,
        status: 'pending',
        isMock: aiProvider.name === 'mock',
        version: 1,
        createdAt: now,
        updatedAt: now,
        reviewedAt: null
      };

      await repo.insertDraft(draft);
      synced++;
    } catch (err) {
      console.warn(`Failed to process Gmail message ${mRef.id}:`, err instanceof Error ? err.message : err);
    }
  }

  const now = new Date().toISOString();
  cachedLastSynced = now;
  await query(
    `INSERT INTO sync_checkpoints (key, value, updated_at) VALUES($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    ['gmail_last_synced', String(synced), now]
  );

  if (synced > 0) {
    await repo.addActivity('gmail-sync', `Synced ${synced} candidate messages from Gmail`);
    publishEvent('messages-updated', { synced, source: 'gmail' });
  }

  const allMessages = await repo.listMessages();
  return { synced, total: allMessages.length };
}

export async function setupGmailWatch(): Promise<{ historyId?: string; expiration?: string } | null> {
  const auth = getAuthenticatedOAuthClient();
  if (!auth || !env.PUBSUB_TOPIC_NAME) return null;

  try {
    const gmail = google.gmail({ version: 'v1', auth: auth as any });
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: env.PUBSUB_TOPIC_NAME
      }
    });

    const now = new Date().toISOString();
    if (res.data.historyId) {
      saveHistoryId(res.data.historyId);
    }

    // Store watch expiration so we can renew before it expires (7 days max)
    if (res.data.expiration) {
      cachedWatchExpiration = res.data.expiration;
      await query(
        `INSERT INTO sync_checkpoints (key, value, updated_at) VALUES($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        ['gmail_watch_expiration', res.data.expiration, now]
      );
    }

    return {
      historyId: res.data.historyId ?? undefined,
      expiration: res.data.expiration ?? undefined
    };
  } catch (err) {
    console.warn('Gmail watch setup failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Renews the Gmail watch if it is expiring within the next 24 hours.
 * Safe to call on a schedule (e.g., daily cron).
 */
export async function renewGmailWatchIfNeeded(): Promise<void> {
  let expirationVal = cachedWatchExpiration;
  if (!expirationVal) {
    const rows = await query<{ value: string }>('SELECT value FROM sync_checkpoints WHERE key = $1', ['gmail_watch_expiration']);
    expirationVal = rows[0]?.value ?? null;
  }
  if (!expirationVal) return;

  const expiration = Number(expirationVal);
  const twentyFourHoursFromNow = Date.now() + 24 * 60 * 60 * 1000;

  if (expiration <= twentyFourHoursFromNow) {
    console.log('Gmail watch expiring soon — renewing...');
    await setupGmailWatch();
  }
}

function parseGmailPayload(data: any) {
  const headers = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const from = getHeader('From');
  const subject = getHeader('Subject') || '(No Subject)';
  const dateStr = getHeader('Date');
  const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

  let senderName = 'Unknown sender';
  let senderEmail = 'unknown@example.com';
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    senderName = match[1].replace(/^["']|["']$/g, '').trim() || match[2];
    senderEmail = match[2].trim();
  } else if (from) {
    senderName = from.split('@')[0];
    senderEmail = from.trim();
  }

  let body = '';
  if (data.payload?.body?.data) {
    body = Buffer.from(data.payload.body.data, 'base64').toString('utf8');
  } else if (data.payload?.parts) {
    const textPart =
      data.payload.parts.find((p: any) => p.mimeType === 'text/plain') || data.payload.parts[0];
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
    }
  }
  if (!body) {
    body = data.snippet || '(No message content)';
  }

  const hasAttachments = Boolean(
    data.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)
  );

  return {
    gmailMessageId: data.id,
    senderName,
    senderEmail,
    subject,
    body: body.trim(),
    receivedAt,
    hasAttachments
  };
}

/** Sends an approved response via Gmail API if connected, or records simulated send. */
export async function sendGmailReply(
  message: Message,
  draft: Draft
): Promise<{ sent: boolean; simulated: boolean; messageId?: string }> {
  const auth = getAuthenticatedOAuthClient();
  if (!auth) {
    return { sent: true, simulated: true };
  }
  try {
    const gmail = google.gmail({ version: 'v1', auth: auth as any });
    const userEmail = getConnectedEmail() || 'me';
    const utf8Subject = `=?utf-8?B?${Buffer.from(`Re: ${message.subject.replace(/^Re:\s*/i, '')}`).toString('base64')}?=`;
    const emailLines = [
      `From: ${userEmail}`,
      `To: ${message.senderEmail}`,
      `Subject: ${utf8Subject}`,
      ...(message.gmailMessageId ? [
        `In-Reply-To: <${message.gmailMessageId}>`,
        `References: <${message.gmailMessageId}>`
      ] : []),
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      draft.body
    ];
    const raw = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        ...(message.gmailMessageId ? { threadId: message.gmailMessageId } : {})
      }
    });
    return { sent: true, simulated: false, messageId: res.data.id ?? undefined };
  } catch (err) {
    console.warn('Real Gmail send failed (falling back to simulated sent):', err);
    return { sent: true, simulated: true };
  }
}
