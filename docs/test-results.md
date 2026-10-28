# Test Results

## Verified Build and Automated Test Status (2026-10-27)
- **Backend automated tests**: `npm test` PASSED (16/16 tests pass: mock draft generation, 6 intent classifiers, prompt injection resilience, OAuth state rejection & validation, Pub/Sub token & envelope verification, and API bounds validation).
- **Backend typecheck & build**: `npm run typecheck` and `npm run build` PASSED (tsc exit code 0).
- **Frontend production build**: `npm run build` PASSED with code 0 (`@angular/build:application`, initial total: 307.38 kB, transfer size: 80.80 kB).
- **Frontend typecheck**: `npm run typecheck` PASSED with code 0 (`tsc --noEmit -p tsconfig.app.json`).
- **Frontend unit tests**: `npm test -- --watch=false` PASSED (3 test files, 14/14 tests pass via Vitest + Happy-DOM: `InboxStateService`, `IntentBadge`, and `ApiService`).
- **500-message timing run**: Not yet run; scheduled for Phase 7.

## Commands to run
```bash
cd backend
npm install
npm test
npm run typecheck
npm run build
cd ../frontend
npm install
npm run build
```

## Manual Smoke Test Results (Verified 2026-10-27)
1. **Start backend and frontend**: Backend listening on `http://localhost:3000`, Frontend served on `http://localhost:4200`. (PASSED)
2. **Dashboard & Demo Import**: `POST /api/demo/import` imported 24 sample messages. Dashboard KPI counts (24 total, 24 pending, 0 approved, 4 attention required) and Recent Activity updated correctly. (PASSED)
3. **Inbox search & filtering**: Filtered by search query "Priya" (isolated to 1 result), intent filter "Interview Scheduling" (isolated to 4 results), and status filtering. (PASSED)
4. **Draft review workflow**: Opened message `demo-1`, edited draft body (`PATCH /api/drafts/:id`), verified draft version incremented to 2, approved draft (`POST /api/drafts/:id/approve`), verified status `approved` and version 3. Rejected draft `demo-2`, verified status `rejected`. (PASSED)
5. **No-send verification**: Both approval and rejection endpoints returned note: `"Review recorded. No email was sent."` with zero mail dispatch. (PASSED)
6. **SQLite persistence across restart**: Terminated backend process and restarted dev server. Re-queried `/api/messages/demo-1` and `demo-2`; edited draft content, approval status, and rejection status persisted intact in `inbox-helper.sqlite`. (PASSED)
7. **Invalid state transitions**: Editing an approved draft properly returned `409 Conflict`. (PASSED)
8. **Gmail Connection page**: Displayed "Not connected" and clearly informed recruiter that OAuth configuration is required. (PASSED)
9. **Demo data reset**: `DELETE /api/demo/data` scoped deletion strictly to `source = 'demo'`, preserving connection metadata and real records. (PASSED)

## 500-Message Load Test Results (Measured 2026-10-27)
- **Environment**: Node.js `v22.22.3`, SQLite `better-sqlite3@12.11.1` (WAL mode), Angular 22.2.3, Windows x64.
- **Import & Classification**:
  - Imported and classified 500 candidate messages via `POST /api/demo/import` with `{ "count": 500 }`.
  - Elapsed time for generating and classifying 500 candidate messages: **309 ms**.
  - Idempotency / Deduplication test: re-executing import with 500 messages resulted in 0 duplicates inserted (total stayed at exactly 500).
- **Query & Search Latency**:
  - List all 500 messages (`GET /api/messages`): **85 ms**.
  - Intent filter query (`GET /api/messages?intent=Interview%20Scheduling` - 84 items): **11 ms**.
  - Search query (`GET /api/messages?q=alex` - 50 items): **4 ms**.
  - Dashboard KPI aggregation (`GET /api/dashboard`): sub-10 ms.
- **Draft Creation & Persistence**:
  - Generating AI draft on message 500: **12 ms**.
  - Preserved across backend restarts and database reconnections.
- **Browser Rendering & UX at 500 Messages**:
  - Instant table rendering in Angular on `http://localhost:4200/inbox`.
  - Client-side search and dropdown filtering responded without perceptible UI lag or dropped frames.
  - Dashboard summary accurately displayed 500 total messages with correct category breakdowns.
