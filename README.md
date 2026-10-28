# AI Inbox Helper

A demo-first recruitment inbox helper built with Angular standalone components + Signals and a TypeScript/Express/SQLite backend. It groups candidate messages by intent, generates draft replies, and supports human editing and review. The included design reference is in `docs/design-reference.png`.

## Project packages
- `backend/` — Express API, SQLite persistence, mock AI provider, intent classifier, draft review, SSE event stream, and Gmail/Pub/Sub integration scaffolds.
- `frontend/` — Angular SPA with Dashboard, Inbox, Message Details, Intent Groups, Gmail Connection, and Settings.
- `docs/` — architecture, Gmail setup, test plan, demo script, reflection template.
- `intent.md`, `directive.md`, `logs/` — quest deliverables and honest daily-log templates.

## Prerequisites
- Node.js 20.19+ and npm
- A terminal and a modern browser
- Google Cloud project only if you choose to continue Gmail integration

## Start locally
Open two terminals.

Terminal 1:
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Terminal 2:
```bash
cd frontend
npm install
npm start
```
Visit `http://localhost:4200`. The API runs on `http://localhost:3000`. In the dashboard, select **Import Demo Data**. Demo mode does not require Gmail or an external AI key.

## Deploying to Production (Available for All)
See the full [Deployment Guide](file:///c:/Users/Dell/Downloads/ai-inbox-helper-full-project/ai-inbox-helper/docs/deployment-guide.md) for step-by-step instructions:
- **Cloud 1-Click (Free)**: Deploy on [Render.com](https://render.com) using [`render.yaml`](file:///c:/Users/Dell/Downloads/ai-inbox-helper-full-project/ai-inbox-helper/render.yaml) for automated PostgreSQL database, Express backend, and Angular frontend.
- **Docker Compose**: Deploy to any VPS with a single command:
  ```bash
  docker compose up -d --build
  ```
- **Vercel + Neon**: Deploy the frontend on Vercel with [`frontend/vercel.json`](file:///c:/Users/Dell/Downloads/ai-inbox-helper-full-project/ai-inbox-helper/frontend/vercel.json) and serverless PostgreSQL on Neon.

## Verification
```bash
cd backend && npm test && npm run typecheck && npm run build
cd ../frontend && npm install && npm run build
```
These commands are provided for verification; dependency installation/builds were not run in the artifact-generation environment, so no successful build claim is made here. Resolve any package-version incompatibilities using the current Angular CLI and Node LTS documentation.

## Important Gmail status
The Gmail feature is intentionally labelled as incomplete. OAuth initiation and state validation are scaffolded, and the webhook validates a shared bearer token and Pub/Sub envelope. The starter does **not** yet persist OAuth credentials securely, process Gmail history IDs, renew Gmail watch, or provide verified production Pub/Sub OIDC authentication. Do not connect a production mailbox until those controls are completed. The app never sends email; approval records a human review decision only.

## Security before production
Implement authenticated app sessions, CSRF protection for state-changing browser requests, encrypted server-side OAuth token storage with key management, Pub/Sub OIDC token verification/audience checks, rate limiting appropriate to deployment, secret rotation, privacy/retention policy, and robust Gmail history reconciliation. Do not expose secrets in Angular environment files.
