# Squad Integration Notes

## Sandbox quirks

- BVN validation is strict in sandbox — random BVNs are rejected
- Requested test BVNs from support@squadco.com — awaiting reply
- Until resolved: SQUAD_MOCK_MODE=true bypasses all Squad calls
- Webhook secret is used for HMAC-SHA512 signature verification (x-squad-signature header)
- Sandbox base URL: https://sandbox-api-d.squadco.com
- All amounts to Squad are in Naira (float); internally we store kobo (BigInt)

## Webhook events we handle

- `virtual_account_was_funded` — triggers split routing or deferral repayment
