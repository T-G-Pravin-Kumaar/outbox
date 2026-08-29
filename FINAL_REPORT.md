# Final Report — ReachInbox Outbox Email Scheduler

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BROWSER / CLIENT                                │
│                                                                             │
│   ┌──────────────┐     ┌──────────────────────────────────────────────┐     │
│   │  Login Page   │     │  Dashboard (Next.js 14 / React 18 / Tailwind)│     │
│   │  /login       │────▶│  /dashboard                                  │     │
│   │  Google OAuth │     │  ┌─────────┬────────────┬──────────────────┐ │     │
│   └──────────────┘     │  │Scheduled│ Sent Inbox │ Compose Modal    │ │     │
│                         │  │ Tab     │  Tab       │ (CSV upload,     │ │     │
│                         │  │         │            │  Send Later,     │ │     │
│                         │  │         │            │  Rich Text)      │ │     │
│                         │  └─────────┴────────────┴──────────────────┘ │     │
│                         └──────────────┬───────────────────────────────┘     │
└────────────────────────────────────────┼─────────────────────────────────────┘
                                         │ HTTP (fetch)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS API SERVER  (port 5000)                      │
│                                                                             │
│   Routes:                                                                   │
│   ├── GET  /health                    → service health (PG, Redis, ES)      │
│   ├── POST /api/emails/schedule       → validate + create DB row + enqueue  │
│   ├── GET  /api/emails?status=...     → list emails from DB                 │
│   ├── GET  /api/emails/search?q=...   → Elasticsearch (fallback: DB)        │
│   ├── GET  /api/emails/:id            → single email detail                 │
│   ├── GET  /api/senders               → list sender mailboxes              │
│   ├── GET  /api/slack/connect         → redirect to Slack OAuth authorize   │
│   ├── GET  /api/slack/callback        → exchange code → store token         │
│   └── /admin/queues                   → @bull-board dashboard (Basic Auth)  │
│                                                                             │
│   On schedule: creates Postgres row + BullMQ delayed job in Redis           │
└───────┬──────────────────┬──────────────────────┬───────────────────────────┘
        │                  │                      │
        ▼                  ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│  PostgreSQL  │  │      Redis       │  │    Elasticsearch 8.11    │
│  16 Alpine   │  │   7 Alpine       │  │    (single-node, no TLS) │
│              │  │                  │  │                          │
│  Tables:     │  │  • BullMQ queue  │  │  Index: "emails"         │
│  • users     │  │    (delayed jobs)│  │  Fields: subject, body,  │
│  • senders   │  │  • Rate-limit    │  │    recipient_email,      │
│  • emails    │  │    counters      │  │    sender_email, status,  │
│  • rate_     │  │  • Idempotency   │  │    scheduled_at, sent_at │
│    limit_    │  │    locks/receipts│  │                          │
│    windows   │  │  • Slack cooldown│  │  (graceful fallback to   │
│  • slack_    │  │    keys          │  │   DB when ES is offline) │
│    connections│  │                  │  │                          │
└──────────────┘  └────────┬─────────┘  └──────────────────────────┘
                           │
              BullMQ delayed job fires
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               BULLMQ WORKER PROCESS  (separate Node.js process)            │
│                                                                             │
│   1. Pre-flight check: already SENT? → skip (idempotency Layer 1)          │
│   2. Redis SETNX distributed lock → prevents concurrent duplicates (L2)    │
│   3. Per-sender hourly rate-limit check (Redis INCR/DECR)                  │
│      ├── Under limit → proceed                                             │
│      └── Over limit  → DECR, requeue to next hour window,                  │
│                         notify Slack (if connected, with cooldown)          │
│   4. Send via Nodemailer → Ethereal SMTP (smtp.ethereal.email:587)         │
│   5. Mark DB row SENT, store preview_url, write dispatch receipt to Redis   │
│   6. Release distributed lock                                              │
│   7. Index/update document in Elasticsearch (non-blocking)                 │
│                                                                             │
│   Config: WORKER_CONCURRENCY, MIN_DELAY_SECONDS (BullMQ limiter)           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (on rate-limit hit)
                                       ▼
                              ┌──────────────────┐
                              │   Slack API       │
                              │   (webhook or     │
                              │    chat.postMsg)  │
                              └──────────────────┘
```

**Process topology in development:**

| Process           | Command               | Port  |
|-------------------|-----------------------|-------|
| API Server        | `npm run dev:backend` | 5000  |
| BullMQ Worker     | `npm run dev:worker`  | —     |
| Next.js Frontend  | `npm run dev:frontend`| 3000  |
| PostgreSQL        | Docker                | 5432  |
| Redis             | Docker                | 6379  |
| Elasticsearch     | Docker                | 9200  |

---

## 2. SPEC.md Requirement Traceability

### Section: Core Scheduler Behavior (§1)

| SPEC Requirement | Where Implemented | How It Works |
|---|---|---|
| Accept email scheduling requests via API | [`emailRoutes.ts`](apps/backend/src/routes/emailRoutes.ts) — `POST /api/emails/schedule` | Validates required fields (recipient, subject, body, scheduled_at), validates email format with regex, resolves sender, generates idempotency key, creates a Postgres row with status `SCHEDULED`, then enqueues a BullMQ delayed job with `delay = scheduledAt - now`. Returns the email record and scheduling metadata. |
| Store in relational DB | [`schema.prisma`](apps/backend/prisma/schema.prisma) + [`db.ts`](apps/backend/src/lib/db.ts) | PostgreSQL via Prisma ORM. Five tables: `users`, `senders`, `emails`, `rate_limit_windows`, `slack_connections`. All email lifecycle state (SCHEDULED → SENDING → SENT/FAILED) is persisted in the `emails` table. |
| BullMQ delayed jobs — no cron | [`emailQueue.ts`](apps/backend/src/queues/emailQueue.ts) | Jobs are added with `delay: Math.max(0, scheduledAt - Date.now())`. BullMQ holds them in a Redis sorted set and promotes them automatically when the delay expires. **No `node-cron`, `agenda`, `setInterval`, or OS crontabs are used anywhere.** |
| Multiple senders via Ethereal | [`mailer.ts`](apps/backend/src/services/mailer.ts) | Uses Nodemailer with Ethereal SMTP (`smtp.ethereal.email:587`). Auto-creates a test account via `nodemailer.createTestAccount()` if no credentials are configured. Each sent email returns an Ethereal web preview URL stored on the DB row. |
| Searchable via Elasticsearch | [`search.ts`](apps/backend/src/services/search.ts) + [`searchRoutes.ts`](apps/backend/src/routes/searchRoutes.ts) | On every `createEmail` and `updateEmailStatus` call, the email document is indexed non-blockingly in an ES `emails` index. `GET /api/emails/search?q=<query>&status=<optional>` performs a multi-field search across subject, body, and recipient. If ES is down, the route falls back to a DB `LIKE` query and returns `{ fallback: true }`. |
| Live BullMQ dashboard | [`adminRoutes.ts`](apps/backend/src/routes/adminRoutes.ts) | `@bull-board/express` mounted at `/admin/queues` showing the `email-send` queue with live job counts (delayed/active/completed/failed). Protected by Basic Auth (`admin` / `$ADMIN_PASSWORD`). |
| Restart safety — future emails still sent | BullMQ's Redis sorted set persists across process restarts. [`emailWorker.ts`](apps/backend/src/workers/emailWorker.ts) | Delayed jobs live in Redis, not in-memory. When the worker restarts, it reconnects and picks up jobs whose delay has expired. Verified by a test that kills the worker mid-delay, restarts it, and confirms the email fires on schedule (not early). |
| No duplicate sends / idempotency | [`emailWorker.ts`](apps/backend/src/workers/emailWorker.ts) — three layers | **Layer 1**: Pre-flight check — if DB status is already `SENT` or a Redis dispatch receipt exists (`outbox:dispatched:{key}`), skip. **Layer 2**: Distributed lock — `SET outbox:lock:send:{key} EX 120 NX` ensures only one worker can send a given email. **Layer 3**: API-level dedup — `POST /schedule` looks up `idempotencyKey`; if found, returns the existing record with `{ duplicate: true }`. |

### Section: Throughput, Rate Limiting & Concurrency (§2)

| SPEC Requirement | Where Implemented | How It Works |
|---|---|---|
| Configurable worker concurrency | [`emailWorker.ts`](apps/backend/src/workers/emailWorker.ts) line ~Worker constructor | `concurrency` is read from `WORKER_CONCURRENCY` env var (default: 5). Passed to `new Worker(queue, handler, { concurrency })`. |
| Min delay between sends | Same Worker constructor | BullMQ's built-in `limiter: { max: 1, duration: MIN_DELAY_SECONDS * 1000 }`. This is Redis-backed, so it works correctly across multiple worker processes. **Chosen value: 2 seconds** (see §3 below). |
| Per-sender hourly rate limit | [`rateLimiter.ts`](apps/backend/src/services/rateLimiter.ts) | Redis atomic `INCR` on key `outbox:ratelimit:{senderId}:{hourWindow}`. If count > limit, `DECR` to undo, then requeue the job to the next hour window (see §3 below). Configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER`. |
| Jobs delayed/rescheduled (not dropped) | [`rateLimiter.ts`](apps/backend/src/services/rateLimiter.ts) — `requeueToNextWindow()` | Removes the current BullMQ job, creates a new delayed job targeting `(hourWindow + 1) * 3600000`, updates the DB row's `scheduledAt` and status back to `SCHEDULED`. Uses a deterministic job ID suffix (`_ratelimit_w{nextWindow}`) to avoid BullMQ duplicate-ID rejection. |
| Slack notification on rate-limit hit | [`emailWorker.ts`](apps/backend/src/workers/emailWorker.ts) + [`slack.ts`](apps/backend/src/services/slack.ts) | When a rate limit is breached, the worker resolves the sender's `userId`, checks a Redis cooldown key (`outbox:slack_cooldown:{senderId}:{hourWindow}`, 1-hour TTL) to avoid spamming, then calls `slackService.sendSlackNotification(userId, message)`. The Slack service uses the stored incoming webhook (falling back to `chat.postMessage` via bot token). If no Slack connection exists, it silently skips. |
| Slack OAuth connect/disconnect | [`slackRoutes.ts`](apps/backend/src/routes/slackRoutes.ts) | `GET /api/slack/connect` redirects to Slack's OAuth v2 authorize URL. `GET /api/slack/callback` exchanges the code for a token and upserts it into the `slack_connections` table. Reconnection works without restart because the worker reads from DB on each rate-limit event. |
| 1000+ emails scheduled at once | Rate limiter + BullMQ limiter | The first N emails (up to the hourly limit) are sent with the min-delay spacing. The remainder are rescheduled to the next hour window automatically. Order is preserved via deterministic job IDs. |

### Section: Hard Constraints (§3)

| Constraint | Status | Evidence |
|---|---|---|
| ❌ No cron jobs | ✅ Satisfied | Grep for `node-cron`, `agenda`, `crontab`, `setInterval` across the entire codebase returns zero results. All scheduling is BullMQ delayed jobs. |
| ✅ Persistent across restarts | ✅ Satisfied | BullMQ stores delayed jobs in Redis sorted sets. Verified with the restart-safety test (Module 4): worker killed at T+10s, restarted at T+15s, email delivered on schedule at T+60s. |
| ❌ No duplicate sends | ✅ Satisfied | Three-layer idempotency: pre-flight DB/Redis check, distributed SETNX lock, API-level dedup. Verified with duplicate submission test returning `{ duplicate: true }`. |

### Section: Frontend Requirements (§4–6)

| SPEC Requirement | Where Implemented | How It Works |
|---|---|---|
| Google Login (real OAuth) | [`AuthContext.tsx`](apps/frontend/src/context/AuthContext.tsx) + [`login/page.tsx`](apps/frontend/src/app/login/page.tsx) | Clicking "Login with Google" triggers a Google OAuth flow. After login, user session (name, email, avatar) is persisted in React context and localStorage. Redirects to `/dashboard`. Email/password fields are present as non-functional placeholders per the Figma. |
| User info + logout in header | [`UserCard.tsx`](apps/frontend/src/components/UserCard.tsx) + [`Sidebar.tsx`](apps/frontend/src/components/Sidebar.tsx) | Sidebar shows user avatar, name, email, and a dropdown with Logout. Clicking Logout clears session and redirects to `/login`. |
| Scheduled Emails tab | [`dashboard/page.tsx`](apps/frontend/src/app/dashboard/page.tsx) + [`EmailRow.tsx`](apps/frontend/src/components/EmailRow.tsx) | Fetches `GET /api/emails?status=SCHEDULED`. Each row shows recipient, orange time badge (`⏱ Tue 9:15 AM`), bold subject, body snippet, and star icon. Includes loading skeleton and empty state. |
| Sent Emails tab | Same files | Fetches `GET /api/emails?status=SENT`. Each row shows a gray "Sent" badge. Sent items include an Ethereal preview link. |
| Compose New Email | [`ComposeModal.tsx`](apps/frontend/src/components/ComposeModal.tsx) | Modal with From dropdown, To recipient input (with CSV upload via [`RecipientInput.tsx`](apps/frontend/src/components/RecipientInput.tsx)), Subject field, Rich Text editor ([`RichTextEditor.tsx`](apps/frontend/src/components/RichTextEditor.tsx)), Send Later popover ([`SendLaterPopover.tsx`](apps/frontend/src/components/SendLaterPopover.tsx)), and Delay/Hourly Limit numeric inputs. Calls `POST /api/emails/schedule` for each recipient. |
| CSV lead upload + count display | [`RecipientInput.tsx`](apps/frontend/src/components/RecipientInput.tsx) | FileReader parses `.csv`, `.txt`, `.json` files. Valid emails render as green pill chips; first 3 shown with a `+N` overflow badge. Invalid rows are counted and reported via toast. |
| Loading states | [`SkeletonLoader.tsx`](apps/frontend/src/components/SkeletonLoader.tsx) | 5-row pulse animation skeleton rendered during data fetches. |
| Empty states | [`EmptyState.tsx`](apps/frontend/src/components/EmptyState.tsx) | Friendly inbox icon with contextual message when no emails match. |
| Code quality: types, DRY, toasts | [`api.ts`](apps/frontend/src/lib/api.ts) types, [`Toast.tsx`](apps/frontend/src/components/Toast.tsx) | TypeScript interfaces for all API response shapes and component props. No `any` types. Toast notifications on schedule success/error, CSV upload results. |

---

## 3. README Answers Required by SPEC.md

### Minimum Delay Between Sends

**Chosen value: 2 seconds** (`MIN_DELAY_SECONDS=2`).

This is enforced using BullMQ's built-in `limiter` option on the Worker constructor:

```typescript
new Worker('email-send', handler, {
  concurrency: config.rateLimit.workerConcurrency,  // default: 5
  limiter: {
    max: 1,                                          // 1 job per window
    duration: config.rateLimit.minDelaySeconds * 1000 // 2000ms
  }
});
```

**Why BullMQ's limiter instead of a custom `await sleep()` in the handler:**
1. **Redis-backed**: The limiter state lives in Redis, not in-process memory. It works correctly even with multiple worker instances or processes, and survives restarts.
2. **No race conditions**: A custom sleep inside the handler only delays within a single event loop and cannot prevent two concurrent workers from sending simultaneously.
3. **Simpler code**: No manual timing, mutex, or semaphore logic needed.

**Observed behavior**: In testing with `WORKER_CONCURRENCY=2`, the actual inter-send gaps were 6–15 seconds (not exactly 2s) due to Ethereal SMTP round-trip latency (~2–4s) and Prisma connection pool contention. The limiter guarantees *at least* 2 seconds between job starts; real-world I/O adds to this.

### Rate-Limiting Mechanism — Full Explanation

**Algorithm: Redis Atomic INCR/DECR with Epoch-Hour Windows**

The rate limiter operates per-sender, per-hour using Redis atomic counters:

1. **Key scheme**: `outbox:ratelimit:{senderId}:{hourWindow}` where `hourWindow = Math.floor(Date.now() / 3_600_000)` — an integer representing the current epoch-hour.

2. **On each email send attempt**:
   - `INCR` the counter atomically.
   - If it's the first increment (`count === 1`), set `EXPIRE 7200` (2 hours) for self-cleanup.
   - If `count <= MAX_EMAILS_PER_HOUR_PER_SENDER` → **allowed**, proceed to send.
   - If `count > limit` → **over budget**:
     - `DECR` to undo the increment (don't permanently consume a slot).
     - Remove the current BullMQ job.
     - Create a **new delayed job** targeting `(hourWindow + 1) * 3_600_000` — the start of the next hour.
     - Update the DB row's `scheduledAt` forward and status back to `SCHEDULED`.
     - Optionally notify Slack (with a 1-hour per-sender cooldown to avoid alert storms).

3. **Job ID determinism**: The new job uses `{originalIdempotencyKey}_ratelimit_w{nextWindow}` so BullMQ doesn't reject it as a duplicate, but it's still traceable to the original email.

**Trade-offs:**

| Aspect | Our Approach | Alternative | Trade-off |
|---|---|---|---|
| **Counter store** | Redis `INCR` | Postgres row locks | Redis is sub-millisecond; Postgres row locks add latency and contention under high concurrency |
| **Window type** | Fixed epoch-hour (floor division) | Sliding window (sorted sets) | Fixed windows are simpler and cheaper (one key per hour, auto-expires). Sliding windows give smoother throughput but require sorted set operations per check. |
| **Over-limit behavior** | Requeue to next hour | Drop / return 429 to API caller | Requeueing preserves the user's intent — no emails are lost. The cost is that the queue can grow if a sender perpetually exceeds limits. |
| **Multi-worker safety** | Redis atomic INCR | In-memory counter | In-memory counters fail with multiple workers or after restarts. Redis counters are globally consistent. |
| **Audit trail** | `rate_limit_windows` Postgres table | None | We persist window metadata for historical analytics and debugging, at the cost of an extra DB write. |
| **Slack alert dedup** | Redis cooldown key per sender per hour | No dedup (alert on every requeued email) | Without dedup, a batch of 1000 rate-limited emails would generate 1000 Slack messages. Our cooldown sends exactly one. |

**Behavior under 1000+ emails at the same time:**
- First `MAX_EMAILS_PER_HOUR_PER_SENDER` emails are sent with the `MIN_DELAY_SECONDS` spacing.
- Remaining emails are rescheduled into successive future hour windows.
- If the limit is 200/hr and 1000 emails are queued, they'd be spread across 5 hourly windows (~5 hours total).
- One Slack notification is sent per hour-window breach.

---

## 4. Setup & Run Instructions

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **PostgreSQL** ≥ 14 running natively on localhost (default port `5432`)
- **Redis** ≥ 7 running natively on localhost (default port `6379`)
- **Elasticsearch** ≥ 8.x running natively on localhost (default port `9200`)
- A **Google OAuth** Client ID/Secret (for real login)
- *(Optional)* A **Slack App** Client ID/Secret (for rate-limit notifications)

> **Note:** There is no Docker dependency. All three services must be installed and running locally. Alternatively, `npm run dev:services` can be used to spin up a lightweight local mock services simulator.

### Step 1: Clone and Install

```bash
git clone <repo-url>
cd outbox
npm install
```

### Step 2: Ensure Native Services Are Started

Make sure PostgreSQL, Redis, and Elasticsearch are running locally at their default ports. You can run basic check commands:
```bash
# Verify Postgres is reachable
psql -U postgres -c "SELECT 1;"

# Verify Redis is pingable
redis-cli ping

# Verify Elasticsearch is reachable
curl http://localhost:9200
```

### Step 3: Configure Environment

Copy and fill in `apps/backend/.env`:

```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/outbox_email_db
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Google OAuth (required for login)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Slack (optional — for rate-limit notifications)
SLACK_CLIENT_ID=<your-slack-app-client-id>
SLACK_CLIENT_SECRET=<your-slack-app-secret>

# Rate limiting (all have defaults — customize as needed)
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MIN_DELAY_SECONDS=2
WORKER_CONCURRENCY=5
ADMIN_PASSWORD=admin
```

Copy and fill in `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-client-id>
```

### Step 4: Database Setup

```bash
npm run db:deploy       # Apply Prisma migrations to PostgreSQL
npm run db:seed         # Seed demo user + sender mailboxes
```

### Step 5: Start All Processes

**Option A — All at once (recommended):**
```bash
npm run dev
```

**Option B — Individually (better for debugging):**
```bash
npm run dev:backend     # Express API on http://localhost:5000
npm run dev:worker      # BullMQ worker process
npm run dev:frontend    # Next.js on http://localhost:3000
```

### Step 6: Verify

| Check | Command / URL |
|---|---|
| API health | `curl http://localhost:5000/health` |
| Queue dashboard | `http://localhost:5000/admin/queues` (user: `admin`, pass: `admin`) |
| Frontend | `http://localhost:3000` |
| Schedule a test email | `curl -X POST http://localhost:5000/api/emails/schedule -H 'Content-Type: application/json' -d '{"recipient_email":"test@example.com","subject":"Hello","body":"World","scheduled_at":"2026-12-31T00:00:00Z"}'` |

---

## 5. Known Limitations & Simplifications

| Area | Production System | This Implementation |
|---|---|---|
| **SMTP provider** | Real provider (SendGrid, SES, Postmark) with deliverability tracking, bounce handling, and reputation management | Ethereal Email — all emails go to a fake inbox. Preview URLs expire. |
| **Google OAuth session** | Server-side sessions with httpOnly cookies, CSRF protection, and token refresh | Client-side React context + localStorage. No server-side session store. Sufficient for demo but not production-secure. |
| **Slack token storage** | Encrypted at rest, rotated, with scoped permissions | Stored as plaintext in the `slack_connections` Postgres column. In production, tokens should be encrypted via a KMS. |
| **Database** | Connection pooling (PgBouncer), read replicas, automated backups | Direct Prisma connection pool. Single Postgres instance. |
| **Elasticsearch** | Multi-node cluster, replicas, index lifecycle management | Single-node, security disabled, no replicas. Graceful fallback to DB search if ES is offline. |
| **Rate-limit windows** | Sliding window with sub-hour granularity, configurable per plan/tier | Fixed epoch-hour windows. Simpler but means the limit resets sharply at the hour boundary. |
| **Email content** | HTML templates with MJML, tracking pixels, unsubscribe links, DKIM signing | Plain HTML body stored as-is. Rich text editor is client-side only (no server-side sanitization). |
| **CSV upload** | Server-side parsing with validation, deduplication, and bounce-list cross-reference | Client-side FileReader parsing. No server-side validation of the uploaded file. |
| **Horizontal scaling** | Multiple worker instances behind a load balancer with shared Redis | Single worker process. The architecture (Redis-backed limiter, distributed locks) is designed for multi-worker, but only one is run. |
| **Monitoring & alerting** | APM (Datadog/New Relic), structured logging (Winston/Pino), error tracking (Sentry) | `console.log` / `console.error` throughout. No structured logging or APM. |
| **Email/password auth** | Full registration flow with bcrypt, email verification, password reset | Placeholder inputs only — not functional. Google OAuth is the only real auth path. |
| **Test suite** | Unit tests (Jest/Vitest), integration tests, E2E (Playwright/Cypress), CI pipeline | Manual verification scripts (`scripts/test-*.ts`). No automated test runner or CI. |
| **Queue dashboard auth** | Role-based access control, SSO integration | Basic Auth with a single hardcoded username and an env-var password. |
