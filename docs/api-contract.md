# AGRO API Contract

Source of truth for endpoints exposed by the Node.js API at `apps/api/`. Tolu reads this to wire up the frontend.

Base URL (local): `http://localhost:3000`
Base URL (prod): `https://api.agro.<domain>`

All authenticated endpoints expect `Authorization: Bearer <jwt>` unless otherwise stated.

---

## Auth

### `POST /auth/signup`
*(filled in during §1.10)*

### `POST /auth/login`
*(filled in during §1.10)*

### `GET /auth/me`
*(filled in during §1.10)*

### `POST /auth/demo-login`
*(filled in during §1.10 — dev/demo only)*

---

## Accounts
*(filled in during §3.2)*

## Split rules
*(filled in during §3.3)*

## Deferrals
*(filled in during §3.4)*

## Factoring
*(filled in during §3.5)*

## Forecasts
*(filled in during §4.9)*

## Squad webhook
*(filled in during §2.3)*

## Demo control
*(filled in during §10.1)*
