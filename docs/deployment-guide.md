# Deployment Guide: Frontend, Backend & Database (Publicly Accessible)

This guide provides three reliable paths to deploy **AI Inbox Helper** (Angular Frontend + Node/Express Backend + PostgreSQL Database) so it is live on the public internet with HTTPS.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            Users / Internet            │
                      └───────────────────┬────────────────────┘
                                          │ HTTPS
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │   Frontend (Angular)  │ ──── API Requests ──> │   Backend (Express)   │
      │   Public Web App      │                       │   REST / SSE API      │
      └───────────────────────┘                       └───────────┬───────────┘
                                                                  │
                                                      ┌───────────▼───────────┐
                                                      │ PostgreSQL Database   │
                                                      │ Tables, Messages, etc.│
                                                      └───────────────────────┘
```

---

## Option 1: 1-Click Free Cloud Deployment (Render.com) — *Recommended*

Render provides free tiers for PostgreSQL, Node.js Web Services, and Static Sites.

The repository includes a [`render.yaml`](../render.yaml) blueprint that configures all three services automatically:

### Step 1: Push Project to GitHub / GitLab
1. Initialize a git repository if you haven't already:
   ```bash
   git init
   git add .
   git commit -m "feat: complete application with deployment config"
   ```
2. Create a repository on [GitHub](https://github.com/new) (e.g. `ai-inbox-helper`).
3. Push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/ai-inbox-helper.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render via Blueprint
1. Go to [Render.com](https://dashboard.render.com/) and create a free account.
2. In the Render Dashboard, click **New +** and select **Blueprint**.
3. Connect your GitHub repository (`ai-inbox-helper`).
4. Render will read `render.yaml` and show:
   - **`ai-inbox-db`**: Managed PostgreSQL Database (Free tier).
   - **`ai-inbox-backend`**: Node.js Web Service (Free tier).
   - **`ai-inbox-frontend`**: Static Site (Free tier).
5. Click **Apply**.
6. Render will automatically:
   - Provision the PostgreSQL database and inject `DATABASE_URL`.
   - Build and start the backend service (`npm install && npm run build && npm start`).
   - Automatically initialize all database tables on startup.
   - Build and publish the Angular frontend.

### Step 3: Link Frontend to Backend URL
1. Once `ai-inbox-backend` is deployed, copy its public URL (e.g., `https://ai-inbox-backend-xyz.onrender.com`).
2. Go to your `ai-inbox-frontend` service in Render -> **Environment Variables**.
3. (Optional) Set `apiBaseUrl` in frontend environment or add environment variable.
4. Your frontend is live at `https://ai-inbox-frontend-xyz.onrender.com` for anyone in the world!

---

## Option 2: All-in-One Docker Deployment (VPS / Cloud Server)

If you have a VPS (DigitalOcean Droplet, AWS EC2, Hetzner, Google Compute Engine, Linode):

The repository includes a ready-to-use [`docker-compose.yml`](../docker-compose.yml):
- **PostgreSQL 16 Alpine** container with persistent volume storage (`pgdata`).
- **Backend API** container running compiled Node.js Express.
- **Frontend Nginx** container serving Angular with built-in reverse proxy for `/api/`.

### Steps:
1. SSH into your VPS:
   ```bash
   ssh root@<your-server-ip>
   ```
2. Clone your repository:
   ```bash
   git clone https://github.com/<your-username>/ai-inbox-helper.git
   cd ai-inbox-helper
   ```
3. Start all three containers in the background:
   ```bash
   docker compose up -d --build
   ```
4. Verify the containers are running healthy:
   ```bash
   docker compose ps
   ```
5. Visit `http://<your-server-ip>` in your browser. The app is live!

---

## Option 3: Modular Deployment (Vercel + Render/Railway + Neon)

You can also deploy components on specialized platforms:

### 1. Database (Free Serverless PostgreSQL on Neon)
1. Sign up at [Neon.tech](https://neon.tech).
2. Create a project named `ai-inbox-helper`.
3. Copy the pooled connection string:
   ```
   DATABASE_URL=postgres://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Backend (Render or Railway)
1. In Render or Railway, create a new **Web Service** connected to your repo.
2. Root Directory: `backend`
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(paste connection string from Neon)*
   - `FRONTEND_ORIGIN`: `*` (or your frontend Vercel domain)
   - `AI_PROVIDER`: `mock`

### 3. Frontend (Vercel)
1. Sign up at [Vercel](https://vercel.com).
2. Click **Add New Project** and import your repository.
3. Root Directory: click Edit and select `frontend`.
4. Framework Preset: **Angular**.
5. Build Command: `npm run build`
6. Output Directory: `dist/ai-inbox-helper/browser` (already configured in [`frontend/vercel.json`](../frontend/vercel.json)).
7. Click **Deploy**.

---

## Environment Variables Reference

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Backend listening port | `3000` (Local) / Auto (Cloud) |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/dbname` |
| `NODE_ENV` | Runtime environment | `production` |
| `FRONTEND_ORIGIN` | Allowed CORS origins (comma-separated or `*`) | `*` or `https://my-app.vercel.app` |
| `AI_PROVIDER` | AI provider choice | `mock` (or `gemini`) |
| `AI_API_KEY` | Gemini API key (if using `gemini` provider) | `AIzaSy...` |

---

## Database Auto-Initialization
You do not need to run manual SQL migration scripts: the backend's [`initDatabase()`](../backend/src/database/database.ts) runs `CREATE TABLE IF NOT EXISTS` automatically on every boot.
