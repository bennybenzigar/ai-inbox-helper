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

// --- Static legal pages for Google OAuth verification (crawler-readable) ---
app.get('/privacy', (_req, res) => {
  res.type('html').send(privacyHtml());
});
app.get('/privacy.html', (_req, res) => {
  res.type('html').send(privacyHtml());
});
app.get('/terms', (_req, res) => {
  res.type('html').send(termsHtml());
});
app.get('/terms.html', (_req, res) => {
  res.type('html').send(termsHtml());
});

app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
app.use(errorHandler);

function privacyHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Privacy Policy — AI Inbox Helper</title>
<meta name="description" content="Privacy Policy for AI Inbox Helper. Learn how we collect, use, and protect your data."/>
<style>body{font-family:sans-serif;line-height:1.7;color:#1e293b;max-width:800px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.8rem}h2{color:#1e40af;margin-top:2rem;border-bottom:2px solid #e0e7ff;padding-bottom:.3rem}
ul{margin:.5rem 0 1rem 1.5rem}a{color:#2563eb}
.box{background:#fef3c7;border-left:4px solid #f59e0b;padding:1rem;border-radius:6px;margin:1rem 0}</style></head>
<body>
<h1>Privacy Policy — AI Inbox Helper</h1>
<p><em>Last Updated: October 29, 2026</em></p>
<div class="box"><strong>Google API Services User Data Policy Compliance:</strong><br/>
AI Inbox Helper's use and transfer to any other app of information received from Google APIs adheres to the
<a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
including the <strong>Limited Use</strong> requirements.</div>
<h2>1. Introduction</h2>
<p>AI Inbox Helper ("we", "our", or "the application") is a recruitment productivity platform that assists recruiters in categorizing candidate emails, drafting suggested replies, monitoring recruitment pipeline bottlenecks, and analyzing attendance patterns. We are committed to protecting your privacy and maintaining the security of any data you share with us.</p>
<h2>2. Information We Access and Collect</h2>
<ul>
<li><strong>Google Account Profile &amp; Email:</strong> We access your email address and basic profile via <code>openid</code> and <code>email</code> scopes.</li>
<li><strong>Gmail Messages &amp; Metadata:</strong> Under <code>gmail.readonly</code>, we access candidate emails (sender, subject, timestamp, body) for inbox display and intent classification.</li>
<li><strong>Recruiter-Uploaded Data:</strong> Timesheets and pipeline CSVs uploaded to the Attendance and Stall Alerter modules.</li>
</ul>
<h2>3. How We Use Your Information</h2>
<ul>
<li><strong>Intent Classification:</strong> Emails are categorized into 6 recruitment intents using Google Gemini AI.</li>
<li><strong>AI Response Drafting:</strong> Candidate messages are sent to Gemini AI to generate reply suggestions for your review.</li>
<li><strong>Human-in-the-Loop Review:</strong> AI drafts require explicit recruiter approval before any action. <strong>No email is ever sent automatically.</strong></li>
</ul>
<h2>4. Google Limited Use Disclosure</h2>
<ul>
<li>We <strong>NEVER</strong> use Google user data to train AI/ML models.</li>
<li>We <strong>NEVER</strong> sell Google user data to third parties, data brokers, or advertisers.</li>
<li>We <strong>NEVER</strong> use Google user data for personalized or interest-based advertising.</li>
<li>We <strong>NEVER</strong> allow humans to read private email messages unless explicitly approved by the user in the review interface, consented to for troubleshooting, or required by law.</li>
<li>We <strong>LIMIT</strong> use of Google user data to providing and improving user-facing features described in this policy.</li>
</ul>
<h2>5. Third-Party Services</h2>
<ul>
<li><strong>Google OAuth 2.0</strong> — authentication and Gmail access authorization.</li>
<li><strong>Google Gmail API</strong> — reading candidate emails (read-only).</li>
<li><strong>Google Gemini AI</strong> — intent classification and reply generation (data not retained beyond API request).</li>
<li><strong>Render.com</strong> — application hosting with encrypted PostgreSQL storage.</li>
</ul>
<h2>6. Data Storage &amp; Security</h2>
<p>All data is encrypted in transit (HTTPS/TLS) and stored in a managed PostgreSQL database with encryption at rest. OAuth tokens are stored server-side and never exposed to clients or third parties.</p>
<h2>7. Data Deletion &amp; Revocation</h2>
<ul>
<li><strong>Disconnect Gmail:</strong> Click "Disconnect" on the Gmail Connection page to delete stored tokens.</li>
<li><strong>Revoke via Google:</strong> Remove access at <a href="https://myaccount.google.com/permissions">Google Account permissions</a>.</li>
<li><strong>Factory Reset:</strong> Settings → Data Management → Factory Reset to permanently delete all data.</li>
<li><strong>Email Request:</strong> Contact us at bennybenzigar@gmail.com for deletion within 7 business days.</li>
</ul>
<h2>8. Children's Privacy</h2>
<p>AI Inbox Helper is not intended for users under 18. We do not knowingly collect data from children.</p>
<h2>9. Changes to This Policy</h2>
<p>We may update this policy and will notify users by updating the "Last Updated" date.</p>
<h2>10. Contact</h2>
<p><strong>Developer:</strong> Benny Benzigar<br/><strong>Email:</strong> <a href="mailto:bennybenzigar@gmail.com">bennybenzigar@gmail.com</a><br/>
<strong>App:</strong> <a href="https://ai-inbox-frontend.onrender.com">https://ai-inbox-frontend.onrender.com</a></p>
</body></html>`;
}

function termsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Terms of Service — AI Inbox Helper</title>
<style>body{font-family:sans-serif;line-height:1.7;color:#1e293b;max-width:800px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.8rem}h2{color:#1e40af;margin-top:2rem;border-bottom:2px solid #e0e7ff;padding-bottom:.3rem}
ul{margin:.5rem 0 1rem 1.5rem}a{color:#2563eb}</style></head>
<body>
<h1>Terms of Service — AI Inbox Helper</h1>
<p><em>Last Updated: October 29, 2026</em></p>
<h2>1. Acceptance</h2><p>By using AI Inbox Helper, you agree to these terms.</p>
<h2>2. Service Description</h2><p>AI Inbox Helper is a recruitment tool that integrates with Gmail to categorize emails, generate AI reply drafts, and monitor recruitment pipelines.</p>
<h2>3. User Responsibilities</h2>
<ul><li>Provide accurate account information.</li><li>Review all AI-generated content before sending.</li><li>Use the application only for lawful recruitment purposes.</li></ul>
<h2>4. Privacy</h2><p>Your use is governed by our <a href="/privacy">Privacy Policy</a>.</p>
<h2>5. AI Content</h2><p>AI-generated suggestions are drafts for your review. We do not guarantee their accuracy.</p>
<h2>6. Liability</h2><p>The application is provided "as is" without warranties.</p>
<h2>7. Contact</h2><p><a href="mailto:bennybenzigar@gmail.com">bennybenzigar@gmail.com</a></p>
</body></html>`;
}
