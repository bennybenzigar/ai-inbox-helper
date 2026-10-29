# Known Issues & Limitations

> What failed, what didn't work, and why — an honest post-mortem.

---

## 1. Google OAuth — Stuck in Testing Mode (🔴 Critical)

### Problem

Google OAuth consent screen **could not be moved to production**. The app remains in **"Testing" mode**, which means:

- Only **manually added test users** can sign in.
- Automatic Google account selection (the familiar "Choose an account" popup for any Google user) **does not work** for unregistered emails.
- Maximum of **100 test users** can be added manually.

### Root Cause

To move an OAuth app from Testing → Production, Google requires:

1. **Domain ownership verification** — The home page URL (`https://ai-inbox-frontend.onrender.com`) must be verified in Google Search Console. Since `onrender.com` is Render's domain (not ours), we **cannot add a DNS TXT record** to prove ownership. The HTML file verification method is an alternative, but Google's crawler had issues indexing the Render-hosted SPA.

2. **Privacy Policy compliance** — Google requires a privacy policy page with sufficient content detailing:
   - What user data is collected
   - How Google API data is used
   - Compliance with [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
   - Limited Use disclosure

   We created a full privacy policy page at `/privacy`, but Google's review flagged:
   > *"Your privacy policy page at https://ai-inbox-frontend.onrender.com does not have sufficient content."*

   This is likely because Angular SPA routing returns a blank page to Google's crawler (which doesn't execute JavaScript), and/or the Render free-tier cold-start delay caused the crawler to see an empty response.

3. **Different email accounts** — The Google Cloud Console project was created with **one Google account**, while the GitHub repository and Render deployments use a **different email**. This mismatch caused verification failures because Google checks that the domain owner, app developer, and support email all align.

### What We Tried

| Attempt | Result |
|---------|--------|
| Created `/privacy` Angular route with full privacy policy content | ❌ Google crawler can't execute JavaScript in SPA |
| Created `/terms` Angular route with Terms of Service | ❌ Same SPA crawling issue |
| Added privacy/terms links in sidebar and settings page | ✅ Working in-app |
| Attempted domain verification for `ai-inbox-frontend.onrender.com` | ❌ Cannot modify DNS for Render's subdomain |
| **Created static `privacy.html` in `frontend/public/`** | ✅ Crawler-readable at `/privacy.html` |
| **Created static `terms.html` in `frontend/public/`** | ✅ Crawler-readable at `/terms.html` |
| **Added `_redirects` file for Render SPA routing** | ✅ All Angular routes now work on direct navigation |
| **Added `/privacy` and `/terms` backend endpoints** | ✅ Available at `ai-inbox-backend.onrender.com/privacy` |

### Impact

- **Any new user** trying the deployed app at `https://ai-inbox-frontend.onrender.com` **cannot connect their Gmail** unless their email is manually added as a test user in the Google Cloud Console.
- The Gmail sync, AI-powered email classification, and all inbox features are **inaccessible to unapproved users**.

### Workaround (Current)

1. Go to [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Under **"Test users"**, click **"+ Add Users"**
3. Enter the email address of the person who needs access
4. They can now sign in and use Gmail features

### Proper Fix (Not Implemented)

- Use a **custom domain** (e.g., `ai-inbox-helper.com`) instead of Render's subdomain
- Point DNS to Render and verify domain ownership in Google Search Console
- Host a **server-side rendered** or **static HTML** privacy policy page (not behind Angular SPA routing)
- Ensure the Google Cloud Console project owner email matches the domain owner
- Re-submit for production approval after 24-hour DNS propagation

---

## 2. Email Account Mismatch (🟡 Configuration Issue)

### Problem

The project uses **different Google accounts** across services:

| Service | Email Used |
|---------|-----------|
| Google Cloud Console (OAuth credentials) | Email A |
| GitHub repository | Email B |
| Render deployment | Email B |

### Impact

- Google's verification process checks that the **app developer** (Cloud Console owner) matches the **domain owner** (verified in Search Console). Using different emails breaks this chain of trust.
- Cannot transfer OAuth credentials between Google accounts without recreating the project.

### Lesson Learned

> Always use the **same Google account** for Cloud Console, domain registration, and deployment platform sign-up when building apps that require OAuth verification.

---

## 3. Render Free-Tier Cold Start (🟡 Performance)

### Problem

Render's free tier **spins down** the backend service after 15 minutes of inactivity. The first request after a cold start takes **30–50 seconds** to respond.

### Impact

- Gmail sync may time out on first attempt after idle period
- OAuth callback may fail if the backend hasn't woken up in time
- Users see a blank/loading screen while the backend starts

### Workaround

- The app shows loading indicators while waiting
- Users may need to refresh and retry after the first cold-start load

---

## 4. Cross-Origin Cookie Blocking (🟢 Resolved)

### Problem

OAuth flow originally relied on cookies to pass state between the frontend (`ai-inbox-frontend.onrender.com`) and backend (`ai-inbox-backend.onrender.com`). Modern browsers block cross-origin cookies by default.

### Fix Applied

Replaced cookie-based state verification with a **server-side state map**. The OAuth state parameter is stored in memory on the backend and validated during the callback — no cookies needed.

### Remaining Risk

The in-memory state map is lost when the backend restarts (Render free-tier redeploys). This is acceptable for a demo/internship project but would need Redis or database-backed sessions in production.

---

## 5. Gmail API Scope Limitations (🟡 By Design)

### Current Scopes

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/gmail.readonly
```

### What This Means

- The app can **read** emails but **cannot send, delete, or modify** them
- Outbox messages are stored locally in PostgreSQL, not sent via Gmail
- This is intentional for security — requesting `gmail.send` or `gmail.modify` would require stricter Google verification

---

## 6. Angular SPA Routing on Static Hosting (🟡 Deployment)

### Problem

Angular is a Single Page Application — all routes (`/inbox`, `/privacy`, `/settings`, etc.) are handled client-side by JavaScript. When a user directly navigates to `https://ai-inbox-frontend.onrender.com/privacy`, the server looks for a `/privacy` file, doesn't find one, and returns 404.

### Impact

- Google's crawler cannot access the privacy policy page (it doesn't execute JavaScript)
- Direct URL sharing of specific pages may fail
- This directly contributed to the OAuth verification failure

### Fix Needed

Add a `_redirects` file to the build output:
```
/*    /index.html   200
```

This tells Render to serve `index.html` for all routes, letting Angular handle routing client-side.

---

## Summary Table

| Issue | Severity | Status | Blocker? |
|-------|----------|--------|----------|
| OAuth stuck in Testing mode | 🔴 Critical | Unresolved | Yes — limits who can use the app |
| Email account mismatch | 🟡 Medium | Unresolved | Yes — blocks production approval |
| Render cold start | 🟡 Medium | Accepted | No — expected on free tier |
| Cross-origin cookies | 🟢 Low | **Resolved** | No |
| Gmail read-only scope | 🟡 Medium | By Design | No |
| SPA routing on static host | 🟡 Medium | Unresolved | Yes — blocks Google crawler |

---

*Generated: October 29, 2026*
