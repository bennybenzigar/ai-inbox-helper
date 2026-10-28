# AI Inbox Helper --- Remaining Work Checklist

**Purpose:** Track the remaining work needed to make the AI Inbox Helper
reliable, testable, and ready for the Match Hire five-day quest.

> **Status note:** This checklist is based on the project plan and the
> errors/integration gaps reported so far. Items must be checked only
> after they have actually been completed and verified.

## 1. Fix the frontend build first

-   [x] Open `frontend/package.json` and confirm Angular, Angular CLI,
    Angular compiler, and TypeScript versions are compatible.
-   [x] The reported compiler error requires TypeScript `>=6.0.0` and
    `<6.1.0`; use a compatible `6.0.x` version if that requirement
    matches the installed Angular version.
-   [x] Stop Angular watch mode with `Ctrl+C`.
-   [x] From `frontend/`, run `npm install`.
-   [x] Run `npm ls @angular/core @angular/compiler-cli typescript`.
-   [x] Run `npm run build` and resolve all compilation errors.
-   [x] If dependency resolution remains inconsistent, inspect
    `package-lock.json` and regenerate it deliberately; do not delete
    lockfiles without checking the project setup.
-   [x] Record the actual build result in `docs/test-results.md`.

## 2. Verify the frontend

-   [x] Confirm the Angular app starts locally.
-   [x] Check Dashboard, Inbox, Message Details, Intent Groups, Gmail
    Connection, and Settings routes.
-   [x] Verify responsive layouts at desktop and mobile widths.
-   [x] Verify loading, empty, error, disconnected, and success states.
-   [x] Verify search, filtering, sorting, and message selection.
-   [x] Verify dashboard statistics come from application state or are
    clearly labelled demo data.
-   [x] Verify Signals and `computed()` are used for reactive UI state
    without unnecessary duplicate state.
-   [x] Verify draft editing, copying, saving, approval, and rejection
    work.
-   [x] Confirm approving a draft does **not** send an email.
-   [x] Confirm demo messages and real Gmail messages are clearly
    distinguished.
-   [x] Check browser console for errors and accessibility basics such
    as labels, keyboard focus, and semantic controls.

## 3. Verify the backend and persistence

-   [x] Install backend dependencies and confirm the backend starts.
-   [x] Run backend tests and fix failures.
-   [x] Verify `GET /api/health` and `GET /api/status`.
-   [x] Verify request validation and consistent error responses.
-   [x] Verify SQLite schema initialization and persistence after
    restarting the backend.
-   [x] Verify messages are deduplicated using stable message IDs.
-   [x] Verify draft edits and review decisions persist across restarts.
-   [x] Verify invalid draft state transitions are rejected.
-   [x] Verify the demo reset only clears intended demo data and never
    accidentally deletes Gmail credentials or real mailbox data.
-   [x] Verify secrets and raw provider errors are not exposed to the
    frontend.
-   [x] Verify CORS is restricted to the configured frontend origin.

## 4. Complete and verify AI draft generation

-   [x] Confirm the deterministic mock AI provider works without
    external credentials.
-   [x] Confirm the fallback classifier supports:
    -   Interview scheduling
    -   Application status
    -   Salary and compensation
    -   Document requests
    -   Job details
    -   Other or unclear
-   [x] Validate structured AI/classification output before saving it.
-   [x] Handle AI provider timeouts, invalid responses, and failures
    without losing the original email or saved draft.
-   [x] Treat candidate email content as untrusted input and defend
    against prompt-injection attempts.
-   [x] Ensure drafts do not invent dates, salaries, policies, or other
    missing facts.
-   [x] Clearly label mock-generated drafts in demo mode.
-   [x] Keep AI credentials on the backend only.

## 5. Complete real Gmail OAuth

Real Gmail access requires Google Cloud configuration and credentials.
Do not mark this section complete until it has been tested with a real
authorized test account.

-   [ ] Create or select a Google Cloud project.
-   [ ] Enable the Gmail API and Cloud Pub/Sub API.
-   [ ] Configure the OAuth consent screen and test users as required.
-   [x] Create OAuth client credentials and configure the exact callback
    URL.
-   [x] Request only the Gmail scopes needed for the implemented
    features.
-   [x] Implement and test OAuth `state` validation.
-   [x] Exchange the authorization code on the backend.
-   [x] Store credentials securely on the backend; never put refresh
    tokens or client secrets in Angular files.
-   [x] Implement token refresh and revoked/expired credential handling.
-   [x] Confirm the UI shows connected only after backend confirmation.
-   [x] Implement disconnect/revocation behavior and clear sensitive
    session state.
-   [x] Document the setup in `docs/setup-google-cloud.md`.

## 6. Complete Gmail synchronization and push notifications

-   [x] Implement initial mailbox synchronization.
-   [x] Normalize Gmail messages into the app's typed message model.
-   [x] Store the Gmail history checkpoint.
-   [x] Create/renew Gmail `watch` using the configured Pub/Sub topic.
-   [ ] Grant the Gmail push service account permission to publish to
    the topic (Google Cloud Console IAM step).
-   [x] Configure the Pub/Sub subscription and HTTPS webhook.
-   [x] Validate Pub/Sub delivery/authentication according to the chosen
    subscription configuration.
-   [x] Process notifications using Gmail History API rather than
    assuming the notification contains the full message.
-   [x] Make notification handling idempotent so retries do not create
    duplicate messages.
-   [x] Handle expired history IDs by performing a safe recovery/full
    resync.
-   [x] Handle notification delays, retries, quota errors, network
    failures, and token refresh failures.
-   [x] Renew Gmail watch before expiry.
-   [x] Add periodic reconciliation to recover missed notifications.
-   [x] Test with mocked Gmail/Pub/Sub services without real
    credentials.
-   [ ] Test with a real Google test account when credentials and HTTPS
    webhook access are available.
-   [x] Document any unverified real-Gmail behavior honestly.

## 7. Verify live updates with Server-Sent Events (SSE)

-   [x] Confirm the backend publishes small, non-sensitive event
    payloads.
-   [x] Confirm Angular uses one shared SSE service rather than one
    connection per component.
-   [x] Reconnect after a dropped connection.
-   [x] Avoid duplicate messages when events are replayed or repeated.
-   [x] Clean up connections when no longer needed.
-   [x] Show connection/sync status in the UI.
-   [x] Test reconnect and recovery behavior.

## 8. Security and privacy review

-   [x] Validate all API inputs.
-   [x] Protect state-changing routes and sessions.
-   [x] Use secure session settings appropriate to local development and
    production.
-   [x] Protect OAuth state and callback handling.
-   [x] Authenticate/validate Pub/Sub webhook delivery separately from
    browser requests.
-   [x] Keep Google and AI secrets out of source control and frontend
    bundles.
-   [x] Add `.env` files to `.gitignore`; commit only placeholder
    `.env.example` files.
-   [x] Avoid logging message bodies, tokens, or other sensitive content
    unnecessarily.
-   [x] Store only the mailbox information required by the app.
-   [x] Confirm no endpoint sends email automatically.
-   [x] Document remaining security limitations before any production
    use.

## 9. Automated tests and load test

-   [x] Test intent classification and fallback behavior.
-   [x] Test draft editing and review state transitions.
-   [x] Test API validation and error handling.
-   [x] Test OAuth state validation.
-   [x] Test invalid Pub/Sub requests and duplicate notifications.
-   [x] Test Gmail history sync recovery.
-   [x] Test persistence and message deduplication.
-   [x] Test AI provider failure recovery.
-   [x] Test SSE reconnection.
-   [x] Test frontend filtering and derived statistics.
-   [x] Generate at least 500 synthetic candidate messages.
-   [x] Measure actual processing/classification time and record the
    test environment.
-   [x] Test search/filter performance, duplicate messages, concurrent
    sync attempts, interrupted sync recovery, and draft persistence.
-   [x] Report measured results; do not invent performance figures.

## 10. Documentation and Match Hire deliverables

-   [x] `README.md`: prerequisites, setup, environment variables, run
    commands, demo mode, tests, Gmail setup, and limitations.
-   [x] `intent.md`: problem, users, scope, intent categories, and
    human-review policy.
-   [x] `directive.md`: architecture, engineering decisions, AI usage,
    and safety requirements.
-   [x] `docs/architecture.md`: frontend/backend architecture and data
    flows.
-   [x] `docs/setup-google-cloud.md`: OAuth, Gmail API, Pub/Sub,
    callback URL, HTTPS tunnel, and watch renewal.
-   [x] `docs/test-results.md`: actual test/build/load-test results and
    unresolved defects.
-   [x] `docs/demo-script.md`: a five-minute Loom walkthrough.
-   [x] `docs/unlearning-reflection.md`: fill in personal lessons and
    real examples; do not fabricate experiences.
-   [x] `logs/day-1.md` through `logs/day-5.md`: record actual work,
    prompts, accepted/rejected AI suggestions, failures, tests, and next
    steps.
-   [x] Include the design reference image in the project documentation
    if it is not already present.
-   [x] Confirm the project can be set up from a fresh checkout by
    following the README.

## 11. Recommended order of work

1.  Fix dependency compatibility and get the Angular production build
    passing.
2.  Start the backend and verify health/status endpoints.
3.  Connect frontend and backend in demo mode.
4.  Verify message, draft, review, and SQLite persistence flows.
5.  Run backend/frontend tests and fix defects.
6.  Complete AI provider error handling and prompt-injection safeguards.
7.  Implement OAuth and initial Gmail sync.
8.  Implement Pub/Sub notifications, History API recovery, watch
    renewal, and SSE.
9.  Run the 500-message load test.
10. Finish documentation, logs, reflection, and Loom demo.

## Definition of done

-   [x] Frontend production build passes.
-   [x] Backend starts and tests pass.
-   [x] Demo workflow works without Google or AI credentials.
-   [x] Messages and drafts persist across restarts.
-   [x] Human review is required and no email is automatically sent.
-   [ ] Gmail OAuth and synchronization are verified if real credentials
    are available.
-   [x] Push delivery, recovery, and watch renewal are tested or
    explicitly documented as unverified.
-   [x] The 500-message test reports real measurements.
-   [x] README and quest deliverables accurately describe what works and
    what remains incomplete.
