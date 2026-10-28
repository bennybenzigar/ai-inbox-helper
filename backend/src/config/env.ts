import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:4200'),
  SESSION_SECRET: z.string().default('dev-only-change-me-before-deploying'),
  DATABASE_PATH: z.string().default('./data/inbox-helper.sqlite'),
  DATABASE_URL: z.string().optional().default('postgres://postgres:Admin@123@localhost:5432/ai_inbox_helper'),
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().int().default(5432),
  PGUSER: z.string().default('postgres'),
  PGPASSWORD: z.string().default('Admin@123'),
  PGDATABASE: z.string().default('ai_inbox_helper'),
  DEMO_MODE: z.string().default('false'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''), GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:3000/auth/google/callback'),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional().default(''), PUBSUB_TOPIC_NAME: z.string().optional().default(''),
  PUBSUB_SUBSCRIPTION_NAME: z.string().optional().default(''), PUBSUB_AUDIENCE: z.string().optional().default(''),
  PUBSUB_PUSH_TOKEN: z.string().optional().default(''), AI_PROVIDER: z.enum(['mock', 'openai-compatible', 'gemini']).default('mock'),
  AI_API_KEY: z.string().optional().default(''), AI_MODEL: z.string().optional().default('')
});
export const env = schema.parse(process.env);
export const demoMode = env.DEMO_MODE.toLowerCase() !== 'false';
