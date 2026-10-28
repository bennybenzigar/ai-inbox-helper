# What I Unlearned — Reflection

- **Habit I unlearned:** Assuming that reported build errors (like "TypeScript 5.9 vs 6.0 mismatch") require downgrading dependencies or wiping lockfiles before inspecting actual compiler diagnostics.
- **Old approach:** Immediately editing `package.json` to downgrade versions or deleting `package-lock.json` when seeing a compiler warning.
- **New approach:** Executing safe, non-destructive diagnostics (`npm ls`, inspecting compiler error traces), which revealed that TypeScript 6.0.3 was already installed and compatible with Angular 22.2, while the true blockers were component syntax/brace errors and a missing template pipe import.
- **AI suggestion accepted:** Adopting `@angular/build:unit-test` with `vitest` + `happy-dom` for fast, lightweight in-process testing of Signal state management.
- **AI suggestion rejected or corrected:** Rejected an automatic migration to PostgreSQL; confirmed that embedded SQLite in WAL mode easily handles 500 candidate messages with sub-millisecond search latencies and zero Docker/cloud infrastructure overhead.
- **Failure encountered:** Top-level `return` error in `gmail-connection.ts` caused by a premature closing brace that ejected the `connect()` method outside the class into module scope, plus `NG8004` due to missing `DecimalPipe`.
- **Evidence:** Clean production bundle (`npm run build`, 342.85 kB initial), 5/5 passing Vitest tests, 8/8 passing backend tests, and recorded 500-message benchmark (309 ms) in `docs/test-results.md`.
- **Next improvement:** Securely implement encrypted credential storage and Cloud Pub/Sub verification when real Google Cloud test credentials are provided.

