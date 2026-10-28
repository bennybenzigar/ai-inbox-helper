import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { env, demoMode } from '../config/env';
import { InboxRepository } from '../repositories/inbox.repository';
import { createAIProvider } from '../services/ai.service';
import { publishEvent } from '../services/event-bus.service';
import { newId } from '../utils/ids';
import type { Draft, Message, Intent, OutboxItem } from '../models/types';
import {
  gmailConfigured,
  isGmailConnected,
  getConnectedEmail,
  getLastSyncedAt,
  syncGmailMessages,
  sendGmailReply
} from '../services/gmail.service';
import {
  importCandidateMessagesFromCSV,
  generateSampleCandidateMessagesCSV
} from '../services/csv-import.service';
import {
  analyzeAttendance,
  parseAttendanceCSV,
  generateSampleAttendanceCSV
} from '../services/attendance.service';
import {
  analyzeStalledCandidates,
  parseHiringBoardCSV,
  generateSampleHiringBoardCSV
} from '../services/stall-alerter.service';

const router = Router();
const repo = new InboxRepository();
const patchSchema = z.object({ body: z.string().trim().min(1).max(12000) });

router.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'ai-inbox-helper-api', database: 'postgresql', timestamp: new Date().toISOString() })
);

router.get('/status', (_req, res) =>
  res.json({
    mode: 'live',
    demoMode: false,
    database: 'postgresql',
    gmail: {
      configured: gmailConfigured(),
      connected: isGmailConnected(),
      account: getConnectedEmail(),
      lastSyncedAt: getLastSyncedAt()
    },
    aiProvider: env.AI_PROVIDER,
    liveClients: 0
  })
);

router.post('/gmail/sync', async (_req, res, next) => {
  try {
    const result = await syncGmailMessages(repo, 20);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/messages', async (req, res, next) => {
  try {
    const q = req.query.q !== undefined ? String(req.query.q).trim() : undefined;
    const intent = req.query.intent ? String(req.query.intent) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const pageParam = req.query.page !== undefined ? parseInt(String(req.query.page), 10) : undefined;
    const limitParam = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : undefined;

    if (pageParam !== undefined || limitParam !== undefined) {
      const page = pageParam && pageParam > 0 ? pageParam : 1;
      const limit = limitParam && limitParam > 0 ? limitParam : 10;
      const result = await repo.listMessagesPaginated({ q, intent, status, page, limit });
      return res.json(result);
    }

    const items = await repo.listMessagesFiltered({ q, intent, status });
    return res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

// Static /messages/* routes MUST come before /messages/:id to avoid Express matching them as IDs
router.post('/messages/upload-csv', async (req, res, next) => {
  try {
    const csvContent = typeof req.body === 'string' ? req.body : req.body?.csv;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'Please provide CSV content in the request body ({ "csv": "..." })' });
    }
    const result = await importCandidateMessagesFromCSV(repo, csvContent);
    publishEvent('messages-updated', result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/messages/sample-csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="candidate_messages_sample.csv"');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(generateSampleCandidateMessagesCSV());
});

router.get('/messages/export-csv', async (req, res, next) => {
  try {
    const q = req.query.q !== undefined ? String(req.query.q).trim() : undefined;
    const intent = req.query.intent ? String(req.query.intent) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const pageParam = req.query.page !== undefined ? parseInt(String(req.query.page), 10) : undefined;
    const limitParam = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : undefined;

    let messages: Message[];
    let filename = 'candidate_messages_export.csv';

    if (pageParam !== undefined && limitParam !== undefined && pageParam > 0 && limitParam > 0) {
      const paginated = await repo.listMessagesPaginated({ q, intent, status, page: pageParam, limit: limitParam });
      messages = paginated.items;
      filename = `candidate_messages_page_${pageParam}_export.csv`;
    } else {
      messages = await repo.listMessagesFiltered({ q, intent, status });
      if (q || (intent && intent !== 'all') || (status && status !== 'all')) {
        filename = 'candidate_messages_filtered_export.csv';
      }
    }

    const header = 'id,source,senderName,senderEmail,subject,body,receivedAt,intent,confidence,status\n';
    const rows = messages
      .map((m) =>
        [
          `"${m.id}"`,
          `"${m.source}"`,
          `"${(m.senderName || '').replace(/"/g, '""')}"`,
          `"${(m.senderEmail || '').replace(/"/g, '""')}"`,
          `"${(m.subject || '').replace(/"/g, '""')}"`,
          `"${(m.body || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
          `"${m.receivedAt}"`,
          `"${m.intent}"`,
          m.confidence,
          `"${m.status}"`
        ].join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
});

router.get('/outbox', async (req, res, next) => {
  try {
    const q = req.query.q !== undefined ? String(req.query.q).trim() : undefined;
    const intent = req.query.intent ? String(req.query.intent) : undefined;
    const pageParam = req.query.page !== undefined ? parseInt(String(req.query.page), 10) : undefined;
    const limitParam = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : undefined;

    if (pageParam !== undefined || limitParam !== undefined) {
      const page = pageParam && pageParam > 0 ? pageParam : 1;
      const limit = limitParam && limitParam > 0 ? limitParam : 10;
      const result = await repo.listOutboxPaginated({ q, intent, page, limit });
      return res.json(result);
    }

    const items = await repo.listOutboxFiltered({ q, intent });
    return res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

router.get('/outbox/export-csv', async (req, res, next) => {
  try {
    const q = req.query.q !== undefined ? String(req.query.q).trim() : undefined;
    const intent = req.query.intent ? String(req.query.intent) : undefined;
    const pageParam = req.query.page !== undefined ? parseInt(String(req.query.page), 10) : undefined;
    const limitParam = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : undefined;

    let items: OutboxItem[];
    let filename = 'candidate_sent_messages_export.csv';

    if (pageParam !== undefined && limitParam !== undefined && pageParam > 0 && limitParam > 0) {
      const paginated = await repo.listOutboxPaginated({ q, intent, page: pageParam, limit: limitParam });
      items = paginated.items;
      filename = `candidate_sent_messages_page_${pageParam}_export.csv`;
    } else {
      items = await repo.listOutboxFiltered({ q, intent });
      if (q || (intent && intent !== 'all')) {
        filename = 'candidate_sent_messages_filtered_export.csv';
      }
    }

    const header = 'id,messageId,recipientName,recipientEmail,subject,replySubject,body,sentAt,intent,source\n';
    const rows = items
      .map((item) =>
        [
          `"${item.id}"`,
          `"${item.messageId}"`,
          `"${(item.senderName || '').replace(/"/g, '""')}"`,
          `"${(item.senderEmail || '').replace(/"/g, '""')}"`,
          `"${(item.subject || '').replace(/"/g, '""')}"`,
          `"${(item.replySubject || '').replace(/"/g, '""')}"`,
          `"${(item.body || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
          `"${item.sentAt}"`,
          `"${item.intent}"`,
          `"${item.source}"`
        ].join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
});

router.post('/messages/bulk-delete', async (req, res, next) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array of message IDs' });
    }
    const count = await repo.deleteMessages(ids);
    publishEvent('messages-updated', { action: 'bulk-delete', deletedCount: count });
    res.json({ ok: true, deleted: count });
  } catch (err) {
    next(err);
  }
});

// Parameterized route AFTER static routes
router.get('/messages/:id', async (req, res, next) => {
  try {
    const message = await repo.getMessage(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const draft = await repo.getDraftForMessage(message.id);
    res.json({ message, draft: draft ?? null });
  } catch (err) {
    next(err);
  }
});

router.delete('/messages/:id', async (req, res, next) => {
  try {
    const success = await repo.deleteMessage(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }
    publishEvent('messages-updated', { action: 'delete', id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/demo/data', async (_req, res, next) => {
  try {
    await repo.clearAllCandidateData();
    publishEvent('messages-updated', { reset: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/data/clear', async (_req, res, next) => {
  try {
    await repo.clearAllCandidateData();
    publishEvent('messages-updated', { reset: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/drafts', async (req, res, next) => {
  try {
    const status = String(req.query.status ?? 'all');
    const all = await repo.listDrafts();
    const items = all.filter((d) => status === 'all' || d.status === status);
    res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

router.post('/messages/:id/draft', async (req, res, next) => {
  try {
    const message = await repo.getMessage(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const existing = await repo.getDraftForMessage(message.id);
    if (existing) return res.json({ draft: existing });

    const provider = createAIProvider();
    const now = new Date().toISOString();
    const draft: Draft = {
      id: newId(),
      messageId: message.id,
      body: await provider.generateDraft(message),
      status: 'pending',
      isMock: provider.name === 'mock',
      version: 1,
      createdAt: now,
      updatedAt: now,
      reviewedAt: null
    };
    await repo.insertDraft(draft);
    await repo.addActivity('draft-created', `Draft generated for ${message.subject}`);
    publishEvent('draft-updated', { draft });
    res.status(201).json({ draft });
  } catch (e) {
    next(e);
  }
});

router.patch('/drafts/:id', async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Draft body is required and must be under 12,000 characters', details: parsed.error.flatten() });
    }
    const draft = await repo.updateDraft(req.params.id, parsed.data.body);
    if (!draft) return res.status(409).json({ error: 'Draft not found or no longer pending review' });
    publishEvent('draft-updated', { draft });
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

router.post('/drafts/:id/regenerate', async (req, res, next) => {
  try {
    const draft = await repo.getDraft(req.params.id);
    if (!draft || draft.status !== 'pending') return res.status(409).json({ error: 'Draft not found or no longer pending review' });
    const message = await repo.getMessage(draft.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const provider = createAIProvider();
    const updated = await repo.updateDraft(draft.id, await provider.generateDraft(message, draft.version));
    if (!updated) return res.status(409).json({ error: 'Draft cannot be regenerated' });
    publishEvent('draft-updated', { draft: updated });
    res.json({ draft: updated });
  } catch (e) {
    next(e);
  }
});

router.post('/drafts/:id/approve', (req, res, next) => review(req.params.id, 'approved', res, next));
router.post('/drafts/:id/reject', (req, res, next) => review(req.params.id, 'rejected', res, next));

async function review(id: string, status: 'approved' | 'rejected', res: Response, next: NextFunction) {
  try {
    const draft = await repo.reviewDraft(id, status);
    if (!draft) return res.status(409).json({ error: 'Draft not found or already reviewed' });
    publishEvent('draft-updated', { draft });
    return res.json({ draft, note: 'Review recorded. No email was sent.' });
  } catch (err) {
    next(err);
  }
}

router.post('/drafts/:id/send', async (req, res, next) => {
  try {
    const draft = await repo.getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    if (draft.status !== 'approved') {
      return res.status(409).json({ error: 'Draft must be approved by human review before sending.' });
    }
    if (!isGmailConnected()) {
      return res.status(400).json({
        error: 'Cannot send response: Gmail account is not connected. Please connect your Gmail account in Mailbox Integration first.'
      });
    }
    const message = await repo.getMessage(draft.messageId);
    if (!message) return res.status(404).json({ error: 'Candidate message not found' });

    const sendRes = await sendGmailReply(message, draft);
    const updated = await repo.markDraftSent(draft.id);
    publishEvent('draft-updated', { draft: updated });
    return res.json({
      draft: updated,
      sent: true,
      simulated: sendRes.simulated,
      note: 'Response successfully sent to candidate via Gmail API.'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/tools/attendance/analyze', (req, res) => {
  const csv = req.body?.csv || generateSampleAttendanceCSV();
  const records = parseAttendanceCSV(csv);
  const result = analyzeAttendance(records);
  res.json(result);
});

router.get('/tools/attendance/sample', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance_sample.csv"');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(generateSampleAttendanceCSV());
});

router.post('/tools/stall-alerter/analyze', (req, res) => {
  const csv = req.body?.csv || generateSampleHiringBoardCSV();
  const thresholdDays = parseInt(req.body?.thresholdDays, 10) || 5;
  const rows = parseHiringBoardCSV(csv);
  const result = analyzeStalledCandidates(rows, thresholdDays);
  res.json(result);
});

router.get('/tools/stall-alerter/sample', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="hiring_board_sample.csv"');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(generateSampleHiringBoardCSV());
});

router.get('/dashboard', async (_req, res, next) => {
  try {
    const messages = await repo.listMessages();
    const drafts = await repo.listDrafts();
    const intents: Intent[] = [
      'Interview Scheduling',
      'Application Status',
      'Salary & Compensation',
      'Document Requests',
      'Job Details',
      'Other / Unclear'
    ];
    const messagesByIntent = Object.fromEntries(intents.map((i) => [i, messages.filter((m) => m.intent === i).length]));
    const recentActivity = await repo.listActivity();
    res.json({
      stats: {
        totalMessages: messages.length,
        pendingDrafts: drafts.filter((d) => d.status === 'pending').length,
        approvedDrafts: drafts.filter((d) => d.status === 'approved').length,
        attentionRequired: messages.filter((m) => m.intent === 'Other / Unclear').length,
        messagesByIntent,
        recentActivity,
        lastSyncedAt: getLastSyncedAt()
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/intents', async (_req, res, next) => {
  try {
    const messages = await repo.listMessages();
    const intents: Intent[] = [
      'Interview Scheduling',
      'Application Status',
      'Salary & Compensation',
      'Document Requests',
      'Job Details',
      'Other / Unclear'
    ];
    res.json({
      items: intents.map((intent) => ({ intent, count: messages.filter((m) => m.intent === intent).length }))
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, database: 'postgresql', at: new Date().toISOString() })}\n\n`);
  const { addClient } = require('../services/event-bus.service') as typeof import('../services/event-bus.service');
  addClient(res);
});

export default router;
