/**
 * Squad NIP bank codes — the 6-digit codes Squad's /payout/transfer expects.
 * Source: docs.squadco.com Transfer API reference.
 *
 * NOTE: These are NIP codes, NOT CBN sort codes. CBN sort code for GTBank
 * is 058, but Squad's /payout/transfer rejects it. The NIP code 000013 is
 * what works for live transfers.
 */
export const BANK_CODES = {
  GTBANK:    '000013',
  ACCESS:    '000014',
  ZENITH:    '000015',
  FIRSTBANK: '000016',
  UBA:       '000004',
  STERLING:  '000001',
} as const;

/**
 * AGRO's internal accounts (Working/Bills/NextSeason/LABOUR_SAVINGS) all
 * settle to the same GTBank merchant account in production. The bank code
 * here is the destination NIP code for OUTBOUND transfers — for INTERNAL
 * allocations between AGRO-owned VAs, no Squad transfer is needed.
 */
export const AGRO_DEFAULT_BANK_CODE = BANK_CODES.GTBANK;
