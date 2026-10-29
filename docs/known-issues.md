# Known Issues & Limitations — AI Inbox Helper

> An honest account of what failed, what didn't work, and why.

---

## 🔴 Issue #1: Google OAuth Stuck in Testing Mode

### Problem
Google OAuth consent screen **could not be moved to production**. The app remains in **"Testing" mode**, which means:
- Only **manually added test users** can sign in via Google
- The familiar "Choose an account" popup does **not appear** for unregistered users
- Maximum of **100 test users** can be added manually via Google Cloud Console

### Root Cause: Three Compounding Factors

#### Factor A — Domain Ownership Cannot Be Verified
Google requires verifying ownership of the home page URL (`https://ai-inbox-frontend.onrender.com`) via Google Search Console. Since `onrender.com` is **Render's domain**, we:
- ❌ Cannot add DNS TXT records (we don't control Render's DNS)
- ❌ Cannot upload an HTML verification file reliably (Render's static site hosting may not serve it correctly before the SPA takes over)

**Google's Error:**
> *"The website of your home page URL 'https://ai-inbox-frontend.onrender.com' is not registered to you."*

#### Factor B — Privacy Policy Page Not Readable by Crawler
The privacy policy was initially built as an **Angular SPA route** (`/privacy`). Google's verification crawler **does not execute JavaScript** — it saw a blank `<app-root></app-root>` tag, not the policy content.

**Google's Error:**
> *"Your privacy policy page at 'https://ai-inbox-frontend.onrender.com' does not have sufficient content."*

#### Factor C — Email Account Mismatch
The project uses **different Google accounts** across services:

| Service | Account |
|---------|---------|
| Google Cloud Console (OAuth credentials) | Email A |
| GitHub repository | Email B |
| Render deployment | Email B |

Google's verification checks that the **app developer** (Cloud Console owner) matches the **domain owner** (Search Console). Different emails break this chain of trust and make domain verification impossible even if DNS access were available.

### Fixes Applied

| Fix | Status | What It Does |
|-----|--------|-------------|
| Static `privacy.html` in `frontend/public/` | ✅ Deployed | Google's crawler can now read the full privacy policy at `/privacy.html` without JavaScript |
| Static `terms.html` in `frontend/public/` | ✅ Deployed | Terms of Service also crawler-readable |
| `_redirects` file for Render SPA routing | ✅ Deployed | Angular deep links (`/inbox`, `/privacy`, etc.) now work on direct navigation |
| Backend `/privacy` and `/terms` endpoints | ✅ Deployed | Privacy policy also served from `ai-inbox-backend.onrender.com/privacy` as plain HTML |

### What Still Needs to Be Done (Not Possible Without Custom Domain)

1. **Use a custom domain** (e.g., `ai-inbox-helper.com`) instead of Render's subdomain
2. Point DNS to Render and verify domain ownership in Google Search Console
3. Ensure the Google Cloud Console project owner email matches the domain registrant
4. Wait 24 hours for DNS propagation, then re-submit for production approval

### Current Workaround
To add a test user:
1. Go to [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click **"Test users"** → **"+ Add Users"**
3. Enter the email address → Save
4. That user can now connect Gmail in the app

---

## 🔴 Issue #2: Email Account Mismatch Across Services

### Problem
The Google Cloud Console project was created with **one Gmail account**, while GitHub and Render use a **different Gmail account**. This created a chain-of-trust problem:

```
Google Cloud Console (Email A)
    ↓ owns OAuth credentials
    ↓ must verify domain ownership
    
Google Search Console (Email A tries to verify)
    ↓ but the deployed site is on Render
    
Render + GitHub (Email B)
    ↓ controls the deployment
    ↗ Email A cannot verify Email B's deployment
```

### Impact
- Cannot verify domain ownership because the Cloud Console owner isn't the same as the deployment account
- Cannot transfer Google Cloud projects between accounts without recreating all credentials
- The OAuth `client_id` and `client_secret` are tied to Email A's project

### Lesson Learned
> **Always use the same Google account** for Cloud Console, GitHub, domain registration, and deployment platform. Set this up before starting development.

---

## 🟡 Issue #3: Render Free-Tier Cold Start Delays

### Problem
Render's free tier **spins down** the backend service after 15 minutes of inactivity. First request after idle takes **30–50 seconds**.

### Impact
- Gmail OAuth callback may time out if backend hasn't woken up
- First sync attempt may fail
- Users see loading/blank screen on first visit

### Workaround
- App shows loading indicators
- Users may need to refresh after initial cold-start load
- Gmail auto-sync retry handles transient failures

---

## 🟡 Issue #4: Gmail Read-Only Scope (By Design)

### Current Scopes
```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/gmail.readonly
```

### What This Means
- App can **read** emails but **cannot send, delete, or modify** them via Gmail API
- Outbox messages are stored in PostgreSQL, not sent through Gmail
- This was an intentional security decision — requesting `gmail.send` would require even stricter Google verification

---

## 🟢 Issue #5: Cross-Origin Cookie Blocking (RESOLVED)

### Problem
OAuth flow originally used cookies to pass state between frontend (`ai-inbox-frontend.onrender.com`) and backend (`ai-inbox-backend.onrender.com`). Modern browsers block third-party cookies by default.

### Fix
Replaced cookie-based state with a **server-side state map**. OAuth state parameter stored in backend memory and validated during callback.

### Remaining Risk
In-memory state map is lost on backend restart (Render free-tier redeployment). Acceptable for demo project; production would need Redis-backed sessions.

---

## 🟢 Issue #6: Angular SPA Routing on Render (RESOLVED)

### Problem
Direct navigation to `https://ai-inbox-frontend.onrender.com/inbox` returned 404 because Render looked for a `/inbox` file instead of serving `index.html`.

### Fix
Added `_redirects` file:
```
/*    /index.html   200
```
Render now serves `index.html` for all routes, and Angular's router handles client-side navigation. Static files like `privacy.html` and `terms.html` are served directly (Render checks for actual files before applying the rewrite).

---

## Summary

| # | Issue | Severity | Status | Root Cause |
|---|-------|----------|--------|------------|
| 1 | OAuth stuck in Testing mode | 🔴 Critical | **Unresolved** — needs custom domain | Can't verify Render subdomain ownership |
| 2 | Email account mismatch | 🔴 Critical | **Unresolved** — architectural | Different accounts for Cloud Console vs GitHub/Render |
| 3 | Render cold start | 🟡 Medium | **Accepted** | Free-tier limitation |
| 4 | Gmail read-only scope | 🟡 Medium | **By Design** | Intentional security decision |
| 5 | Cross-origin cookies | 🟢 Resolved | **Fixed** | Server-side state map |
| 6 | SPA routing on Render | 🟢 Resolved | **Fixed** | `_redirects` file |

---

## How to Fix Issue #1 (For Future Reference)

If you want to move the app to production:

1. **Buy a custom domain** (e.g., from Namecheap, Google Domains)
2. **Point DNS to Render** following [Render's custom domain guide](https://render.com/docs/custom-domains)
3. **Verify the domain** in [Google Search Console](https://search.google.com/search-console) using DNS TXT record
4. **Update OAuth consent screen** home page URL to the custom domain
5. **Update privacy policy URL** to point to the custom domain
6. **Wait 24 hours** for Google to re-crawl
7. **Re-submit** the OAuth consent screen for production verification

---

*Document created: October 29, 2026*
*Last commit: `1b428b5` — static privacy/terms pages + backend legal endpoints*
