# Architecture

```text
Angular SPA (Signals, Router, HttpClient)
  ├─ Dashboard / Inbox / Intent Groups / Message Detail / Gmail Setup
  ├─ ApiService ────────────────> Express REST API
  └─ EventService <────────────── SSE /api/events
                                      ├─ SQLite repositories
                                      ├─ deterministic intent classifier
                                      ├─ AIProvider interface (mock default)
                                      └─ Gmail / Pub/Sub adapters (integration scaffold)
```

## Demo message flow
1. User imports synthetic candidate messages.
2. Backend classifies messages with deterministic rules and stores them in SQLite.
3. Mock AI provider creates a draft for each sample message.
4. Frontend loads dashboard, messages, and drafts through the API.
5. Reviewer edits a pending draft and saves it, or approves/rejects it.
6. Backend records status and review event. It does not send email.

## Intended Gmail push flow
Google OAuth -> encrypted server-side credential store -> initial sync -> Gmail `watch` -> Pub/Sub notification -> verified HTTPS webhook -> Gmail History API changes -> deduplicated persistence -> SSE client event. Add a scheduled reconciliation job and renew Gmail watch before expiration. This is the intended design, not a fully operational feature in the current starter.
