# Five-minute Loom walkthrough

**0:00–0:35 — Problem and architecture**
Explain that candidate emails are grouped by intent and AI only suggests replies. Show the Angular + Express + SQLite architecture.

**0:35–1:20 — Dashboard**
Import demo data and show message counts, pending drafts, intent groups, and recent activity. Identify sample data as synthetic.

**1:20–2:00 — Inbox and intent groups**
Search for a candidate, filter by intent/status, and open a message.

**2:00–3:15 — Draft workflow**
Generate or edit a draft, save it, then approve or reject. Explicitly show that approval records a review decision and does not send an email.

**3:15–4:05 — Engineering choices**
Show Signals state, API service, deterministic mock provider, SQLite persistence, and backend tests.

**4:05–5:00 — Honest limitations and learnings**
Show the Gmail integration status page and explain what is scaffolded versus not complete: secure credential storage, Gmail history processing, verified Pub/Sub authentication, watch renewal, and reconciliation. Share actual test output and one real failure/limitation from your work; do not invent one.
