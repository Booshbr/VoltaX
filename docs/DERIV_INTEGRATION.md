# Deriv integration

A single server-side surface (`lib/deriv`) owns all Deriv access (spec §8). No
Deriv calls are scattered elsewhere.

## Files
- `config.ts` — reads/validates env (`DERIV_APP_ID`, `DERIV_WS_URL`,
  `DERIV_API_TOKEN`). Never throws; returns a structured result so callers degrade
  safely. `redactToken` for safe logging. **Server-only** (guards `window`).
- `types.ts` — minimal Deriv wire types (`active_symbols`, `ticks_history`
  candles, `authorize`) + granularity map.
- `mappers.ts` — pure functions: `toInstruments` (filters to synthetic indices),
  `toCandles`. Unit-tested.
- `client.ts` — `DerivClient` over the Node global `WebSocket` (Node 22+):
  connection lifecycle, `req_id` correlation, timeouts, `getInstruments()`,
  `getCandles()`. `getDerivClient()` throws `DerivNotConfiguredError` when unset;
  `derivHealth()` is a status probe for System Health.

## Security (spec §41)
- The API token is **server-side only** and never exposed to the browser.
- Nothing here is `NEXT_PUBLIC_`. Full tokens are never logged.
- Trading methods require an account token **and** explicit enablement (spec §18).

## Data normalisation
Fetched candles pass through `validCandles` + `dedupeAndSort` before analysis, so
malformed/duplicate/misordered candles never reach the engine (spec §40).

## Dynamic instrument discovery (spec §7)
Instruments come from `active_symbols`; families are classified from provider
metadata (with a heuristic fallback). The universe is discovered, not hard-coded.

## Not yet wired (configuration required)
Live tick streaming/subscription management and order execution are defined by the
abstraction and gated behind configuration + safety checks. Configure a token and
implement the execution call against the current contract spec before live use —
verify semantics against official Deriv docs (spec §75).
