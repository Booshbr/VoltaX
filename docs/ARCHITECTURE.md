# Architecture

VoltaX is layered so data ingestion, analysis, signal generation, notification and
execution have clear boundaries (spec §59). The same strategy engine serves
backtest, paper and live (spec §62).

```
Deriv WS / demo generator      ← data source (swappable)
        │
   lib/market-data             ← candles: aggregate, validate, gap/dup, freshness
        │
   lib/analytics               ← features & modes
     ├ swings, volatility, zones
     ├ structure (4H/1H)  → MarketStructureAnalysis
     ├ setup (15M)        → SetupAnalysis
     ├ entry (5M)         → EntryAnalysis
     └ precision (1M)     → PrecisionAnalysis
        │
   lib/signals/engine          ← composes modes → risk → statistics → Signal
     ├ reliability (Wilson)    ← from lib/backtesting samples
     ├ scoring (opportunity)
     └ state-machine (lifecycle, immutable events)
        │
   ┌────┼───────────────┐
   ▼    ▼               ▼
 backtest  paper-trade  live-trade (opt-in, multi-gated)
        │
   persistence (Supabase) · notifications (in-app/browser/Telegram) · AI explain
```

## Directory layout
- `app/(app)/*` — App Router pages (dashboard, radar, signals, …). Server
  components read data; small client components handle interactivity/theme.
- `components/*` — presentational + domain UI (cards, badges, chart, shell).
- `lib/types` — the domain model; the contract every layer shares.
- `lib/config` — versioned `StrategyConfig`, scoring weights, family profiles.
- `lib/market-data` — `candles.ts` (aggregation/validation), `quality.ts` (freshness).
- `lib/analytics` — deterministic feature/mode analyzers, each unit-tested.
- `lib/signals` — `engine.ts`, `reliability.ts`, `scoring.ts`, `state-machine.ts`.
- `lib/trading` — `risk.ts` (sizing + guards).
- `lib/backtesting` — `backtest.ts` (event-driven, look-ahead-safe).
- `lib/deriv` — server-only Deriv integration (config/client/mappers/types).
- `lib/supabase` — browser/server clients + env helpers.
- `lib/notifications` — provider abstraction + dispatcher.
- `lib/demo` — labelled synthetic data feeding the real engine for exploration.
- `supabase/migrations` — SQL schema, RLS, indexes.
- `tests/` — unit + backtesting tests.

## Key design choices
- **Modes stay separate.** Each timeframe produces its own typed analysis; the
  engine composes them with explicit gates rather than a single opaque score.
- **Determinism.** Analyzers are pure functions of their candle inputs, enabling
  reproducibility and the look-ahead guarantee.
- **Reliability is measured, not asserted.** The backtester produces the sample;
  reliability is a conservative estimate from it.
- **Swappable data source.** The engine consumes `Partial<Record<Timeframe,
  Candle[]>>`; demo and Deriv both satisfy this, so nothing downstream changes.
- **Extensibility.** New families = a profile entry; new notification channels =
  a provider; multi-user = already modelled via `user_id` + RLS.
