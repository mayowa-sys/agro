# AGRO — Mayowa's Progress Tracker

Living checklist of what's done, in progress, and blocked. Updated after each major task.

**Legend:**
- ✅ Done
- 🟡 In progress
- ⬜ Not started
- 🚫 Blocked (waiting on something)

**Current status:** Phase 1 ✅ complete, Phase 2 ✅ complete — starting Phase 3 (money-movement modules)

---

## Phase 1: Setup (solo — Tolu blocked until this finishes)

### §1.1 Repo
- ✅ GitHub repo created (`agro`)
- ✅ `.gitignore` added
- ✅ MIT LICENSE added
- ✅ Default branch set to `main`
- ✅ Tolu added as collaborator
- ✅ Initial commit pushed

### §1.2 Monorepo structure
- ✅ Folder skeleton created
- ✅ `.gitkeep` files in empty folders
- ✅ Root `package.json` with workspaces
- ✅ Root README.md
- ✅ docs/ stubs (architecture.md, api-contract.md, demo-script.md)
- ✅ Committed and pushed

### §1.3 `.env.example`
- ✅ Created at repo root with all required keys
- ✅ Local `.env` created by copying template
- ✅ JWT_SECRET, SQUAD_WEBHOOK_SECRET, AI_SERVICE_TOKEN, DEMO_RESET_TOKEN generated and filled
- ✅ Verified `.env` is gitignored
- ✅ `.env.example` committed and pushed
- ✅ Squad keys (SECRET_KEY, PUBLIC_KEY, MERCHANT_ID) — filled in §1.6
- ✅ Africa's Talking keys (USERNAME, API_KEY, SHORTCODE) — filled in §1.6

### §1.4 Local dev infra
- ✅ `docker-compose.yml` created (postgres + redis with healthchecks)
- ✅ Postgres + Redis come up healthy
- ✅ Documented in README ("Local infrastructure" section)

### §1.5 Shared types package
- ✅ `packages/shared-types/` initialized
- ✅ Linked from apps via workspace protocol
- ✅ `npm install` resolves cleanly

### §1.6 External accounts
- ✅ Squad sandbox account
- ✅ Africa's Talking account
- ⬜ VPS provisioned — using Railway for deployment (§12)
- ⬜ Optional domain registered

### §1.7 Squad sandbox quirks
- ✅ Reached out for sandbox-friendly BVNs (support emailed, mock layer covers us in meantime)
- ✅ Documented quirks in `docs/squad-integration.md`

### §1.8 Express API scaffold
- ✅ `apps/api/` initialized
- ✅ Dependencies installed
- ✅ `tsconfig.json` created (excludes prisma.config.ts)
- ✅ `src/app.ts`, `src/index.ts`, `src/routes/index.ts`, `src/lib/prisma.ts`, `src/lib/errors.ts` created
- ✅ `npm run dev` serves `/health`
- ✅ dotenv loaded with explicit path to root `.env`

### §1.9 Database schema (Prisma)
- ✅ `schema.prisma` written (Prisma v7 — enums on separate lines, no url in schema)
- ✅ Initial migration run
- ✅ Prisma client generated (adapter-pg)
- ✅ `seed.ts` written
- ✅ Seed runs via: `DATABASE_URL=postgresql://agro:agro@localhost:5432/agro npx ts-node --project tsconfig.json prisma/seed.ts`

### §1.10 Auth module
- ✅ Middleware `auth.ts` created (requireAuth, requireRole)
- ✅ `auth.routes.ts` created (signup, login, me, demo-login, signToken helper)
- ✅ Mounted in `registerRoutes`
- ✅ Shared types added (AuthUser, AuthResponse, SignupRequest, LoginRequest)

### §1.11 Notify Tolu setup is done [GIVE TO TOLU]
- ✅ Pinged Tolu

---

## Phase 2: Squad client + webhook receiver ✅

### §2.1 Squad client wrapper
- ✅ `src/squad/squad.client.ts` created (SquadClient class + squadClient singleton)
- ✅ `src/squad/squad.types.ts` created (all Squad TS interfaces)

### §2.2 Mock mode
- ✅ isMock branches in SquadClient — all methods return realistic test data when SQUAD_MOCK_MODE=true

### §2.3 Webhook receiver
- ✅ `src/routes/squad-webhook.routes.ts` created
- ✅ HMAC-SHA512 signature verification (x-squad-signature header)
- ✅ Idempotency via Redis (7-day TTL per event ID)
- ✅ Routes to splitsQueue or deferralsQueue depending on active deferrals
- ✅ Mock trigger endpoint at POST /squad/mock/trigger-webhook confirmed working
- ✅ Mounted at /squad in registerRoutes
- ✅ Committed as feat/api-squad-integration

---

## Phase 3: Money-movement modules
🟡 Starting now

### §3.1 BullMQ + Redis setup
- ✅ `src/lib/redis.ts` created
- ✅ `src/lib/queues.ts` created (splitsQueue, factoringQueue, deferralsQueue, briefsQueue, forecastsQueue)
- ⬜ `src/workers/index.ts` created

### §3.2 Virtual Accounts module
- ⬜ `src/services/accounts.service.ts` created
- ⬜ `src/routes/accounts.routes.ts` created
- ⬜ Mounted in registerRoutes

### §3.3 Split routing module
- ⬜ `src/routes/splits.routes.ts` created
- ⬜ `src/workers/splits.worker.ts` created
- ⬜ Edge cases handled (< ₦1000, active deferral priority)

### §3.4 Deferrals module
- ⬜ `src/routes/deferrals.routes.ts` created
- ⬜ `src/workers/deferrals.worker.ts` created

### §3.5 Factoring module
- ⬜ `src/routes/factoring.routes.ts` created
- ⬜ `src/workers/factoring.worker.ts` created
- ⬜ Liberation endpoints created
- ⬜ All routes mounted, mock mode verified end-to-end
- ⬜ Committed as feat/api-money-movement

---

## Phase 4: AI forecast service
*(not started)*

## Phase 5–9: Frontend pages
*(blocked on Tolu's scaffold + auth + AppShell)*

## Phase 10: Demo endpoints + seed scripts
*(not started)*

## Phase 11: Joint coordination
*(ongoing — see plan)*

## Phase 12: Deployment
*(not started — Railway chosen over VPS)*

## Phase 13: Pre-demo checklist
*(24h before demo)*