# Final Directive — AI Inbox Helper

**Status:** Production Ready · Deployed on Render  
**Repository:** [https://github.com/bennybenzigar/ai-inbox-helper.git](https://github.com/bennybenzigar/ai-inbox-helper.git)  
**Frontend Deployment:** [https://ai-inbox-frontend.onrender.com](https://ai-inbox-frontend.onrender.com)  
**Backend Deployment:** [https://ai-inbox-backend.onrender.com](https://ai-inbox-backend.onrender.com)  

---

## 1. Architectural Architecture & Principles

### 1.1. Frontend Architecture
- **Framework:** Angular 22 (Standalone Components, no legacy `NgModule`).
- **State Management:** Angular Signals (`signal()`, `computed()`) for responsive, predictable UI state; RxJS streams utilized for HTTP and SSE event subscriptions.
- **Routing:** Fully lazy-loaded feature routes (`Dashboard`, `Inbox`, `Outbox`, `IntentGroups`, `GmailConnection`, `Attendance`, `StallAlerter`, `Settings`, `MessageDetail`).
- **Styling:** Modular SCSS per component following modern typography, card elevations, color-coded badges, and accessible contrast ratios.
- **Components & Modals:** Centralized reusable components: `<app-paginator>`, `<app-confirm-modal>`, `<app-loading-spinner>`, `<app-intent-badge>`, and `<app-stat-card>`.
- **Defensive UI:** Safe pagination visibility based on total record counts, page clamping upon item deletions, and interactive multi-select action bars.

### 1.2. Backend Architecture
- **Runtime:** Node.js (v20+ / LTS), TypeScript 5.8+ configured with `"module": "Node16"` and `"moduleResolution": "Node16"`.
- **Framework:** Express.js with Helmet security headers, CORS origin whitelisting, cookie parsing, and rate limiting (180 requests/min).
- **Validation:** Zod schemas for all inbound mutation payloads, query parameters, and environment variables.
- **Event Bus:** In-memory Server-Sent Events (SSE) broadcasting real-time notifications to connected clients (`messages-updated`, `draft-updated`, `gmail-notification-received`).
- **Module Separation:** Clean separation of concerns across `routes/`, `services/`, `repositories/`, `models/`, and `database/`.

### 1.3. Database Architecture (PostgreSQL)
- **Database Engine:** PostgreSQL 16 managed database on Render (with automatic fallback to local connection parameters).
- **Connection Management:** High-performance `pg.Pool` with SSL support (`rejectUnauthorized: false`), connection timeouts, and connection recycling.
- **Complete Schema Definition (11 Tables):**
  1. `messages`: Stores candidate inquiries, sender metadata, intent classification, confidence scores, and Gmail message IDs.
  2. `drafts`: Stores AI-generated and human-reviewed response drafts with versioning, review timestamps, and approval statuses (`pending`, `approved`, `sent`, `rejected`).
  3. `activity`: Audit logs recording system and recruiter actions.
  4. `sync_checkpoints`: Checkpoints tracking Gmail sync progress, last sync timestamps, history IDs, and push expiration dates.
  5. `review_events`: Operational ledger capturing reviewer decisions and version increments.
  6. `audit_events`: System audit records for security and compliance.
  7. `connection_metadata`: Key-value storage for encrypted OAuth refresh tokens and connected Gmail accounts.
  8. `attendance_flags`: Flagged attendance anomalies, hours worked, leave types, severity ratings, and explanations.
  9. `attendance_meta`: Aggregate metrics for timesheet analysis (total records, employee counts).
  10. `stall_alerts`: Prioritized queue of stalled candidates, days in stage, recruiter assignments, urgency, and recommended actions.
  11. `stall_meta`: Parameters for pipeline stall analysis (threshold days, total candidate count).

---

## 2. AI & Intent Classification Engine

- **Provider:** Google Gemini API (`@google/genai` or Gemini REST) using `gemini-2.5-flash`.
- **Dynamic Module Loading:** Dynamic import syntax used for ESM-only AI libraries, eliminating CommonJS compatibility errors.
- **Intent Classifier:**
  - Fast-path regex heuristic classification across 6 intent categories (`Interview Scheduling`, `Application Status`, `Salary & Compensation`, `Document Requests`, `Job Details`, `Other / Unclear`).
  - Fallback to deep contextual LLM analysis when heuristic confidence is low.
- **Context-Bounded Prompting:** Prompt templates enforce strict bounds:
  - Rejection of prompt injection attacks (candidate emails cannot alter instructions).
  - Explicit prohibition against hallucinating salary ranges, dates, or non-public policies.
  - Polished, professional, and empathetic recruiter tone.

---

## 3. Gmail Integration Architecture

- **OAuth 2.0 Integration:** Requests `openid`, `email`, and `https://www.googleapis.com/auth/gmail.readonly` scopes.
- **Cross-Origin Cookie Resiliency:** OAuth state validation utilizes a secure, expiring server-side state map in memory, ensuring seamless authentication even when cross-site cookie restrictions block cookies across Render subdomains.
- **Automated Background Sync:** A server-side daemon timer triggers `syncGmailMessages()` every 5 minutes and runs immediately upon container startup.
- **Real Mailbox Send:** Approved drafts are formatted into standard RFC 2822 MIME envelopes, base64url encoded, and dispatched via the official Google Gmail API `users.messages.send` method.
- **Pub/Sub Push Notifications:** Implemented endpoints for Google Cloud Pub/Sub webhook pushes and incremental History API (`users.history.list`) sync with 404 expiration recovery.

---

## 4. HR Productivity Modules

### 4.1. Outbox
- Captures sent emails dispatched via Gmail or manual approval.
- Full sent message previews, thread deep-links, and audit history.
- Real-time synchronization when candidate replies are approved or sent.

### 4.2. Attendance Pattern Checker
- Analyzes work hours CSVs for 5 key labor anomalies:
  1. *Overtime:* > 12 working hours in a single shift.
  2. *Missing Hours:* 0 hours on standard weekdays without recorded approved leave.
  3. *Consecutive Leave:* 3 or more consecutive leave days.
  4. *Weekend Work:* Work hours logged on Saturday or Sunday.
  5. *Inconsistent Record:* Concurrent work hours logged alongside full-day approved leave.
- Severity scoring (`HIGH`, `MEDIUM`, `LOW`) and single-sentence natural language explanations.
- Full PostgreSQL database persistence across user sessions.

### 4.3. Hiring Board Stall Alerter
- Ingests hiring board pipelines to calculate days elapsed per stage.
- Adjustable sensitivity thresholds: 3, 5, 7, 10, and 14 days.
- Urgency tiers (`Critical`, `High`, `Medium`) weighted by pipeline impact (Offer Sent > Technical Interview > Initial Screening).
- Stage-tailored recommendations directing recruiter action.
- Full PostgreSQL database persistence across user sessions.

---

## 5. Security & Reliability Guardrails

1. **Human-in-the-Loop Governance:** AI drafts require explicit recruiter review, edit, approval, or send confirmation.
2. **Untrusted Content Sanitization:** Inbound email text is treated as raw data; prompt injection boundaries prevent unauthorized actions.
3. **Strict CSV Validation:** Backend parsers reject empty files, header-only CSVs, and empty comma rows with HTTP 400.
4. **Credential Isolation:** OAuth secrets, API keys, and database passwords reside exclusively in environment variables and are never bundled into client assets.
5. **Database Transaction Safety:** Multi-table operations utilize explicit `BEGIN ... COMMIT / ROLLBACK` database transactions.

---

## 6. Build & Deployment Specifications

- **Render Infrastructure:** Managed by `render.yaml` declaring:
  - Web Service (Node.js): `ai-inbox-backend`
  - Static Site (Angular): `ai-inbox-frontend`
  - PostgreSQL Database: `ai-inbox-postgres`
- **Build Verification:**
  - Backend: `npm run build` (`tsc -p tsconfig.json`) passes with exit code 0.
  - Frontend: `ng build` passes with exit code 0; all chunks and styles emitted cleanly.
  - Unit Tests: Backend Vitest/Jest suites and frontend Angular unit test suites passing.
