# Day 2 — Gemini AI, Gmail Integration, Outbox Module & Render Deployment

### Objective
Integrate Google Gemini AI for smart candidate response drafting, connect Gmail via OAuth 2.0, implement the Outbox module discovered during testing, conceptualize pagination for large datasets, and deploy the application to Render.

### Work Completed
- **Gemini AI Integration:**
  - Integrated `@google/genai` (with fallback to Gemini REST / OpenAI-compatible API).
  - Configured `gemini-2.5-flash` model for intelligent, context-bounded candidate reply draft suggestions.
  - Implemented prompt-injection guardrails preventing untrusted candidate email bodies from hijacking system directives.
- **Gmail OAuth 2.0 Integration:**
  - Configured Google OAuth 2.0 client requesting `gmail.readonly`, `email`, and `openid` scopes.
  - Implemented offline refresh token handling and token persistence in PostgreSQL `connection_metadata`.
  - Built Gmail API sync service to fetch candidate emails and generate initial drafts.
  - Built real Gmail reply dispatching via `users.messages.send` with RFC 2822 MIME base64url encoding.
- **Outbox Discovery & Implementation:**
  - During end-to-end testing, realized that a critical workflow piece was missing: recruiters had no way to view or audit previously dispatched candidate communications.
  - Created the **Outbox** module (`/outbox`) to maintain a persistent ledger of all approved and dispatched candidate replies.
  - Implemented reply preview modal with recipient details, timestamps, intent category, and thread links.
- **Pagination Concept & Data Scaling:**
  - Anticipated data volume challenges with large inboxes and planned client/server pagination, search debouncing, and filtering controls.
- **Render Production Deployment:**
  - Authored Infrastructure-as-Code blueprint (`render.yaml`) configuring:
    - `ai-inbox-postgres`: Managed PostgreSQL instance.
    - `ai-inbox-backend`: Node.js Web Service.
    - `ai-inbox-frontend`: Angular Static Site.
  - Deployed the live application to Render:
    - Frontend: `https://ai-inbox-frontend.onrender.com`
    - Backend: `https://ai-inbox-backend.onrender.com`
