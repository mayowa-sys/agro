# AGRO

Squad-powered cash flow operating system for Nigerian smallholder farmers.

Three virtual accounts (Working / Bills / Next Season), automatic split routing on harvest payments, AI-driven 90-day cash flow forecasts, input deferrals, and aggregator factoring — all built on Squad's Nigerian payments stack.

## Stack

- API: Node.js + Express + TypeScript + Prisma + Postgres + Redis + BullMQ
- AI: Python 3.11 + FastAPI + Prophet + scikit-learn
- Web: React + Vite + TypeScript + Tailwind + shadcn/ui (built by Tolu)
- Infra: Docker Compose locally; Caddy + Docker on a VPS in production
- Payments: Squad (virtual accounts, transfers, mandates)
- Messaging: Africa's Talking (SMS)

## Repo layout

```
agro/
├── apps/
│   ├── api/          Node.js + Express backend
│   ├── web/          React frontend
│   └── ai/           Python FastAPI ML service
├── packages/
│   └── shared-types/ Shared TypeScript types between api and web
└── docs/             Architecture, API contract, demo script
```

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Docker & Docker Compose

### First-time setup

```bash
# 1. Clone
git clone https://github.com/<your-username>/agro.git
cd agro

# 2. Copy environment template
cp .env.example .env

# Edit .env and fill in Squad / Africa's Talking / JWT secrets

# 3. Start local infra (Postgres + Redis)
docker compose up -d

# 4. Install all workspace dependencies
npm install

# 5. Run database migrations
cd apps/api
npx prisma migrate dev
npx prisma db seed

# 6. Start the API
npm run dev
```

The API will be running at http://localhost:3000

Health check:

```bash
curl http://localhost:3000/health
```

## Documentation

- Architecture: ./docs/architecture.md
- API contract: ./docs/api-contract.md
- Demo script: ./docs/demo-script.md

## Team

- Mayowa — Squad integration, AI/forecast service, money movement, deployment
- Tolu — Frontend scaffold, auth UI, AppShell, dashboard, onboarding

## License

MIT — see LICENSE.

## Local infrastructure

`docker-compose.yml` brings up two services:

- **Postgres** (TimescaleDB image, PG16) on `localhost:5432` — user `agro`, pass `agro`, db `agro`
- **Redis** 7 on `localhost:6379`

```bash
docker compose up -d        # start
docker compose ps           # check health
docker compose logs -f      # tail logs
docker compose down         # stop (volume preserved)
docker compose down -v      # stop + wipe data
```

Data persists in the `agro_pg` Docker volume between restarts. To start fresh, use `docker compose down -v`.
