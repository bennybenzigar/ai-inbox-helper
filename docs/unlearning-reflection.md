# What I Unlearned — Engineering Reflection

### 1. Habit Unlearned: Rushing to Downgrade Dependencies When Build Tooling Fails
- **Old Approach:** Seeing compiler warnings or build mismatches (like "TypeScript 5.9 vs 6.0" or `moduleResolution` warnings) and immediately downgrading packages, editing `package.json`, or blindly deleting `package-lock.json`.
- **New Approach:** Investigating the root compiler diagnostics first with non-destructive inspections (`npm ls`, reading compiler AST errors). The true issues were specific syntax errors, missing module imports (`Node16` resolution in `backend/tsconfig.json`), and separating runtime dependencies from dev dependencies for production container builds on Render.

---

### 2. Habit Unlearned: Treating In-Memory State as Sufficient for Production Tools
- **Old Approach:** Implementing interactive features (like the Attendance Pattern Checker and Hiring Board Stall Alerter) purely in local component signals without persistent backend database tables, assuming users would only inspect files in single transient sessions.
- **New Approach:** Recognizing that recruiters need historical persistence. When timesheet analysis or stall alerts are generated, they must persist in PostgreSQL across reloads, browser restarts, and team sessions. Deletions (single and bulk) must commit directly to the database.

---

### 3. Habit Unlearned: Nesting Pagination Controls Inside Empty-Page Checks
- **Old Approach:** Guarding paginated tables with `@if (pagedItems().length)` and placing `<app-paginator>` inside that block.
- **The Failure:** When a user deleted all items on Page 2, `pagedItems()` returned an empty array, hiding the table AND the paginator. The user was permanently locked on an empty page with no way to return to Page 1.
- **New Approach:** Basing paginator visibility on the **total filtered count** (`totalCount > 0`), keeping navigation visible at all times, and implementing defensive page clamping (`clampPageAfterDelete()`) to automatically navigate backwards when a page is emptied.

---

### 4. Habit Unlearned: Assuming Cross-Domain Cookies Work for Cloud OAuth
- **Old Approach:** Relying on `res.cookie('gmail_oauth_state', ...)` with `SameSite=Lax` for OAuth CSRF protection.
- **The Failure:** When deployed across separate cloud subdomains (`ai-inbox-frontend.onrender.com` vs `ai-inbox-backend.onrender.com`), modern browsers block third-party cookies during Google redirects, causing callback verification to fail.
- **New Approach:** Using a secure, server-side in-memory state map with timestamp-based expiration (10-minute TTL) as the primary source of truth, completely eliminating cross-origin cookie blockage.

---

### 5. Habit Unlearned: Treating Email Approval as a Terminal State
- **Old Approach:** Marking a candidate message as "approved" and stopping there without recording sent outreach.
- **New Approach:** Building an **Outbox** module. In real hiring workflows, recruiters need to audit what was dispatched, inspect exact reply bodies in formatted modals, track timestamps, and retain thread references for ongoing candidate relationships.

---

### 6. AI Suggestions Evaluated
- **Suggestions Accepted:**
  - Adopting Angular standalone components with Signals (`signal()`, `computed()`) for declarative, zero-boilerplate reactivity.
  - Adding an automated 5-minute background sync timer in `server.ts` to keep the candidate inbox synchronized without requiring continuous manual user clicks.
  - Enforcing strict CSV guardrails that reject empty files and header-only rows with HTTP 400.
- **Suggestions Corrected / Improved:**
  - Corrected the CommonJS import of `@google/genai` by dynamically importing it at runtime, ensuring complete compatibility with Node16 module resolution.
  - Upgraded database architecture from initial local SQLite to a robust PostgreSQL connection pool with SSL for cloud production deployment on Render.
