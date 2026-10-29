# Google Cloud & Gmail API Setup Guide

This comprehensive guide details the step-by-step setup required to enable real Gmail OAuth 2.0 authentication, automated background mailbox synchronization, and candidate reply dispatching via the Google Gmail API.

---

## 1. Create a Google Cloud Project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top header and click **"New Project"**.
3. Name your project (e.g. `AI-Inbox-Helper`) and select your organization (or leave as "No organization").
4. Click **Create** and wait a few seconds for project provisioning.

---

## 2. Enable Required APIs

1. In the navigation menu, select **APIs & Services** > **Library**.
2. Search for **"Gmail API"**, click the result, and click **Enable**.
3. Return to the Library, search for **"Google People API"** (or Google OAuth2 API), and click **Enable**.

---

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**.
2. Under **User Type**, select **External** (unless you have a Google Workspace domain and want Internal access), then click **Create**.
3. Fill in the required **App information**:
   - **App name:** `AI Inbox Helper`
   - **User support email:** Your email address
   - **Developer contact information:** Your email address
4. Click **Save and Continue**.
5. In the **Scopes** tab, click **Add or Remove Scopes** and select:
   - `.../auth/userinfo.email` (View your email address)
   - `.../auth/userinfo.profile` (See your personal info)
   - `openid` (Associate you with your personal info on Google)
   - `https://www.googleapis.com/auth/gmail.readonly` (Read resources from Gmail)
   - `https://www.googleapis.com/auth/gmail.send` (Send emails on your behalf)
6. Click **Update** and then **Save and Continue**.
7. In the **Test users** tab:
   - Click **Add Users**.
   - Enter your Gmail address (e.g., `recruiter.test@gmail.com`).
   - *Note: In Testing mode, only added test accounts can authorize the application.*
8. Click **Save and Continue**, review the summary, and click **Back to Dashboard**.

---

## 4. Generate OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** at the top and select **OAuth client ID**.
3. In the **Application type** dropdown, choose **Web application**.
4. Set **Name:** `AI Inbox Helper Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:4200` (Local frontend)
   - `https://ai-inbox-frontend.onrender.com` (Production frontend on Render)
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/auth/google/callback` (Local backend callback)
   - `https://ai-inbox-backend.onrender.com/auth/google/callback` (Production backend callback on Render)
7. Click **Create**.
8. A dialog will show your **Client ID** and **Client Secret**. Keep this window open or copy both values.

---

## 5. Configure Backend Environment

### For Local Development (`backend/.env`)
```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### For Production on Render
1. Open your [Render Dashboard](https://dashboard.render.com/).
2. Select your Web Service: `ai-inbox-backend`.
3. Navigate to **Environment** in the left sidebar.
4. Add the following environment variables:
   - `GOOGLE_CLIENT_ID` = `your-client-id.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = `GOCSPX-your-client-secret`
   - `GOOGLE_CALLBACK_URL` = `https://ai-inbox-backend.onrender.com/auth/google/callback`
   - `FRONTEND_ORIGIN` = `https://ai-inbox-frontend.onrender.com`
5. Click **Save Changes**. Render will automatically redeploy the backend with the new credentials.

---

## 6. How Mailbox Sync & Sending Works

1. **Connecting Gmail:** Recruiter navigates to `/gmail-connection` and clicks **Connect Gmail**. The app initiates the OAuth consent screen with offline access.
2. **Token Persistence:** The authorization code is exchanged for an access token and refresh token, which are stored in the PostgreSQL `connection_metadata` table.
3. **Automated Background Sync:** A server-side daemon timer in `server.ts` automatically pulls new candidate messages **every 5 minutes** and immediately on server startup.
4. **On-Demand Sync:** Recruiter can click **"⟳ Sync Gmail"** in the Inbox toolbar to trigger an immediate pull.
5. **Dispatching Replies:** When a recruiter approves and clicks **Send** on a draft, the backend constructs an RFC 2822 MIME message and calls `users.messages.send` via the official Google Gmail API under the authenticated account. Sent outreach is logged in the **Outbox**.

---

## 7. Cloud Pub/Sub Webhook Configuration (Optional for Real-Time Push)

If you wish to supplement the 5-minute background polling with real-time push events:
1. In Google Cloud Console, enable **Cloud Pub/Sub API**.
2. Go to **Pub/Sub** > **Topics** and click **Create Topic** (e.g. `gmail-inbox-updates`).
3. Add Principal: `gmail-api-push@system.gserviceaccount.com` with Role: **Pub/Sub Publisher**.
4. Go to **Subscriptions**, click **Create Subscription**:
   - Delivery type: **Push**
   - Endpoint URL: `https://ai-inbox-backend.onrender.com/webhooks/gmail`
5. Add to your backend environment:
   ```env
   PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-inbox-updates
   ```
