# AGRO

**A Squad-powered cash flow OS for Nigerian smallholder farmers, rural youth labourers, and aggregators.**

Built for Squad Hackathon 3.0 — *Smart Systems: The Intelligent Economy*.

---

## The problem

Nigeria has 14.5 million smallholder farmers (FAO 2023) and 40 million informal workers (NBS 2022) living outside formal financial systems. They lose money in three predictable ways every season:

1. **Middleman discounts** — Farmers sell harvests to traders at 28–42% below market because they need cash now, not in 30 days (Babban Gona field data, CGAP smallholder reports).
2. **Cash-on-day wage premiums** — 40% of 3,416 informal workers in a 2021 SBM Intelligence study were owed wages, sometimes for up to 20 months. Workers accept lower wages in exchange for being paid the day work is done.
3. **No credit, no forecast, no plan** — Without payment history, smallholders can't access input credit. Without a forecast, they can't see a cash gap coming until it's too late.

AGRO addresses all three with a single integrated platform.

---

## The solution

AGRO is a three-sided platform built on Squad's API stack:

- **Farmers** get three virtual accounts (Working, Bills, Next Season), automatic split routing on every harvest, a 180-day Prophet-based cash forecast, input credit at harvest-time repayment terms, and a Liberation Counter showing exactly how much they kept that would have gone to middlemen.

- **Labourers** get matched to nearby jobs via sentence-transformer semantic search, paid the day the work is confirmed, build a reputation tier across gigs, and unlock wage advances at Tier 3+.

- **Aggregators** get a dashboard of farmers on their roster, factoring advances on confirmed harvests, and a contribution metric showing the liberation they enable.

Everything ties back to Squad: virtual accounts, transfers, webhooks for harvest payments, split routing.

---

## Four pillars addressed

| Pillar | How AGRO addresses it |
|---|---|
| **AI Automation** | Prophet forecasts auto-trigger input credit suggestions. Splits route automatically on harvest webhook. Wages auto-pay on dual confirmation. |
| **Use of Data** | 5-factor credit scoring (repayment, forecast confidence, gig reputation, balance trend, account age). Semantic match scoring with 5 explainable components. Liberation Counter with audited methodology. |
| **Squad APIs** | Virtual accounts, webhook receiver, transfer API for splits/wages/input credit/factoring. Six distinct integration points. |
| **Financial Innovation** | Harvest-cycle input credit (not monthly interest). Labour reputation as alternative credit data. Liberation Counter as an impact KPI. |

---

## Stack

- **Backend:** Node 20 + Express + TypeScript, Prisma v7 (adapter-pg), Postgres (TimescaleDB), Redis, BullMQ workers
- **AI service:** Python 3.9 + FastAPI, Prophet (6 crop models), sentence-transformers (all-MiniLM-L6-v2)
- **Frontend:** Vite + React 18 + TypeScript, Tailwind 3, shadcn-Nova, Framer Motion
- **Payments:** Squad API (mock mode in dev, live in production)

---

## Running locally

### Prerequisites

- Node 20+
- Python 3.9
- Docker Desktop
- pnpm or npm

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/agro.git
cd agro

# Install dependencies
npm install

# Start Postgres + Redis
docker compose up -d

# Run migrations
cd apps/api
npx prisma migrate deploy
cd ../..

# Set up Python AI service
cd apps/ai
python3.9 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# Copy env file and fill values
cp .env.example .env
```

### Run

Three services in three terminals:

```bash
# Terminal 1 — API (port 3000)
cd apps/api && npm run dev

# Terminal 2 — AI service (port 8001)
cd apps/ai && source .venv/bin/activate && uvicorn app.main:app --port 8001 --reload

# Terminal 3 — Web (port 5173)
cd apps/web && npm run dev
```

### Seed demo data

```bash
curl -X POST http://localhost:3000/demo/seed-tunde \
  -H "Content-Type: application/json" \
  -H "x-demo-token: YOUR_DEMO_TOKEN"
```

### Demo identities

- **Tunde Adeyemi** (Farmer) — phone `08012345678`
- **Adamu Bello** (Labourer, Tier 2) — phone `08055555555`
- **Agbo Foods** (Aggregator) — phone `08099999999`

Login at `http://localhost:5173/login` and pick the demo button.

---

## Project structure
apps/
api/          Express API, Prisma schema, BullMQ workers

ai/           FastAPI service, Prophet models, embeddings

web/          Vite React frontend

prisma/         Schema + migrations
docker-compose.yml
### Key endpoints

| Endpoint | Purpose |
|---|---|
| `POST /squad/webhook` | Receives Squad payment events, HMAC-verified, idempotent |
| `POST /jobs/:id/accept` | Labourer accepts a job, creates a Gig |
| `POST /deferrals/:id/approve` | Approves input credit, fires Squad transfer to supplier |
| `GET /forecasts/me/projected-balance` | 180-day Prophet forecast |
| `GET /accounts/credit-score` | 5-factor alternative credit score |
| `GET /aggregator/me/dashboard` | Aggregator portal data |
| `GET /demo/replay/projection` | Season Replay (read-only projection) |

---

## How AGRO makes money

Three revenue streams baked into the data model:

1. **Input credit fee** — 2% on every advance disbursed (`InputDeferral.agroFee`)
2. **Wage advance fee** — 10% on every wage advance to Tier 3+ labourers (`WageAdvance.fee`)
3. **Factoring spread** — 3% on aggregator advances against farmer harvests

At 10,000 farmers averaging ₦255k liberation per cycle and AGRO capturing 2.5% of throughput, projected Year 1 revenue is **₦65M**.

---

## The Liberation Counter — methodology

Every liberation event is logged with a `methodologyNote` citing its source:

- **Middleman discount avoided:** `harvest_inflow × 0.30` — based on Babban Gona field observations and CGAP smallholder reports showing 28–42% discount margins for cash-now sales.
- **Cash-on-day premium captured:** `wage_amount × 0.10` — based on SBM Intelligence (2021) study showing 40% of informal workers experienced wage delays of up to 20 months.

Full methodology with citations is published at `/methodology` (public, no auth).

---

## Built for

Squad Hackathon 3.0 — *Smart Systems: The Intelligent Economy*

**Challenge 02:** *Design an intelligent economic system powered by data and AI that connects informal traders, job seekers, and financial services in one ecosystem.*

---

## License

MIT
