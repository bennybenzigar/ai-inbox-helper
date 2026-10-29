import { app } from './app';
import { env } from './config/env';
import { initDatabase, closeDatabase } from './database/database';
import {
  initGmailService,
  isGmailConnected,
  syncGmailMessages,
  renewGmailWatchIfNeeded
} from './services/gmail.service';
import { InboxRepository } from './repositories/inbox.repository';

/** Auto-sync interval: every 5 minutes */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Daily watch-renewal interval: every 6 hours */
const WATCH_RENEW_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function startAutoSync(repo: InboxRepository): Promise<void> {
  async function runSync() {
    if (!isGmailConnected()) return;
    try {
      const result = await syncGmailMessages(repo, 20);
      if (result.synced > 0) {
        console.log(`[Auto-sync] Pulled ${result.synced} new Gmail message(s).`);
      }
    } catch (err) {
      console.warn('[Auto-sync] Gmail sync error:', err instanceof Error ? err.message : err);
    }
  }

  // Run once immediately on startup, then on interval
  await runSync();
  const syncTimer = setInterval(runSync, SYNC_INTERVAL_MS);

  // Renew Gmail watch subscription before it expires (7-day limit)
  const watchTimer = setInterval(async () => {
    try { await renewGmailWatchIfNeeded(); } catch {}
  }, WATCH_RENEW_INTERVAL_MS);

  // Unref so timers don't block process exit
  syncTimer.unref();
  watchTimer.unref();
}

async function bootstrap() {
  try {
    await initDatabase();
    await initGmailService();
    console.log('Connected to PostgreSQL (ai_inbox_helper). Tables and Gmail service verified.');

    const repo = new InboxRepository();
    // Start background auto-sync (non-blocking)
    startAutoSync(repo).catch((err) =>
      console.warn('[Auto-sync] Failed to start:', err instanceof Error ? err.message : err)
    );

    const server = app.listen(env.PORT, () => {
      console.log(`AI Inbox Helper API listening on http://localhost:${env.PORT}`);
    });

    function shutdown(signal: string) {
      console.log(`${signal} received; shutting down`);
      server.close(async () => {
        await closeDatabase();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to initialize PostgreSQL database:', err);
    process.exit(1);
  }
}

bootstrap();
