# AGRO — Demo Script (5 min)

*(populated as features land. Final pass during pre-demo checklist §13.)*

## Setup

1. Run `npm run seed:demo` — resets Tunde to fresh state in <30s
2. Open the app at `https://agro.<domain>`
3. Demo login as Tunde

## Beats

1. **The problem** — show Tunde's three virtual accounts (Working / Bills / Next Season)
2. **Forecast page** — 90-day calendar, click a day → reasons drawer, point at cash gap
3. **Stress test console** — fire "Drought" → calendar morphs visibly; reset
4. **Harvest payment** — `POST /demo/simulate-payment` with ₦220k → splits fire live, deferral repays automatically, balances update in real time
5. **Liberation counter** — show running total of counterfactual loan-shark losses avoided
6. **Season replay** — click play, 60s cinematic playback of full season

## Backup

Pre-recorded video at `docs/demo-recording.mp4` — fall back if live demo fails.
