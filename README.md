# VoltaX

A professional-grade, beginner-friendly **trading intelligence platform** for
Deriv synthetic indices: deterministic market analysis, opportunity ranking,
look-ahead-safe backtesting, paper trading, and opt-in live trading — with
transparent, explainable signals and honest statistics.

> VoltaX provides statistical, historical analysis for research and education.
> Historical reliability and backtested performance **do not guarantee future
> results**. This is not financial advice.

## Highlights
- **One deterministic engine** powers backtest, paper and live (no drift).
- **Four distinct analytical modes** kept separate, not blended: 4H/1H structure
  → 15M setup → 5M entry → 1M precision.
- **Explainable signals**: every signal carries structured reasons.
- **Statistical reliability** via a Wilson-score lower bound over real backtests —
  never "indicators agree", never overstated.
- **Look-ahead-safe backtester** with tests proving future data can't leak.
- **Conservative risk engine**: position sizing, R:R, daily/open-risk guards,
  emergency stop. No martingale.
- **Runs with zero credentials** in a clearly-labelled demo mode; wires to Deriv,
  Supabase, Telegram and an AI explainer via env when configured.

## Quick start
```bash
npm install
cp .env.example .env.local   # optional — app runs in demo mode without it
npm run dev                  # http://localhost:3000
```

### Scripts
```bash
npm run dev        # dev server
npm run build      # production build (also typechecks)
npm run start      # run the production build
npm run test       # unit + backtesting tests (Vitest)
npm run lint       # ESLint (next/core-web-vitals + strict TS)
npm run typecheck  # tsc --noEmit
```

## Tech
Next.js 14 (App Router) · TypeScript (strict) · Tailwind · Zod · Vitest ·
Supabase (Postgres + Auth + RLS) · Deriv WebSocket API.

## Documentation
See [`docs/`](docs):
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design & data flow
- [METHODOLOGY.md](docs/METHODOLOGY.md) — how signals are formed & qualified
- [TRADING_ENGINE.md](docs/TRADING_ENGINE.md) — modes, scoring, risk, state machine
- [BACKTESTING.md](docs/BACKTESTING.md) — replay & look-ahead safety
- [DERIV_INTEGRATION.md](docs/DERIV_INTEGRATION.md) — the market-data/trading layer
- [DATABASE.md](docs/DATABASE.md) — schema, RLS, migrations
- [SECURITY.md](docs/SECURITY.md) — secrets, RLS, headers, fail-safe
- [SETUP.md](docs/SETUP.md) — configuring Deriv/Supabase/Telegram/AI
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — environments & deploy

## Project rules
Permanent engineering & safety rules live in [CLAUDE.md](CLAUDE.md). The original
architectural brief is `VOLTAX — MASTER CLAUDE CODE BUILD PROMPT.md`.

## Status
Foundational build complete and verified: engine, analytics, risk, backtester,
Deriv/Supabase/notification abstractions, and the full UI. Demo mode is live;
external services activate on configuration. 45 tests passing; production build green.
