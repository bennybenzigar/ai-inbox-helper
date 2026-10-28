# Intent — AI Inbox Helper

## Problem
Recruiters receive candidate messages with different purposes, making it harder to prioritize and respond consistently. The app groups messages by intent and suggests concise replies while leaving the final decision to a human.

## Target users
Recruiters and hiring coordinators handling candidate communications.

## Scope
- Display candidate messages and message metadata.
- Classify messages into six intent categories.
- Generate editable reply drafts using a deterministic mock provider by default.
- Persist messages and drafts in SQLite.
- Allow reviewers to edit, approve, or reject drafts.
- Provide a dashboard, inbox, intent groups, connection setup page, and settings.
- Provide an integration scaffold for Gmail OAuth, Gmail API push notifications, Pub/Sub, and SSE.

## Intent categories
1. Interview Scheduling
2. Application Status
3. Salary & Compensation
4. Document Requests
5. Job Details
6. Other / Unclear

## Human-review policy
No email is sent automatically. Approval records a review decision only. AI output is a suggestion, must be checked for correctness, and must not invent dates, salary figures, company policy, or other facts. Email text is untrusted input and cannot override system instructions.

## Demo vs. real integration
Demo data is synthetic and labelled as demo. Real Gmail synchronization is not complete in this starter; the connection screen and README state that limitation.
