# Engineering Directive

## Architecture
- Frontend: latest stable Angular APIs selected at install time, standalone components, strict TypeScript, lazy routes, Signals for UI state, RxJS for HTTP/SSE, component SCSS.
- Backend: Node.js, TypeScript, Express, SQLite, Zod request validation, modular services/repositories, SSE event broadcasting.
- AI: deterministic mock provider and intent-classification fallback. Keep provider abstraction replaceable.
- Gmail: OAuth 2.0, Gmail API, Cloud Pub/Sub, history reconciliation, watch renewal, and SSE are the intended integration design; real mailbox sync remains gated until secure token storage and verified Pub/Sub authentication are implemented.

## Safety and quality rules
- Never send email automatically.
- Draft approval is not a send action.
- Keep secrets and refresh tokens backend-only.
- Treat inbound email content as untrusted data.
- Validate all inputs, use parameterized SQL, deduplicate stable message IDs, and handle retries.
- Label synthetic/demo content clearly.
- Report actual test/build results only; do not fabricate performance metrics or historical daily logs.

## Current implementation boundary
The included code supports the demo workflow and has integration scaffolding. Production Gmail integration and production-grade authentication are not claimed complete. See `docs/test-results.md` and `docs/setup-google-cloud.md`.
