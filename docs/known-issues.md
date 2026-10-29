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

#### Factor A — Domain Ownership Verification and 24-Hour Sync Delay
Google requires verifying ownership of the home page URL (`https://ai-inbox-frontend.onrender.com`) via Google Search Console. 

**Official Google Error Message:**
> *"Issues found from the previous verification attempt:*
> *The website of your home page URL 'https://ai-inbox-frontend.onrender.com' is not registered to you.*
> *Verify ownership of your home page, then wait 24 hours before retrying to allow our systems to update. [Learn more](https://support.google.com/cloud/answer/13807376)"*

**Why this occurred:**
1. **Render Subdomain:** Because `onrender.com` is a shared platform domain, root DNS TXT verification is impossible. Verification had to be done via an HTML meta tag on the specific URL prefix.
2. **Meta Tag Added:** We embedded `<meta name="google-site-verification" content="t82fIyg_UgM7TkVp-OFT3wUhh1LfJCKJTGwZj6jbPqw" />` directly into `<head>` of `frontend/src/index.html`.
3. **Internal Google Cache (24-Hour Wait):** Google Cloud Console does not query Search Console in real time. It uses an internal identity cache that mandates waiting up to **24 hours** after ownership is confirmed before branding/verification state updates.
4. **Multi-Account Ownership (`authuser=1`):** The project was developed across two Google accounts (`bennybenzigar@gmail.com` and `24xquiz@gmail.com`). Both accounts had to be explicitly granted **Owner** permissions in Google Search Console for the property.

#### Factor B — Privacy Policy Page Crawlability
The privacy policy was initially built as an **Angular SPA route** (`/privacy`). Google's automated verification crawler **does not execute JavaScript** — it encountered an empty `<app-root></app-root>` tag and failed compliance.

**Google's Previous Error:**
> *"Your privacy policy page at 'https://ai-inbox-frontend.onrender.com' does not have sufficient content."*

#### Factor C — Dual-Account Multi-Service Friction
The project uses two different Google accounts:
- `bennybenzigar@gmail.com`
- `24xquiz@gmail.com`

Google's verification engine cross-references the developer profile, project creator, and Search Console verified owners. Discrepancies between browser session identities (`authuser=0` vs `authuser=1`) caused initial ownership checks to fail until permissions were synchronized across both identities.

### Fixes Applied

| Fix | Status | What It Does |
|-----|--------|-------------|
| **Google Search Console Meta Tag** | ✅ Deployed | Added `<meta name="google-site-verification" content="t82fIyg_UgM7TkVp-OFT3wUhh1LfJCKJTGwZj6jbPqw" />` to `index.html` |
| **Search Console Multi-Owner Permissions** | ✅ Configured | Added both `bennybenzigar@gmail.com` and `24xquiz@gmail.com` as verified **Owners** in Search Console |
| **Static `privacy.html`** in `frontend/public/` | ✅ Deployed | Raw HTML accessible at `/privacy.html` without requiring client-side JS rendering |
| **Static `terms.html`** in `frontend/public/` | ✅ Deployed | Raw HTML accessible at `/terms.html` for Google's crawler |
| **Render `_redirects` file** | ✅ Deployed | Direct SPA routing fallback (`/* /index.html 200`) |
| **Backend `/privacy` and `/terms` endpoints** | ✅ Deployed | Dual fallback served directly by Express backend |

### Current Status & Verification Window
- Ownership has been established in Google Search Console.
- The 24-hour verification propagation window is currently pending for Google Cloud's branding engine to clear the error.
- During this window, the application operates in **Testing mode** using explicitly whitelisted test accounts.

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
