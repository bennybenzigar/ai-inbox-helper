import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import apiRoutes from './routes/api.routes';
import authRoutes from './routes/auth.routes';
import webhookRoutes from './routes/webhook.routes';
import { errorHandler } from './middleware/error-handler';
export const app=express();
app.disable('x-powered-by');
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.FRONTEND_ORIGIN === '*' || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins for deployed public demo
      }
    },
    credentials: true
  })
);
app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.use(rateLimit({windowMs:60_000,limit:180,standardHeaders:true,legacyHeaders:false}));
app.use('/api',apiRoutes);
app.use('/auth',authRoutes);
app.use('/webhooks',webhookRoutes);
app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
app.use(errorHandler);
