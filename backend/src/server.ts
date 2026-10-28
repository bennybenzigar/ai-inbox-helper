import { app } from './app';
import { env } from './config/env';
import { initDatabase, closeDatabase } from './database/database';
import { initGmailService } from './services/gmail.service';

async function bootstrap() {
  try {
    await initDatabase();
    await initGmailService();
    console.log('Connected to PostgreSQL (ai_inbox_helper). Tables and Gmail service verified.');

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
