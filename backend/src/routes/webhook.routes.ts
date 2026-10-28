import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { publishEvent } from '../services/event-bus.service';
import { isGmailConnected, syncGmailHistory } from '../services/gmail.service';
import { InboxRepository } from '../repositories/inbox.repository';

const router = Router();
router.post('/gmail', (req, res) => {
  const expected = env.PUBSUB_PUSH_TOKEN;
  const auth = String(req.get('authorization') ?? '');
  if (!expected) return res.status(503).json({ error: 'Pub/Sub webhook is not configured' });
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid Pub/Sub delivery token' });
  const message = req.body?.message;
  if (!message?.data || !message?.messageId) return res.status(400).json({ error: 'Invalid Pub/Sub envelope' });
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(String(message.data), 'base64').toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid Pub/Sub message data' });
  }

  publishEvent('gmail-notification-received', { received: true });
  if (isGmailConnected()) {
    syncGmailHistory(new InboxRepository()).catch((err) =>
      console.warn('Webhook-triggered Gmail history sync failed:', err instanceof Error ? err.message : err)
    );
  }
  res.status(204).end();
});
export default router;
