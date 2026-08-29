# ReachInbox Outbox — Email Scheduler Service + Dashboard

A production-grade email scheduling system built with **Express.js**, **BullMQ + Redis**, **PostgreSQL**, **Elasticsearch**, and a **Next.js** frontend. Emails are scheduled via API, persisted in a relational database, dispatched as BullMQ delayed jobs (no cron), sent through Ethereal SMTP, and made searchable via Elasticsearch.

> **📄 Full technical report**: See [`FINAL_REPORT.md`](FINAL_REPORT.md) for architecture diagrams, SPEC.md traceability, rate-limiting deep-dive, and known limitations.
>
> **📋 Original specification**: See [`SPEC.md`](SPEC.md) for the assignment requirements.
>
> **📝 Build log**: See [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md) for module-by-module implementation details and verification results.

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **PostgreSQL** ≥ 14 installed and running on port `5432`
- **Redis** ≥ 7 installed and running on port `6379`
- **Elasticsearch** ≥ 8.x installed and running on port `9200` (with security disabled for local dev)
- A **Google OAuth** Client ID/Secret ([console.cloud.google.com](https://console.cloud.google.com))
- *(Optional)* A **Slack App** Client ID/Secret for rate-limit notifications

> **Note:** All three services (Postgres, Redis, Elasticsearch) must be running natively on your machine before starting the app. There is no Docker dependency.

### 1. Install Dependencies

```bash
git clone <repo-url>
cd outbox
npm install
```

### 2. Ensure Services Are Running

Verify that PostgreSQL, Redis, and Elasticsearch are started and reachable at their default ports:

```bash
# PostgreSQL
psql -U postgres -c "SELECT 1;"

# Redis
redis-cli ping          # Should return PONG

# Elasticsearch
curl http://localhost:9200   # Should return cluster info JSON
```

Alternatively, run `npm run dev:services` for a lightweight in-process simulator (useful when native services aren't available).

---

## 🛠 Local Infra Setup (no Docker)

Follow the instructions below to install and run the database, queue, and search engines natively on your system.

### 🐘 1. PostgreSQL (Port 5432)

*   **macOS (Homebrew)**
    *   *Install*: `brew install postgresql@16`
    *   *Start*: `brew services start postgresql@16`
*   **Ubuntu/Debian (apt)**
    *   *Install*: `sudo apt update && sudo apt install postgresql postgresql-contrib -y`
    *   *Start*: `sudo service postgresql start`
*   **Windows (WSL2 / Native)**
    *   *WSL2 (Recommended)*: `sudo apt install postgresql` followed by `sudo service postgresql start`
    *   *Native Windows Installer*: Download the interactive installer from the [official website](https://www.postgresql.org/download/windows/) and run it.
*   **Verify**: `psql -U postgres -h localhost -c "SELECT 1;"`

### 🔴 2. Redis (Port 6379)

*   **macOS (Homebrew)**
    *   *Install*: `brew install redis`
    *   *Start*: `brew services start redis`
*   **Ubuntu/Debian (apt)**
    *   *Install*: `sudo apt install redis-server -y`
    *   *Start*: `sudo service redis-server start`
*   **Windows (WSL2 / Native)**
    *   *WSL2 (Recommended)*: `sudo apt install redis-server` followed by `sudo service redis-server start`.
    *   *Note*: There is **no official native installer** for Redis on Windows. Native Windows users must run Redis via WSL2 or use third-party ports like Memurai.
*   **Verify**: `redis-cli ping` (should return `PONG`)

### 🔍 3. Elasticsearch (Port 9200)

*   **macOS (Homebrew)**
    *   *Install*: `brew tap elastic/tap && brew install elastic/tap/elasticsearch-full`
    *   *Start*: `brew services start elasticsearch-full`
*   **Ubuntu/Debian (apt)**
    *   *Install*: Follow the [Official Elastic APT installation guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/deb.html) to import keys and install.
    *   *Start*: `sudo systemctl start elasticsearch`
*   **Windows (WSL2 / Native)**
    *   *WSL2 (Recommended)*: Install using Debian package or raw tarball extract.
    *   *Native Windows*: Download the ZIP package from the [Elastic downloads page](https://www.elastic.co/downloads/elasticsearch), extract it, and run `bin\elasticsearch.bat` from an administrator command prompt.
*   **Verify**: `curl http://localhost:9200` (should return JSON with cluster information)

> **⚠️ CRITICAL: Elasticsearch Configuration for Local Development**
>
> 1.  **Disable Security (TLS & Auth)**:
>     By default, Elasticsearch 8+ enables security and SSL. For local dev compatibility, open your `elasticsearch.yml` configuration file (located in `config/` or `/etc/elasticsearch/`) and update the following properties:
>     ```yaml
>     xpack.security.enabled: false
>     xpack.security.http.ssl.enabled: false
>     ```
>     Restart the Elasticsearch service after making these changes.
> 2.  **Memory Requirement (JVM Heap Size)**:
>     Elasticsearch is Java-based and resource-intensive. It requires at least **1.5GB to 2GB of free RAM**.
>     - If you experience startup crashes (OutOfMemoryError), configure the JVM heap options inside your configuration folder's `jvm.options` or `jvm.options.d/heap.options` file to allocate a smaller slice:
>       ```text
>       -Xms512m
>       -Xmx512m
>       ```
> 3.  **Java Requirement**:
>     Elasticsearch 8 includes a bundled JDK. If you use a version/installation that does not include it, ensure you have **Java 17 or Java 21** installed and configured in your `JAVA_HOME` environment path.

---

### 3. Configure Environment

**Backend** — edit `apps/backend/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/outbox_email_db

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Google OAuth (required for frontend login)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Slack (optional)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# Rate limiting & concurrency (defaults shown)
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MIN_DELAY_SECONDS=2
WORKER_CONCURRENCY=5
ADMIN_PASSWORD=admin
```

**Frontend** — edit `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>
```

### 4. Database Migrations & Seeding

```bash
npm run db:deploy       # Apply Prisma migrations
npm run db:seed         # Seed demo user + sender mailboxes
```

### 5. Run Everything

```bash
npm run dev             # Starts API + Worker + Frontend concurrently
```

Or run individually:

```bash
npm run dev:backend     # Express API → http://localhost:5000
npm run dev:worker      # BullMQ worker process
npm run dev:frontend    # Next.js → http://localhost:3000
```

### 6. Verify

| What | How |
|---|---|
| API health | `curl http://localhost:5000/health` |
| Queue dashboard | [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) — user: `admin`, pass: `admin` |
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Schedule test email | `curl -X POST http://localhost:5000/api/emails/schedule -H "Content-Type: application/json" -d '{"recipient_email":"test@example.com","subject":"Hello","body":"World","scheduled_at":"2026-12-31T00:00:00Z"}'` |

---

## Key Design Decisions

### Minimum Delay Between Sends: **2 seconds**

Enforced via BullMQ's built-in `limiter: { max: 1, duration: 2000 }` on the Worker constructor. This is Redis-backed (works across multiple workers) and survives restarts. See [FINAL_REPORT.md §3](FINAL_REPORT.md#3-readme-answers-required-by-specmd) for full rationale.

### Rate Limiting: Redis Atomic INCR/DECR per Epoch-Hour

Per-sender hourly limits use Redis keys `outbox:ratelimit:{senderId}:{hourWindow}`. When exceeded, jobs are rescheduled (not dropped) to the next hour. Slack is notified once per sender per hour. See [FINAL_REPORT.md §3](FINAL_REPORT.md#3-readme-answers-required-by-specmd) for the full algorithm, trade-offs table, and behavior-under-load analysis.

---

## Project Structure

```
outbox/
├── apps/
│   ├── backend/                    # Express.js + TypeScript
│   │   ├── prisma/                 # Schema, migrations, seed script
│   │   └── src/
│   │       ├── config/env.ts       # Centralized configuration
│   │       ├── lib/                # DB, Redis, Prisma, ES clients
│   │       ├── queues/             # BullMQ queue definition
│   │       ├── routes/             # Express routers (email, slack, search, admin, health)
│   │       ├── services/           # Mailer, rate limiter, search, Slack
│   │       ├── workers/            # BullMQ email worker handler
│   │       ├── index.ts            # API server entrypoint
│   │       └── worker.ts           # Worker process entrypoint
│   └── frontend/                   # Next.js 14 + React 18 + Tailwind
│       └── src/
│           ├── app/                # Pages (login, dashboard)
│           ├── components/         # 13 reusable UI components
│           ├── context/            # Auth context provider
│           └── lib/                # API client utilities
├── scripts/                        # Test/verification scripts
├── docker-compose.yml              # PostgreSQL + Redis + Elasticsearch
├── SPEC.md                         # Assignment specification
├── FINAL_REPORT.md                 # Full technical report
└── IMPLEMENTATION_LOG.md           # Module-by-module build log
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start API + Worker + Frontend concurrently |
| `npm run dev:backend` | Start Express API server (hot reload) |
| `npm run dev:worker` | Start BullMQ worker (hot reload) |
| `npm run dev:frontend` | Start Next.js dev server |
| `npm run dev:services` | Start local service simulators (no Docker) |
| `npm run build` | Production build (all workspaces) |
| `npm run db:deploy` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset database (wipe + migrate + seed) |
| `npm run db:studio` | Open Prisma Studio GUI |
