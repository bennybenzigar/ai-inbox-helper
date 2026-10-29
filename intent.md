# Intent — AI Inbox Helper

## 1. Executive Summary
**AI Inbox Helper** is an enterprise-grade recruiting operations and candidate communication platform. It streamlines the talent acquisition lifecycle by combining AI-driven intent classification, human-in-the-loop email drafting, live Gmail mailbox synchronization, candidate pipeline stall detection, and attendance anomaly analysis into a single, high-performance web application.

- **Frontend Application (Live):** [https://ai-inbox-frontend.onrender.com](https://ai-inbox-frontend.onrender.com)
- **Backend API (Live):** [https://ai-inbox-backend.onrender.com](https://ai-inbox-backend.onrender.com)
- **Source Code Repository:** [https://github.com/bennybenzigar/ai-inbox-helper.git](https://github.com/bennybenzigar/ai-inbox-helper.git)

---

## 2. Core Problem Statement

Modern recruiting teams face five operational bottlenecks:
1. **Inbox Overload & Inconsistent Responses:** Recruiters receive hundreds of candidate inquiries daily across various stages (interview coordination, salary questions, application updates, document submissions). Manually categorizing and answering each inquiry leads to slow response times, inconsistent tone, and candidate drop-off.
2. **Missing Visibility of Sent Outreach:** Teams lack a centralized, searchable outbox to verify whether candidate responses were dispatched, who approved them, and what message content was sent.
3. **Pipeline Bottlenecks (Stalled Candidates):** High-priority candidates often sit unattended in interview stages for 5–14+ days without proactive recruiter nudges, leading to lost talent and poor candidate experience.
4. **Attendance Anomaly Blindspots:** Remote and hybrid work environments make it difficult to catch irregular hours, excessive overtime (>12h/day burnout risk), unapproved missing hours, and weekend work patterns.
5. **AI Safety & Hallucination Risks:** Fully automated bots risk sending incorrect information (hallucinated salary bands, fake interview slots, or non-compliant statements). Recruiters need **AI leverage with strict human-in-the-loop governance**.

---

## 3. Product Scope & Functional Modules

### 3.1. Smart Candidate Inbox & AI Draft Assistant
- **6 Intent Categories:** Automatically classifies incoming candidate communications into:
  1. `Interview Scheduling`
  2. `Application Status`
  3. `Salary & Compensation`
  4. `Document Requests`
  5. `Job Details`
  6. `Other / Unclear`
- **Google Gemini AI Draft Generation:** Generates concise, professional, context-aware reply drafts using Google Gemini (`gemini-2.5-flash`).
- **Human-in-the-Loop Review:** Recruiters can view AI suggestions, modify text in an inline editor, approve drafts, regenerate with AI, or reject suggestions.
- **Search, Filter & Pagination:** Full search across sender name, email, subject, and body; filters by Intent and Review Status; server-side pagination with row-count selectors (5, 10, 25, 50, 100).
- **Single & Bulk Deletion:** Multi-select checkboxes to delete individual messages or bulk purge candidate records with confirmation modals.
- **CSV Data Import/Export:** Upload candidate messages via CSV with header auto-detection, sample template downloads, and filtered CSV exports.

### 3.2. Live Gmail Integration & Auto-Sync
- **Google OAuth 2.0:** Secure read-only access (`gmail.readonly`) with offline refresh tokens for background operation.
- **Automated Background Polling:** The backend automatically syncs new emails every 5 minutes and runs immediate checks upon server startup.
- **On-Demand Synchronization:** A dedicated "⟳ Sync Gmail" button allows instant on-demand mailbox pulls with live timestamp indicators.
- **Real Send Delivery:** Approved messages can be directly dispatched through the official Google Gmail REST API (`users.messages.send`) under the recruiter's authenticated Google account.
- **Pub/Sub Push Webhook Ready:** Full infrastructure for Google Cloud Pub/Sub push notifications and History API incremental synchronization.

### 3.3. Outbox (Sent Candidate Communications)
- **Sent Message Ledger:** Logs every message sent to candidates, whether through the live Gmail API or manual approval.
- **Full Reply Preview:** Dedicated modal displaying full recipient details, timestamps, intent category, and formatted email body.
- **Thread Linkage:** One-click navigation back to the original message thread for complete conversation context.
- **Single & Bulk Record Deletion:** Allows purging sent logs with automatic pagination clamping.

### 3.4. Attendance Pattern Checker
- **Anomaly Detection Engine:** Evaluates team timesheet records against labor compliance guidelines:
  - *Overtime (>12 hrs)* — Flags potential burnout and labor rule violations.
  - *Missing Hours (0 hrs on weekday)* — Flags unapproved absences with no recorded leave.
  - *Consecutive Leave (>=3 days)* — Flags extended absence stretches for HR planning.
  - *Weekend Work* — Flags Saturday/Sunday logs requiring overtime compensation.
  - *Inconsistent Records* — Flags concurrent leave and work hour claims.
- **One-Sentence Explanations:** Every flagged record receives an AI/heuristic summary explaining the root cause in plain English.
- **Database Persistence:** All uploaded attendance analyses, flagged items, and summaries are stored in PostgreSQL and persist across reloads.
- **Interactive Management:** Severity tagging (`HIGH`, `MEDIUM`, `LOW`), filter by pattern flag, single-record deletion, multi-record bulk deletion, and CSV result exports.

### 3.5. Hiring Board Stall Alerter
- **Hiring Pipeline Velocity:** Ingests candidate board tracking CSVs and identifies candidates languishing in any recruitment stage.
- **Configurable Stall Thresholds:** Selectable sensitivity limits (`≥ 3 Days`, `≥ 5 Days (Default)`, `≥ 7 Days`, `≥ 10 Days`, `≥ 14 Days`).
- **Priority Ranking & Urgency:** Weighted ranking system assigning urgency tiers (`Critical`, `High`, `Medium`) based on stage criticality (e.g. Offer Sent / Final Round vs. Initial Resume Screening).
- **Action Recommendations:** Contextual recommendations for each stalled stage (e.g., prompt HR VP for offer approval, follow up with engineering panel for coding scorecards, call candidate to negotiate compensation).
- **Database Persistence:** Full PostgreSQL backing for candidate alerts, summaries, and threshold settings.

### 3.6. Application Settings & Data Management
- **Pagination Preferences:** Configurable rows-per-page (5, 10, 25, 50, 100) applied across all tables.
- **Clear Candidate Data:** Purges candidate messages, drafts, review events, and activity while preserving Gmail OAuth connections.
- **Full Factory Reset:** Performs a complete wipe of all tables (`messages`, `drafts`, `review_events`, `audit_events`, `activity`, `attendance_flags`, `attendance_meta`, `stall_alerts`, `stall_meta`, `sync_checkpoints`, `connection_metadata`).

---

## 4. Safety & Governance Architecture

1. **Strict Human Review (Zero Autonomous Sending):** Approving a draft records an operational decision. No candidate receives an email unless explicitly triggered by a recruiter.
2. **Untrusted Inbound Sanitization:** Inbound emails are treated as untrusted data. Email content cannot execute prompt injections or manipulate backend instructions.
3. **No Client-Side Secrets:** Google OAuth Client Secrets, refresh tokens, and Gemini AI keys remain exclusively on the server. Angular only receives sanitized status flags.
4. **Parameterized SQL:** All queries use parameterized inputs (`$1, $2, ...`), preventing SQL injection.
5. **Empty CSV Guardrails:** The system rejects empty files, header-only CSVs, and blank comma lines with HTTP 400 responses.

---

## 5. Intended User Personas

| Persona | Primary Goal | App Benefit |
|---|---|---|
| **Senior Recruiter** | High-touch candidate communication | Generates polished replies in seconds, edits tone, sends via Gmail. |
| **Recruitment Coordinator** | Interview logistics & scheduling | Prioritizes scheduling requests; exports filtered candidate lists. |
| **Talent Acquisition Lead** | Pipeline health & SLA compliance | Uses Stall Alerter to prevent candidates from sitting in offer stages. |
| **HR Operations Manager** | Workforce & compliance tracking | Uses Attendance Checker to spot overtime violations and attendance gaps. |
