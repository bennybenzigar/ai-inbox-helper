# System Architecture — AI Inbox Helper

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ANGULAR 22 FRONTEND                                  │
│                          (Standalone Components, Signals & SCSS)                       │
│                                                                                        │
│  ├─ Dashboard             ├─ Candidate Inbox          ├─ Outbox (Sent Emails)          │
│  ├─ Intent Groups         ├─ Message Details          ├─ Gmail Connection              │
│  ├─ Attendance Checker    ├─ Stall Alerter            ├─ Application Settings          │
│                                                                                        │
│        │ HTTP / REST                                         ▲ SSE Stream              │
│        ▼                                                     │ (/api/events)           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                  NODE.JS / EXPRESS API                                 │
│                     (TypeScript with Node16 Resolution & Zod Validation)               │
│                                                                                        │
│  ├─ Route Handlers: /api/messages, /api/drafts, /api/outbox, /auth/google,            │
│  │                  /api/tools/attendance, /api/tools/stall-alerter, /api/gmail        │
│  ├─ Event Bus: In-memory SSE broadcast for live UI synchronization                    │
│  ├─ Background Sync Daemon: 5-minute unref'd timer for automated mailbox pulls        │
│  ├─ AI Service: Google Gemini AI (gemini-2.5-flash) with regex intent fallback         │
│  └─ Repository Layer: Parameterized SQL transactions & error handling                  │
│                                                                                        │
│        │ PostgreSQL Connection Pool (pg.Pool)                                         │
│        ▼                                                                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                             POSTGRESQL 16 MANAGED DATABASE                             │
│                                                                                        │
│  ├─ messages                ├─ drafts               ├─ activity                        │
│  ├─ sync_checkpoints        ├─ review_events        ├─ audit_events                    │
│  ├─ connection_metadata     ├─ attendance_flags     ├─ attendance_meta                 │
│  ├─ stall_alerts            └─ stall_meta                                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Core Workflow Lifecycles

### 1.1. Candidate Message & Review Lifecycle
```text
Candidate Email (Gmail) / CSV Upload
               │
               ▼
Intent Classifier (Regex Heuristic + Google Gemini AI)
               │
               ▼
Generated Reply Draft (gemini-2.5-flash) ──► Stored as "pending" in PostgreSQL
               │
               ▼
Recruiter Review UI (/inbox or /messages/:id)
   ├─► Edit Draft text (inline editor)
   ├─► Regenerate Draft (via Gemini AI)
   ├─► Reject Draft (marked "rejected")
   └─► Approve & Send (dispatches via Gmail REST API users.messages.send)
               │
               ▼
Logged in Outbox (/outbox) & Activity Log (audit trail)
```

### 1.2. Automated Gmail Background Synchronization
1. Server initializes PostgreSQL connection pool and verifies table schemas.
2. Background timer fires immediately on startup and repeats **every 5 minutes** via `server.ts`.
3. Checks `isGmailConnected()`. If active OAuth tokens exist:
   - Fetches unread/recent candidate emails from Gmail API (`users.messages.list`).
   - Deduplicates messages using `gmail_message_id`.
   - Parses RFC 2822 email payload (From, Subject, Date, Body, Attachments).
   - Classifies message intent and automatically generates an initial draft via Gemini AI.
   - Inserts records into `messages` and `drafts` within a PostgreSQL transaction.
   - Updates `sync_checkpoints` with `lastSyncedAt`.
   - Broadcasts `messages-updated` over the SSE stream so open inboxes refresh automatically.
4. Recruiters can also trigger an immediate on-demand mailbox fetch via the **"⟳ Sync Gmail"** button in the Inbox toolbar.

### 1.3. Attendance Compliance Pattern Checker
```text
Timesheet CSV Upload (/attendance)
               │
               ▼
Validation Engine: Rejects empty or header-only files (HTTP 400)
               │
               ▼
Labor Compliance Anomaly Engine
   ├─ Overtime: > 12 working hours in a day
   ├─ Missing Hours: 0 hours on weekday without recorded leave
   ├─ Consecutive Leave: >= 3 consecutive leave days
   ├─ Weekend Work: Work hours logged on Saturday / Sunday
   └─ Inconsistent Record: Concurrent work hours with full-day leave
               │
               ▼
Natural Language Explanation Generator + Severity Scorer (HIGH, MEDIUM, LOW)
               │
               ▼
Persisted into PostgreSQL (attendance_flags & attendance_meta)
               │
               ▼
UI displays interactive grid with filter, export to CSV, and single/bulk deletion
```

### 1.4. Hiring Board Stall Alerter
```text
Candidate Pipeline Board CSV Upload (/stall-alerter)
               │
               ▼
Threshold Selector: 3, 5, 7, 10, or 14 days
               │
               ▼
Pipeline Velocity Evaluator: Computes daysInStage vs threshold
               │
               ▼
Priority Ranking Engine:
   ├─ Critical Urgency (Offer Sent, Offer Pending)
   ├─ High Urgency (Technical Interview, Manager Interview)
   └─ Medium Urgency (Screening, Applied)
               │
               ▼
Next-Action Recommendation Engine: Specific guidance per stalled stage
               │
               ▼
Persisted into PostgreSQL (stall_alerts & stall_meta)
```

---

## 2. Security & Guardrails

1. **Human-in-the-Loop:** Approving a draft records a review decision. No emails are ever dispatched autonomously.
2. **Untrusted Data Isolation:** Candidate email text is treated as raw data; prompt injection boundaries prevent candidate messages from overriding system instructions.
3. **No Client-Side Secrets:** Google OAuth secrets, refresh tokens, and Gemini AI keys reside solely on the server in environment variables.
4. **Parameterized SQL:** All queries use parameterized queries (`$1, $2, ...`), protecting against SQL injection attacks.
5. **Cross-Origin OAuth Resiliency:** State tokens are validated via an expiring server-side state map in memory, eliminating cookie drops across Render subdomains.
