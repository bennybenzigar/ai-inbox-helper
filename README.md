# AI Inbox Helper — Intelligent Recruiting Operations & Mailbox Assistant

[![Production Deployed](https://img.shields.io/badge/Render-Deployed%20Live-brightgreen)](https://ai-inbox-frontend.onrender.com)
[![Angular 22](https://img.shields.io/badge/Angular-22%20Standalone%20Signals-dd0031)](https://angular.dev)
[![Node.js & Express](https://img.shields.io/badge/Backend-Express%20TypeScript-blue)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791)](https://www.postgresql.org)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%202.5--flash-8e7cc3)](https://ai.google.dev)

A modern, full-stack recruitment inbox and talent operations management system built with **Angular 22 standalone components + Signals**, **Node.js/Express with TypeScript (Node16)**, and **PostgreSQL**.

The application classifies candidate communications into structured intents, generates context-aware response drafts using **Google Gemini AI**, synchronizes directly with a recruiter's **Gmail account via OAuth 2.0 and automated background polling**, tracks sent outreach in an **Outbox**, flags timesheet compliance anomalies in an **Attendance Pattern Checker**, and highlights languishing pipeline candidates in a **Hiring Board Stall Alerter**.

---

## Quick Reference Links

| Resource | URL |
|---|---|
| **Live Frontend App** | [https://ai-inbox-frontend.onrender.com](https://ai-inbox-frontend.onrender.com) |
| **Live Backend API** | [https://ai-inbox-backend.onrender.com](https://ai-inbox-backend.onrender.com) |
| **Git Repository** | [https://github.com/bennybenzigar/ai-inbox-helper.git](https://github.com/bennybenzigar/ai-inbox-helper.git) |
| **Git Clone Command** | `git clone https://github.com/bennybenzigar/ai-inbox-helper.git` |

---

## Key Features

1. **Smart Candidate Inbox & Intent Classification:**
   - Automatically tags incoming messages into 6 distinct categories: `Interview Scheduling`, `Application Status`, `Salary & Compensation`, `Document Requests`, `Job Details`, and `Other / Unclear`.
   - Generates contextual, professional reply drafts using **Google Gemini AI** (`gemini-2.5-flash`).
   - Human-in-the-loop review workflow: edit, approve, reject, regenerate, or send drafts.
   - Comprehensive multi-field search, status filtering, and configurable pagination (5, 10, 25, 50, 100 per page).
   - Single and bulk message deletion with confirmation modals.

2. **Gmail Integration & Automated Synchronization:**
   - Google OAuth 2.0 authentication with offline refresh tokens.
   - **Background Auto-Sync:** Server-side background poller pulls new candidate emails every 5 minutes and runs immediately on startup.
   - **On-Demand Manual Sync:** One-click "⟳ Sync Gmail" button in the inbox toolbar with live sync timestamps.
   - **Direct Gmail API Dispatch:** Approved drafts can be sent directly to candidates via Gmail (`users.messages.send`) under the recruiter's authenticated email.

3. **Sent Candidate Communications (Outbox):**
   - Centralized ledger of all approved and dispatched candidate replies.
   - View Reply modal displaying complete recipient details, timestamps, intent categories, and formatted email bodies.
   - Direct thread links to navigate back to original candidate inquiries.

4. **Attendance Pattern Checker:**
   - Ingests timesheet CSVs to detect 5 workforce anomalies:
     - *Overtime:* >12 hours logged in a single day (burnout risk).
     - *Missing Hours:* 0 hours on standard weekdays without recorded approved leave.
     - *Consecutive Leave:* 3 or more consecutive leave days.
     - *Weekend Work:* Work hours logged on Saturday or Sunday.
     - *Inconsistent Record:* Concurrent work hours logged alongside full-day approved leave.
   - Generates one-sentence natural language explanations and severity tagging (`HIGH`, `MEDIUM`, `LOW`).
   - **Full Database Persistence:** Analysis and flagged items persist across sessions in PostgreSQL.
   - Supports filter by anomaly, single deletion, bulk deletion, and CSV export.

5. **Hiring Board Stall Alerter:**
   - Ingests candidate recruitment pipeline boards to identify candidates stuck in stages.
   - Adjustable stall thresholds: $\ge$ 3, 5, 7, 10, or 14 days.
   - Urgency tiers (`Critical`, `High`, `Medium`) weighted by pipeline stage impact (Offer Sent > Technical Interview > Initial Screening).
   - Provides concrete, actionable next steps for recruiters based on the stalled stage.
   - **Full Database Persistence:** Stored and synced with PostgreSQL.

6. **Data Management & Factory Reset:**
   - Single and bulk delete across all lists with automatic pagination clamping.
   - Export datasets to CSV (filtered view or current page snapshot).
   - Soft data clear (removes messages/drafts while preserving Gmail tokens).
   - **Full Factory Reset:** Wipes all database tables clean.

---

## Tech Stack

- **Frontend:** Angular 22, TypeScript, Standalone Components, Angular Signals (`signal`, `computed`), SCSS, RxJS.
- **Backend:** Node.js, Express.js, TypeScript 5.8+ with modern `Node16` resolution, Zod, Helmet, CORS.
- **Database:** PostgreSQL 16 managed database with `pg.Pool` connection pooling and SSL support.
- **AI Engine:** Google Gemini AI API (`@google/genai` or Gemini REST) using `gemini-2.5-flash`.
- **Integrations:** Google OAuth 2.0, Gmail REST API, Google Cloud Pub/Sub webhook ready.
- **Deployment:** Render (`render.yaml` Blueprint).

---

## How to Run Locally

### Prerequisites
- **Node.js:** v20.19.0 or higher
- **npm:** v10+
- **PostgreSQL:** Running locally or a cloud database URL (e.g. Render, Neon, Supabase)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/bennybenzigar/ai-inbox-helper.git
cd ai-inbox-helper
```

### 2. Configure Backend Environment
Navigate to the `backend` folder and create a `.env` file:
```bash
cd backend
cp .env.example .env
```
Open `.env` in your text editor and supply your credentials (see the [Key Generation Guide](#how-to-generate-environment-keys-and-credentials) below).

Example `.env`:
```env
PORT=3000
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:4200
SESSION_SECRET=dev-session-secret-at-least-32-chars-long

# Database (PostgreSQL)
DATABASE_URL=postgres://postgres:password@localhost:5432/ai_inbox_helper

# Google Gemini AI Key
AI_PROVIDER=gemini
AI_API_KEY=AIzaSy...
AI_MODEL=gemini-2.5-flash

# Google OAuth & Gmail API
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Demo mode (set false to use live database & Gemini)
DEMO_MODE=false
```

### 3. Install Backend Dependencies & Start Server
```bash
# Still in backend/ directory
npm install
npm run build
npm run dev
```
The backend API will start on `http://localhost:3000`. You should see:
```
Connected to PostgreSQL (ai_inbox_helper). Tables and Gmail service verified.
AI Inbox Helper API listening on http://localhost:3000
```

### 4. Install Frontend Dependencies & Start App
In a **new terminal**:
```bash
cd ai-inbox-helper/frontend
npm install
npm start
```
The Angular development server will start at `http://localhost:4200`. Open your browser and navigate to `http://localhost:4200`.

---

## How to Generate Environment Keys and Credentials

### 1. Google Gemini AI API Key (`AI_API_KEY`)
1. Go to **Google AI Studio**: [https://aistudio.google.com/](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click the **"Get API key"** button on the top left or banner.
4. Click **"Create API key in new project"** (or select an existing Google Cloud project).
5. Copy the generated API key (it begins with `AIzaSy...`).
6. Paste it into your backend `.env`:
   ```env
   AI_PROVIDER=gemini
   AI_API_KEY=AIzaSy...
   AI_MODEL=gemini-2.5-flash
   ```

---

### 2. Google OAuth 2.0 & Gmail API Credentials (`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`)
To enable real Gmail mailbox authorization, sync, and reply sending:

#### Step A: Create or Select a Google Cloud Project
1. Open the **Google Cloud Console**: [https://console.cloud.google.com/](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and click **"New Project"**.
3. Name your project (e.g. `AI Inbox Helper`) and click **Create**.

#### Step B: Enable Required Google APIs
1. Navigate to **APIs & Services** > **Library** from the left navigation menu.
2. Search for **"Gmail API"**, click on it, and click **Enable**.
3. Search for **"Google People API"** (or Google OAuth2 API), click on it, and click **Enable**.

#### Step C: Configure the OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required fields:
   - **App name:** `AI Inbox Helper`
   - **User support email:** Your email address
   - **Developer contact information:** Your email address
4. Click **Save and Continue**.
5. In the **Scopes** step, click **Add or Remove Scopes** and select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `https://www.googleapis.com/auth/gmail.readonly` (Read-only access to messages)
   - `https://www.googleapis.com/auth/gmail.send` (Optional: for sending replies via Gmail API)
6. Click **Save and Continue**.
7. In the **Test users** step:
   - Click **Add Users**.
   - Enter your personal or test Gmail address (e.g. `yourname@gmail.com`).
   - *Note: While in Testing mode, only added test users can authorize the app.*
8. Click **Save and Continue** to finish.

#### Step D: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** at the top > **OAuth client ID**.
3. Select **Web application** as the Application type.
4. Set **Name:** `AI Inbox Helper Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:4200`
   - `https://ai-inbox-frontend.onrender.com`
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/auth/google/callback` (for local development)
   - `https://ai-inbox-backend.onrender.com/auth/google/callback` (for Render production)
7. Click **Create**.
8. A modal appears displaying your **Client ID** and **Client Secret**.
9. Copy them into your backend `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   ```
   *(For Render production, update `GOOGLE_CALLBACK_URL` to `https://ai-inbox-backend.onrender.com/auth/google/callback`).*

---

### 3. PostgreSQL Database (`DATABASE_URL`)

#### Local PostgreSQL Setup
If you have PostgreSQL installed locally:
1. Open terminal / `psql`:
   ```sql
   CREATE DATABASE ai_inbox_helper;
   ```
2. Set your connection string in `.env`:
   ```env
   DATABASE_URL=postgres://postgres:YourPassword@localhost:5432/ai_inbox_helper
   ```
*(The backend automatically creates all 11 required tables on startup via `initDatabase()`.)*

#### Cloud PostgreSQL (Render / Neon / Supabase)
1. On **Render**: When deploying with `render.yaml`, Render automatically provisions a managed PostgreSQL database and injects `DATABASE_URL` into the backend environment.
2. Alternatively, create a free database at [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com).
3. Copy the pooled connection string (with SSL enabled) and paste it into `DATABASE_URL`.

---

## 5-Day Development Journey & Log

### Day 1 — Foundation & Core Application Architecture
- Initialized Angular 22 standalone frontend and Node.js/Express backend with TypeScript.
- Configured PostgreSQL connection pool (`pg.Pool`) and relational schema for messages, drafts, review events, and activity logs.
- Built core views: Dashboard (analytics metrics), Candidate Inbox (message lists, search, intent filters), and Settings.
- Created reusable UI components: badges, stat cards, confirm modals, and toast notifications.
- Added Vitest and backend unit test suites; verified end-to-end routing and CRUD operations.

### Day 2 — Gemini AI, Gmail Integration, Outbox Module & Render Deployment
- Integrated **Google Gemini AI** (`gemini-2.5-flash`) for automated candidate response drafting with prompt-injection defense.
- Built Gmail OAuth 2.0 flow with offline refresh token persistence and live mailbox sync.
- **Workflow Discovery:** Identified that recruiters lacked visibility into sent communications; built the **Outbox** module (`/outbox`) with reply preview modals and message thread deep-links.
- Planned pagination and scaling controls for handling large datasets and filters.
- Authored Render Blueprint (`render.yaml`) and deployed the live application to Render (frontend, backend, and PostgreSQL).

### Day 3 — Feature Completion, Unit Testing, Pagination Resolution & Hardening
- **Completed full feature set:**
  - Implemented reusable `<app-paginator>` with configurable page sizing (5, 10, 25, 50, 100 rows per page) across Inbox, Outbox, Dashboard, Attendance, and Stall Alerter.
  - Resolved critical pagination edge cases: moved paginators outside empty-guards and added `clampPageAfterDelete()` to prevent UI lockup when pages are emptied.
  - Built **Attendance Pattern Checker** (`/attendance`) with 5 anomaly detectors and one-sentence explanations.
  - Built **Hiring Board Stall Alerter** (`/stall-alerter`) with configurable stall thresholds (3–14 days) and urgency ranking.
  - Added full PostgreSQL database persistence for Attendance and Stall Alerter records across sessions.
  - Added automated background Gmail synchronization (every 5 minutes) in `server.ts` plus a manual "⟳ Sync Gmail" button in the Inbox.
  - Added single and bulk deletion capabilities with confirmation modals across all modules.
  - Enforced strict CSV validation to reject empty files, title-only CSVs, and blank comma rows with HTTP 400.
  - Resolved TypeScript `Node16` resolution and Render production build dependencies.
  - Ran unit tests across frontend and backend; verified all features working with 0 errors.

### Day 4 — Final Audit, Documentation & Task Submission
- Conducted full visual and regression testing of all routes on the live Render deployment.
- Cleaned up obsolete scratch files from the repository.
- Finalized core documentation deliverables:
  - `intent.md` — Product vision, intent taxonomy, multi-tool architecture, and safety principles.
  - `Final directive.md` — Authoritative technical directive, database schemas, and engineering specifications.
  - `README.md` — Comprehensive documentation with local setup guide, detailed key generation instructions (Google OAuth, Gemini AI, PostgreSQL), and API reference.
- Formally submitted the completed task and repository links (`https://github.com/bennybenzigar/ai-inbox-helper.git`) for evaluation.

### Day 5 — Post-Submission Monitoring & Operational Review
- Monitored Render web service uptime, background daemon performance, and database connection pooling.
- Performed cross-browser validation (Chrome, Firefox, Edge, mobile viewports).
- Conducted operational reflection on human-in-the-loop AI workflows and cross-origin authentication resilience.
- Confirmed zero open issues in production.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & database connection status |
| `GET` | `/api/status` | System mode, database engine, and Gmail connection state |
| `GET` | `/api/dashboard` | Dashboard analytics, intent distributions, and recent activity |
| `GET` | `/api/messages` | Paginated candidate messages with search, intent, and status filters |
| `POST` | `/api/messages/upload-csv` | Import candidate messages via CSV |
| `GET` | `/api/messages/export-csv` | Export candidate messages to CSV |
| `POST` | `/api/messages/bulk-delete` | Bulk delete candidate messages |
| `GET` | `/api/messages/:id` | Retrieve single message thread and draft |
| `DELETE` | `/api/messages/:id` | Delete a single candidate message |
| `POST` | `/api/messages/:id/draft` | Generate new AI draft for message |
| `PATCH` | `/api/drafts/:id` | Save edited draft content |
| `POST` | `/api/drafts/:id/approve` | Approve draft |
| `POST` | `/api/drafts/:id/reject` | Reject draft |
| `POST` | `/api/drafts/:id/send` | Send approved draft to candidate via Gmail API |
| `GET` | `/api/outbox` | Paginated sent candidate messages |
| `GET` | `/api/tools/attendance` | Retrieve saved attendance analysis & flags |
| `POST` | `/api/tools/attendance/analyze` | Parse timesheet CSV and persist flags to PostgreSQL |
| `DELETE` | `/api/tools/attendance/flags/:id` | Delete single attendance flag from database |
| `POST` | `/api/tools/attendance/flags/bulk-delete` | Bulk delete attendance flags from database |
| `GET` | `/api/tools/stall-alerter` | Retrieve saved stalled candidate queue |
| `POST` | `/api/tools/stall-alerter/analyze` | Parse board CSV and persist stalled alerts to PostgreSQL |
| `DELETE` | `/api/tools/stall-alerter/alerts/:id` | Delete single stall alert from database |
| `POST` | `/api/tools/stall-alerter/alerts/bulk-delete` | Bulk delete stall alerts from database |
| `GET` | `/auth/google` | Initiate Google OAuth 2.0 flow |
| `GET` | `/auth/google/callback` | OAuth 2.0 callback handling |
| `POST` | `/auth/disconnect` | Disconnect Gmail account |
| `POST` | `/api/gmail/sync` | Trigger on-demand Gmail mailbox synchronization |
| `GET` | `/api/gmail/sync-status` | Check live sync timestamps and connection status |
| `DELETE` | `/api/data/clear` | Clear candidate messages and drafts |
| `DELETE` | `/api/data/factory-reset` | Full factory reset (wipes all tables) |

---

## License & Credits

Built for the Match Hire Talent Operations Quest.  
Developed by Benny Benzigar.  
Repository: [https://github.com/bennybenzigar/ai-inbox-helper](https://github.com/bennybenzigar/ai-inbox-helper)
