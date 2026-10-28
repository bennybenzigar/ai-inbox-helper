import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import { env } from '../config/env';
import {
  createGoogleOAuthClient,
  gmailScopes,
  storeGmailTokens,
  clearStoredGmailTokens,
  setupGmailWatch,
  syncGmailMessages
} from '../services/gmail.service';
import { InboxRepository } from '../repositories/inbox.repository';
import { publishEvent } from '../services/event-bus.service';

const router = Router();
const oauthStates = new Map<string, number>();

function getFrontendUrl(path: string): string {
  const origin = env.FRONTEND_ORIGIN && env.FRONTEND_ORIGIN !== '*'
    ? env.FRONTEND_ORIGIN.replace(/\/$/, '')
    : 'https://ai-inbox-frontend.onrender.com';
  return `${origin}${path}`;
}

router.get('/google', (req, res) => {
  try {
    const oauth = createGoogleOAuthClient();
    const state = randomBytes(24).toString('hex');
    oauthStates.set(state, Date.now() + 10 * 60 * 1000);
    for (const [k, v] of oauthStates) if (v < Date.now()) oauthStates.delete(k);

    res.cookie('gmail_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000
    });

    res.redirect(
      oauth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: gmailScopes(),
        state
      })
    );
  } catch (e) {
    res.status(503).json({ error: e instanceof Error ? e.message : 'Gmail OAuth unavailable' });
  }
});

router.get('/google/callback', async (req, res) => {
  const state = String(req.query.state ?? '');
  const cookie = String(req.cookies?.gmail_oauth_state ?? '');
  const expiry = oauthStates.get(state);
  oauthStates.delete(state);
  res.clearCookie('gmail_oauth_state');

  if (!state || !cookie || state !== cookie || !expiry || expiry < Date.now()) {
    return res.status(400).send('OAuth state validation failed. Please reconnect Gmail.');
  }
  if (req.query.error) {
    return res.redirect(getFrontendUrl('/gmail-connection?error=oauth_denied'));
  }

  try {
    const oauth = createGoogleOAuthClient();
    const { tokens } = await oauth.getToken(String(req.query.code ?? ''));
    if (!tokens.refresh_token && !tokens.access_token) {
      return res.status(400).send('Google did not return valid tokens. Reconnect Gmail.');
    }

    oauth.setCredentials(tokens);
    let userEmail: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth });
      const userinfo = await oauth2.userinfo.get();
      userEmail = userinfo.data.email ?? undefined;
    } catch {
      // Userinfo fetch failure is non-fatal
    }

    storeGmailTokens(tokens, userEmail);

    // Set up Pub/Sub watch in background
    setupGmailWatch().catch((err) => console.warn('Background Gmail watch registration failed:', err));

    // Perform initial mailbox synchronization
    const repo = new InboxRepository();
    syncGmailMessages(repo, 20).catch((err) => console.warn('Initial Gmail sync failed:', err));

    publishEvent('gmail-notification-received', { connected: true, account: userEmail });
    return res.redirect(getFrontendUrl('/gmail-connection?connected=true'));
  } catch {
    res.status(502).send('Google OAuth exchange failed. Check backend configuration and try again.');
  }
});

router.post('/disconnect', (_req, res) => {
  clearStoredGmailTokens();
  publishEvent('gmail-notification-received', { connected: false });
  res.json({ ok: true, note: 'Gmail disconnected.' });
});

export default router;

