# AGRO — Architecture

## High-level

Three services talking over HTTP and Redis queues:

[Web (React)] ←→ [API (Node.js/Express)] ←→ [AI (Python/FastAPI)]
↓
[Postgres] [Redis + BullMQ]
↓
[Squad sandbox API]
[Africa's Talking SMS]

## Money movement

Every farmer gets three Squad virtual accounts:

- Working — landing zone for harvest payments; routes splits outbound
- Bills — accumulated for school fees, hospital, household
- Next Season — locked savings for inputs and replanting

Harvest payments arrive at Working → webhook fires → BullMQ job splits funds into Bills + Next Season per the farmer's split rule (default 60/25/15).

## Deferrals

Farmer requests inputs from a partner supplier. Agro pays supplier upfront via Squad transfer. A direct debit mandate is set up on the farmer's Working account. When the next large harvest credit lands, the mandate auto-charges to repay.

## Factoring

Aggregator delivers crops to a buyer; buyer pays in 30–60 days. Agro advances ~80% of the delivery value to the farmer immediately via Squad transfer, then collects from the aggregator when the buyer settles.

## AI forecast

Python service uses cohort baselines (Prophet) trained on synthetic + later real data per crop type. Personalizes when ≥30 days of farmer transactions exist. Returns a 90-day forward calendar of expected events with confidence intervals and plain-language reasons.

## More detail

- API contract: ./api-contract.md
- Demo script: ./demo-script.md
