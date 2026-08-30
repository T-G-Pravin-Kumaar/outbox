# 🚀 Deployment Guide: ReachInbox Outbox Scheduler

This guide covers deploying the ReachInbox Outbox Email Scheduler monorepo using **Vercel** (for the Next.js frontend) and **Docker Containers** (for the full stack or backend & worker services).

---

## 📌 Architecture & Platform Clarification

| Component | Technology | Best Hosting Platform | Why? |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | Next.js 14, Tailwind CSS | **Vercel** | Native Next.js performance, Global Edge CDN, Zero-config SSL. |
| **Backend API** | Express.js, TypeScript, Prisma | **Docker / Railway / Render / Fly.io / VPS** | Long-running HTTP API server. |
| **Email Worker** | BullMQ background worker | **Docker / Railway / Render / Fly.io / VPS** | Stateful, continuous background queue processor. |
| **Database** | PostgreSQL 16 | **Neon / Supabase / Render / Docker** | Managed serverless or containerized PostgreSQL. |
| **Queue Store** | Redis 7 | **Upstash / Managed Redis / Docker** | Persistent Redis instance for BullMQ jobs. |
| **Search Engine**| Elasticsearch 8 | **Elastic Cloud / Bonsai / Docker** | Document indexing and fuzzy search. |

> [!NOTE]
> **Vercel** is a serverless platform optimized for frontend web applications. It does **not** run persistent background daemons (like BullMQ workers or Redis instances). 
> 
> Therefore, the recommended production architecture is:
> 1. **Frontend** deployed on **Vercel**.
> 2. **Backend + Worker + Services** deployed via **Docker Containers** (on Railway, Render, Fly.io, or a VPS).
> 3. Alternatively, deploy the **Entire Full Stack in 1 Command** using Docker Compose.

---

## 🌟 Option 1: Deploy Frontend on Vercel + Backend on Container Platform

### Step 1: Deploy Backend & Worker as Containers (e.g. Railway / Render / VPS)

1. **Build Docker Image** using [`Dockerfile.backend`](file:///m:/project/outbox/Dockerfile.backend):
   ```bash
   docker build -t outbox-backend -f Dockerfile.backend .
   ```
2. **Deploy to Railway / Render / Fly.io**:
   - Connect your GitHub repository.
   - Set the **Dockerfile Path** to `Dockerfile.backend`.
   - Add environment variables (see table below).
   - Deploy two services from the same image:
     - **API Service**: default command `node dist/index.js`
     - **Worker Service**: command `node dist/worker.js`

3. Note your deployed Backend URL (e.g. `https://outbox-backend.up.railway.app`).

---

### Step 2: Deploy Frontend to Vercel

#### Method A: Via Vercel Web Dashboard (Recommended)

1. Push your code to GitHub / GitLab / Bitbucket.
2. Log in to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New Project"**.
3. Import your repository.
4. In **Project Settings**:
   - **Root Directory**: `apps/frontend` (or leave as `./` with root [`vercel.json`](file:///m:/project/outbox/vercel.json)).
   - **Framework Preset**: `Next.js`.
5. Under **Environment Variables**, add:
   ```env
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-api.up.railway.app
   NEXT_PUBLIC_API_URL=https://your-backend-api.up.railway.app/api
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   NEXT_PUBLIC_SLACK_CLIENT_ID=your-slack-client-id
   ```
6. Click **Deploy**.

#### Method B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd apps/frontend
vercel --prod
```

---

## 🐳 Option 2: Deploy Entire Full Stack with Docker Compose

Deploy the entire stack (PostgreSQL, Redis, Elasticsearch, Backend API, BullMQ Worker, and Next.js Frontend) with a single command.

### 1. Configure Environment Variables
Copy the root `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 2. Start All Containers
```bash
docker-compose up -d --build
```

### 3. Check Container Status
```bash
docker-compose ps
```

All 6 services will be running:
- 🌐 **Frontend UI**: `http://localhost:3000`
- ⚙️ **Backend API**: `http://localhost:5000`
- 🩺 **Health Check**: `http://localhost:5000/health`
- 📊 **BullMQ Dashboard**: `http://localhost:5000/admin/queues` (User: `admin`, Pass: `admin`)
- 🗄️ **PostgreSQL**: `localhost:5432`
- ⚡ **Redis**: `localhost:6379`
- 🔍 **Elasticsearch**: `localhost:9200`

### 4. (Optional) Run Migrations & Seed Database
```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

### 5. Stop Containers
```bash
docker-compose down
```

---

## 🔑 Environment Variables Reference

| Variable | Required In | Description | Example |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | Vercel / Frontend | Public URL of Backend API | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | Vercel / Frontend | Public API Endpoint URL | `https://api.yourdomain.com/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Vercel / Frontend | Google OAuth 2.0 Client ID | `xxx.apps.googleusercontent.com` |
| `NEXT_PUBLIC_SLACK_CLIENT_ID` | Vercel / Frontend | Slack OAuth App Client ID | `xxx.xxx` |
| `PORT` | Backend Container | Express server port | `5000` |
| `FRONTEND_URL` | Backend Container | CORS Allowed Frontend URL | `https://frontend.vercel.app` |
| `BACKEND_URL` | Backend Container | Base URL for OAuth Callbacks | `https://api.yourdomain.com` |
| `DATABASE_URL` | Backend & Worker | PostgreSQL Connection URI | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Backend & Worker | Redis Connection URI | `redis://redis:6379` |
| `ELASTICSEARCH_URL` | Backend & Worker | Elasticsearch URL | `http://elasticsearch:9200` |
| `JWT_SECRET` | Backend & Worker | Token signing secret | `your-secret-key-32-chars-min` |
| `SESSION_SECRET` | Backend & Worker | Session encryption secret | `your-session-secret-key` |
| `ADMIN_PASSWORD` | Backend | Bull-Board Queue Dashboard Pass| `admin` |
| `SMTP_HOST` | Backend & Worker | SMTP server hostname | `smtp.ethereal.email` |
| `SMTP_PORT` | Backend & Worker | SMTP server port | `587` |
| `SMTP_USER` | Backend & Worker | SMTP login username | `your-smtp-user` |
| `SMTP_PASS` | Backend & Worker | SMTP login password | `your-smtp-password` |
| `MAX_EMAILS_PER_HOUR` | Backend & Worker | Global rate limit | `200` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Backend & Worker | Per-sender hourly limit | `5` |
| `MIN_DELAY_SECONDS` | Backend & Worker | Delay between consecutive emails | `2` |
| `WORKER_CONCURRENCY` | Worker Container | Concurrent queue jobs | `5` |
