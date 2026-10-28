# Gmail and Google Cloud setup (integration checklist)

This guide describes setup needed to complete real Gmail integration. The supplied backend deliberately gates real credential persistence and history processing, so completing Google Cloud configuration alone will not make production sync work.

1. Create/select a Google Cloud project.
2. Enable Gmail API and Cloud Pub/Sub API.
3. Configure the OAuth consent screen and add test users while in testing mode.
4. Create an OAuth 2.0 Web application client. Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI for local development. Use HTTPS in deployed environments.
5. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` to backend `.env`; never put secrets in Angular files.
6. Create a Pub/Sub topic and subscription. Grant Gmail's push service account (`gmail-api-push@system.gserviceaccount.com`) permission to publish to the topic.
7. Configure a publicly reachable HTTPS push endpoint or authenticated push subscription. Verify Pub/Sub OIDC identity tokens and audience in production; do not rely solely on a static bearer token.
8. Implement encrypted refresh-token storage with managed key material before accepting real OAuth grants. Protect browser sessions and state-changing requests with session security and CSRF controls.
9. Implement Gmail `users.watch`, persist `historyId`, process notifications with `users.history.list`, fetch only needed messages, deduplicate, and handle expired history IDs by full resync.
10. Schedule watch renewal before expiration and periodic reconciliation because push notifications may be delayed or missed.
11. Add a secure disconnect/revoke flow and a documented data-retention policy.

Useful official references:
- Gmail push notifications: https://developers.google.com/gmail/api/guides/push
- Gmail API history: https://developers.google.com/gmail/api/reference/rest/v1/users.history/list
- Gmail watch: https://developers.google.com/gmail/api/reference/rest/v1/users/watch
- Google OAuth 2.0 web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Pub/Sub push authentication: https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
