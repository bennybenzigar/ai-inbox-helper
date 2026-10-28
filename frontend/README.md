# AI Inbox Helper — Angular Frontend

Angular standalone app using Signals, lazy routes, HttpClient, Reactive UI state, and component-scoped SCSS. The design reference is in `public/assets/design-reference.png`.

## Run
Requires Node.js 20.19+ and npm.
```bash
npm install
npm start
```
Open `http://localhost:4200`. The backend must be running at `http://localhost:3000` for inbox data, demo import, and draft review.

## Pages
- Dashboard: KPI cards, intent breakdown, recent activity, sample data import.
- Inbox: search/filter and candidate message list.
- Message details: original message, editable draft, regenerate, copy, approve/reject.
- Intent groups, Gmail connection setup guidance, and settings.

## Notes
The frontend is demo-first and does not store OAuth secrets. Gmail status is shown only from the backend status endpoint. Real Gmail synchronization is not enabled in the accompanying backend starter; see root documentation. Approval never sends email.
