# AGRO — Mayowa's Progress Tracker

Living checklist of what's done, in progress, and blocked. Updated after each major task.

**Legend:**
- ✅ Done
- 🟡 In progress
- ⬜ Not started
- 🚫 Blocked (waiting on something)

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
- 🟡 Squad keys (SECRET_KEY, PUBLIC_KEY, MERCHANT_ID) — pending §1.6
- 🟡 Africa's Talking keys (USERNAME, API_KEY, SHORTCODE) — pending §1.6

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
- ⬜ VPS provisioned
- ⬜ Optional domain registered

### §1.7 Squad sandbox quirks
- ⬜ Reached out for sandbox-friendly BVNs
- ⬜ Tested sandbox auth via curl
- ⬜ Documented quirks in `docs/squad-integration.md`

### §1.8 Express API scaffold
- ⬜ `apps/api/` initialized
- ⬜ Dependencies installed
- ⬜ `tsconfig.json` created
- ⬜ `src/app.ts`, `src/index.ts`, `src/routes/index.ts`, `src/lib/prisma.ts`, `src/lib/errors.ts` created
- ⬜ `npm run dev` serves `/health`

### §1.9 Database schema (Prisma)
- ⬜ `schema.prisma` written
- ⬜ Initial migration run
- ⬜ Prisma client generated
- ⬜ `seed.ts` written
- ⬜ Seed runs successfully

### §1.10 Auth module
- ⬜ Middleware `auth.ts` created
- ⬜ `auth.routes.ts` created
- ⬜ Mounted in `registerRoutes`
- ⬜ Shared types added

### §1.11 Notify Tolu setup is done [GIVE TO TOLU]
- ⬜ Pinged Tolu

---

## Phase 2: Squad client + webhook receiver
*(not started)*

## Phase 3: Money-movement modules
*(not started)*

## Phase 4: AI forecast service
*(not started)*

## Phase 5–9: Frontend pages
*(blocked on Tolu's scaffold + auth + AppShell)*

## Phase 10: Demo endpoints + seed scripts
*(not started)*

## Phase 11: Joint coordination
*(ongoing — see plan)*

## Phase 12: Deployment
*(not started)*

## Phase 13: Pre-demo checklist
*(24h before demo)*
