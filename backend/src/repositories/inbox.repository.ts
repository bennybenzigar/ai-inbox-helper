import { pool, query } from '../database/database';
import type { Activity, Draft, DraftStatus, Intent, Message, OutboxItem, SourceType } from '../models/types';
import { newId } from '../utils/ids';

type MessageRow = {
  id: string;
  source: SourceType;
  sender_name: string;
  sender_email: string;
  subject: string;
  body: string;
  received_at: string;
  intent: Intent;
  confidence: number;
  status: Message['status'];
  gmail_message_id: string | null;
  has_attachments: number;
};

type DraftRow = {
  id: string;
  message_id: string;
  body: string;
  status: DraftStatus;
  is_mock: number;
  version: number;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

const mapMessage = (r: MessageRow): Message => ({
  id: r.id,
  source: r.source,
  senderName: r.sender_name,
  senderEmail: r.sender_email,
  subject: r.subject,
  body: r.body,
  receivedAt: r.received_at,
  intent: r.intent,
  confidence: Number(r.confidence),
  status: r.status,
  gmailMessageId: r.gmail_message_id ?? undefined,
  hasAttachments: !!r.has_attachments
});

const mapDraft = (r: DraftRow): Draft => ({
  id: r.id,
  messageId: r.message_id,
  body: r.body,
  status: r.status,
  isMock: !!r.is_mock,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  reviewedAt: r.reviewed_at
});

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MessageFilters {
  q?: string;
  intent?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface OutboxFilters {
  q?: string;
  intent?: string;
  page?: number;
  limit?: number;
}

export class InboxRepository {
  async listMessages(): Promise<Message[]> {
    const rows = await query<MessageRow>(
      "SELECT * FROM messages WHERE source != 'demo' ORDER BY received_at DESC"
    );
    return rows.map(mapMessage);
  }

  async listMessagesPaginated(filters: MessageFilters = {}): Promise<PaginatedResult<Message>> {
    const { q, intent, status, page = 1, limit = 10 } = filters;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const conditions: string[] = ["source != 'demo'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (q && q.trim()) {
      conditions.push(
        `(LOWER(sender_name) LIKE $${paramIndex} OR LOWER(sender_email) LIKE $${paramIndex} OR LOWER(subject) LIKE $${paramIndex} OR LOWER(body) LIKE $${paramIndex})`
      );
      params.push(`%${q.trim().toLowerCase()}%`);
      paramIndex++;
    }
    if (intent && intent !== 'all') {
      conditions.push(`intent = $${paramIndex}`);
      params.push(intent);
      paramIndex++;
    }
    if (status && status !== 'all') {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countRows = await query<{ count: string }>(`SELECT COUNT(*) as count FROM messages ${where}`, params);
    const total = parseInt(countRows[0]?.count ?? '0', 10);

    // Get paginated items
    const offset = Math.max(0, (safePage - 1) * safeLimit);
    const dataRows = await query<MessageRow>(
      `SELECT * FROM messages ${where} ORDER BY received_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, safeLimit, offset]
    );

    return {
      items: dataRows.map(mapMessage),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  async listMessagesFiltered(filters: MessageFilters = {}): Promise<Message[]> {
    const { q, intent, status } = filters;
    const conditions: string[] = ["source != 'demo'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (q && q.trim()) {
      conditions.push(
        `(LOWER(sender_name) LIKE $${paramIndex} OR LOWER(sender_email) LIKE $${paramIndex} OR LOWER(subject) LIKE $${paramIndex} OR LOWER(body) LIKE $${paramIndex})`
      );
      params.push(`%${q.trim().toLowerCase()}%`);
      paramIndex++;
    }
    if (intent && intent !== 'all') {
      conditions.push(`intent = $${paramIndex}`);
      params.push(intent);
      paramIndex++;
    }
    if (status && status !== 'all') {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<MessageRow>(
      `SELECT * FROM messages ${where} ORDER BY received_at DESC`,
      params
    );
    return rows.map(mapMessage);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const rows = await query<MessageRow>('SELECT * FROM messages WHERE id = $1', [id]);
    return rows[0] ? mapMessage(rows[0]) : undefined;
  }

  async listDrafts(): Promise<Draft[]> {
    const rows = await query<DraftRow>(
      "SELECT * FROM drafts WHERE message_id IN (SELECT id FROM messages WHERE source != 'demo') ORDER BY updated_at DESC"
    );
    return rows.map(mapDraft);
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const rows = await query<DraftRow>('SELECT * FROM drafts WHERE id = $1', [id]);
    return rows[0] ? mapDraft(rows[0]) : undefined;
  }

  async getDraftForMessage(id: string): Promise<Draft | undefined> {
    const rows = await query<DraftRow>('SELECT * FROM drafts WHERE message_id = $1', [id]);
    return rows[0] ? mapDraft(rows[0]) : undefined;
  }

  async listOutbox(): Promise<OutboxItem[]> {
    const rows = await query<any>(
      `SELECT d.id AS draft_id, d.message_id, d.body AS sent_body, d.updated_at AS sent_at,
              m.sender_name, m.sender_email, m.subject, m.body AS original_body,
              m.intent, m.source, m.gmail_message_id
       FROM drafts d
       JOIN messages m ON d.message_id = m.id
       WHERE d.status = 'sent' AND m.source != 'demo'
       ORDER BY d.updated_at DESC`
    );
    return rows.map(this.mapOutboxRow);
  }

  async listOutboxPaginated(filters: OutboxFilters = {}): Promise<PaginatedResult<OutboxItem>> {
    const { q, intent, page = 1, limit = 10 } = filters;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const conditions: string[] = ["d.status = 'sent'", "m.source != 'demo'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (q && q.trim()) {
      conditions.push(
        `(LOWER(m.sender_name) LIKE $${paramIndex} OR LOWER(m.sender_email) LIKE $${paramIndex} OR LOWER(m.subject) LIKE $${paramIndex} OR LOWER(d.body) LIKE $${paramIndex})`
      );
      params.push(`%${q.trim().toLowerCase()}%`);
      paramIndex++;
    }
    if (intent && intent !== 'all') {
      conditions.push(`m.intent = $${paramIndex}`);
      params.push(intent);
      paramIndex++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseQuery = `FROM drafts d JOIN messages m ON d.message_id = m.id ${where}`;

    // Get total count
    const countRows = await query<{ count: string }>(`SELECT COUNT(*) as count ${baseQuery}`, params);
    const total = parseInt(countRows[0]?.count ?? '0', 10);

    // Get paginated items
    const offset = Math.max(0, (safePage - 1) * safeLimit);
    const dataRows = await query<any>(
      `SELECT d.id AS draft_id, d.message_id, d.body AS sent_body, d.updated_at AS sent_at,
              m.sender_name, m.sender_email, m.subject, m.body AS original_body,
              m.intent, m.source, m.gmail_message_id
       ${baseQuery} ORDER BY d.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, safeLimit, offset]
    );

    return {
      items: dataRows.map((r) => this.mapOutboxRow(r)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  async listOutboxFiltered(filters: OutboxFilters = {}): Promise<OutboxItem[]> {
    const { q, intent } = filters;
    const conditions: string[] = ["d.status = 'sent'", "m.source != 'demo'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (q && q.trim()) {
      conditions.push(
        `(LOWER(m.sender_name) LIKE $${paramIndex} OR LOWER(m.sender_email) LIKE $${paramIndex} OR LOWER(m.subject) LIKE $${paramIndex} OR LOWER(d.body) LIKE $${paramIndex})`
      );
      params.push(`%${q.trim().toLowerCase()}%`);
      paramIndex++;
    }
    if (intent && intent !== 'all') {
      conditions.push(`m.intent = $${paramIndex}`);
      params.push(intent);
      paramIndex++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<any>(
      `SELECT d.id AS draft_id, d.message_id, d.body AS sent_body, d.updated_at AS sent_at,
              m.sender_name, m.sender_email, m.subject, m.body AS original_body,
              m.intent, m.source, m.gmail_message_id
       FROM drafts d JOIN messages m ON d.message_id = m.id ${where}
       ORDER BY d.updated_at DESC`,
      params
    );
    return rows.map((r) => this.mapOutboxRow(r));
  }

  private mapOutboxRow(r: any): OutboxItem {
    return {
      id: r.draft_id,
      messageId: r.message_id,
      senderName: r.sender_name,
      senderEmail: r.sender_email,
      subject: r.subject,
      replySubject: r.subject.toLowerCase().startsWith('re:') ? r.subject : `Re: ${r.subject}`,
      body: r.sent_body,
      originalBody: r.original_body,
      intent: r.intent,
      sentAt: r.sent_at,
      source: r.source,
      gmailMessageId: r.gmail_message_id ?? undefined
    };
  }

  async insertMessage(m: Message): Promise<void> {
    await query(
      `INSERT INTO messages(id, source, sender_name, sender_email, subject, body, received_at, intent, confidence, status, gmail_message_id, has_attachments)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.source, m.senderName, m.senderEmail, m.subject, m.body, m.receivedAt, m.intent, m.confidence, m.status, m.gmailMessageId ?? null, m.hasAttachments ? 1 : 0]
    );
  }

  async insertDraft(d: Draft): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO drafts(id, message_id, body, status, is_mock, version, created_at, updated_at, reviewed_at)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
        [d.id, d.messageId, d.body, d.status, d.isMock ? 1 : 0, d.version, d.createdAt, d.updatedAt, d.reviewedAt]
      );
      await client.query('UPDATE messages SET status = $1 WHERE id = $2', [d.status, d.messageId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateDraft(id: string, body: string): Promise<Draft | undefined> {
    const old = await this.getDraft(id);
    if (!old || old.status !== 'pending') return undefined;
    const now = new Date().toISOString();
    await query(
      'UPDATE drafts SET body = $1, version = version + 1, updated_at = $2 WHERE id = $3',
      [body, now, id]
    );
    return this.getDraft(id);
  }

  async reviewDraft(id: string, status: 'approved' | 'rejected'): Promise<Draft | undefined> {
    const old = await this.getDraft(id);
    if (!old || old.status !== 'pending') return undefined;
    const now = new Date().toISOString();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE drafts SET status = $1, reviewed_at = $2, updated_at = $3, version = version + 1 WHERE id = $4',
        [status, now, now, id]
      );
      await client.query('UPDATE messages SET status = $1 WHERE id = $2', [status, old.messageId]);
      await client.query(
        'INSERT INTO review_events(id, draft_id, action, created_at, version) VALUES($1, $2, $3, $4, $5)',
        [newId(), id, status, now, old.version + 1]
      );
      await client.query(
        'INSERT INTO activity(id, type, message, created_at) VALUES($1, $2, $3, $4)',
        [newId(), 'draft-' + status, `Draft ${status} for message ${old.messageId}`, now]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.getDraft(id);
  }

  async markDraftSent(id: string): Promise<Draft | undefined> {
    const old = await this.getDraft(id);
    if (!old || old.status !== 'approved') return undefined;
    const now = new Date().toISOString();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE drafts SET status = 'sent', updated_at = $1, version = version + 1 WHERE id = $2",
        [now, id]
      );
      await client.query("UPDATE messages SET status = 'sent' WHERE id = $1", [old.messageId]);
      await client.query(
        'INSERT INTO review_events(id, draft_id, action, created_at, version) VALUES($1, $2, $3, $4, $5)',
        [newId(), id, 'sent', now, old.version + 1]
      );
      await client.query(
        'INSERT INTO activity(id, type, message, created_at) VALUES($1, $2, $3, $4)',
        [newId(), 'draft-sent', `Draft sent for message ${old.messageId}`, now]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.getDraft(id);
  }

  async addActivity(type: string, message: string): Promise<void> {
    await query(
      'INSERT INTO activity(id, type, message, created_at) VALUES($1, $2, $3, $4)',
      [newId(), type, message, new Date().toISOString()]
    );
  }

  async listActivity(limit = 8): Promise<Activity[]> {
    const rows = await query<{ id: string; type: string; message: string; created_at: string }>(
      "SELECT * FROM activity WHERE type NOT LIKE 'demo-%' ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return rows.map((r) => ({ id: r.id, type: r.type, message: r.message, createdAt: r.created_at }));
  }

  async deleteMessage(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM review_events WHERE draft_id IN (SELECT id FROM drafts WHERE message_id = $1)', [id]);
      await client.query('DELETE FROM drafts WHERE message_id = $1', [id]);
      const res = await client.query('DELETE FROM messages WHERE id = $1', [id]);
      await client.query(
        'INSERT INTO activity(id, type, message, created_at) VALUES($1, $2, $3, $4)',
        [newId(), 'message-deleted', `Deleted message ${id}`, new Date().toISOString()]
      );
      await client.query('COMMIT');
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteMessages(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM review_events WHERE draft_id IN (SELECT id FROM drafts WHERE message_id = ANY($1))', [ids]);
      await client.query('DELETE FROM drafts WHERE message_id = ANY($1)', [ids]);
      const res = await client.query('DELETE FROM messages WHERE id = ANY($1)', [ids]);
      await client.query(
        'INSERT INTO activity(id, type, message, created_at) VALUES($1, $2, $3, $4)',
        [newId(), 'messages-bulk-deleted', `Deleted ${res.rowCount ?? 0} messages`, new Date().toISOString()]
      );
      await client.query('COMMIT');
      return res.rowCount ?? 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async clearDemo(): Promise<void> {
    await this.clearAllCandidateData();
  }

  async clearAllCandidateData(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM review_events');
      await client.query('DELETE FROM drafts');
      await client.query('DELETE FROM messages');
      await client.query('DELETE FROM activity');
      await client.query('DELETE FROM attendance_flags');
      await client.query('DELETE FROM attendance_meta');
      await client.query('DELETE FROM stall_alerts');
      await client.query('DELETE FROM stall_meta');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async factoryReset(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM review_events');
      await client.query('DELETE FROM audit_events');
      await client.query('DELETE FROM drafts');
      await client.query('DELETE FROM messages');
      await client.query('DELETE FROM activity');
      await client.query('DELETE FROM sync_checkpoints');
      await client.query('DELETE FROM connection_metadata');
      await client.query('DELETE FROM attendance_flags');
      await client.query('DELETE FROM attendance_meta');
      await client.query('DELETE FROM stall_alerts');
      await client.query('DELETE FROM stall_meta');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
