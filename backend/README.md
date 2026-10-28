# AI Inbox Helper — Backend

Node.js + TypeScript + Express + SQLite API. Demo mode runs without Google Cloud or AI credentials.

## Requirements
- Node.js 20.19+ (or a newer supported LTS)
- npm

## Run
```bash
cp .env.example .env
npm install
npm run dev
```
API defaults to `http://localhost:3000`. Check `GET /api/health`. Import sample data with `POST /api/demo/import` and JSON `{ "count": 24 }`.

## API summary
- `GET /api/health`, `GET /api/status`, `GET /api/dashboard`
- `GET /api/messages?q=&intent=&status=`, `GET /api/messages/:id`
- `GET /api/drafts?status=`, `POST /api/messages/:id/draft`
- `PATCH /api/drafts/:id` with `{ "body": "..." }`
- `POST /api/drafts/:id/regenerate`, `/approve`, `/reject`
- `GET /api/intents`, `GET /api/events` (SSE)
- `POST /api/demo/import`, `DELETE /api/demo/data`
- `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/disconnect`
- `POST /webhooks/gmail`

## Important integration status
Demo inbox, SQLite persistence, deterministic intent classification, draft editing/review, API validation, and SSE event broadcasting are implemented. Gmail OAuth initiation and state validation are scaffolded. **Real Gmail sync is not enabled yet**: the OAuth callback intentionally stops before persisting tokens because a production-grade encrypted credential store and session/authentication strategy must be configured. Pub/Sub webhook token/envelope validation is present, but it does not yet call Gmail history API or advance history checkpoints. Do not configure real credentials and assume live sync works. Follow `../docs/setup-google-cloud.md` and complete the listed security gates before using a real mailbox.

## Safety
- Draft approval/rejection never sends email.
- Mock AI is deterministic and labels drafts as mock.
- Do not expose secrets in frontend code or logs.
- Before production, implement encrypted OAuth credential storage, authenticated sessions/CSRF protection, Pub/Sub OIDC verification, Gmail watch renewal, history reconciliation, and retention controls.

## Tests
```bash
npm test
npm run typecheck
npm run build
```
