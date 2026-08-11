# CLAUDE.md — VoltaX permanent project rules

VoltaX is a trading-intelligence platform for Deriv synthetic indices: analysis,
market ranking, backtesting, paper trading, and opt-in live trading. These rules
are permanent and take precedence in every coding session. The original build
spec lives in `VOLTAX — MASTER CLAUDE CODE BUILD PROMPT.md`.

## Non-negotiable principles
1. **Algorithm first, AI second.** The methodology is deterministic and testable.
   AI only *explains* decisions the engine already made — it never generates
   BUY/SELL signals, invents price levels/statistics, or alters engine numbers.
2. **No guaranteed-profit language.** Never claim guaranteed profit/win rate or
   risk-free trades. Use "historical reliability", "statistical confidence",
   "backtested performance". Always surface the disclaimer where stats appear.
3. **Signals are explainable.** Every signal carries structured, human-readable
   reasons derived from data — never hallucinated.
4. **Fail safe.** On any uncertainty, do the safest thing. Stale feed ⇒ no new
   signals. Failed risk/safety check ⇒ no trade.
5. **One engine.** Backtest, paper and live all run through `lib/signals/engine.ts`.
   Never fork the strategy logic — divergence is a bug.
6. **No look-ahead.** Historical evaluation must only use candles at/before the
   decision time. There are tests for this; keep them passing.
7. **Secrets are server-side.** The Deriv token and Supabase service-role key
   never reach the browser. Never log full tokens. Nothing secret is `NEXT_PUBLIC_`.
8. **Honesty over polish.** Never fake data, statistics, charts or connections.
   If a service isn't configured, build the abstraction + config path + safe
   fallback and label it clearly (demo / configuration required).
9. **Methodology is versioned.** Every signal references its methodology version
   (`METHODOLOGY_VERSION`). Bump it when decision logic changes; keep history.
10. **Risk defaults are conservative.** No martingale, no auto position-doubling,
    no increasing risk after losses. Higher-risk features are opt-in + labeled.

## Architecture map
- `lib/types` — domain model (market, analysis modes, signal, risk).
- `lib/config` — versioned `StrategyConfig` + index-family profiles.
- `lib/market-data` — candle aggregation, gap/dup detection, data-quality.
- `lib/analytics` — swings, volatility/ATR, structure (BOS/CHOCH), zones,
  setup(15M), entry(5M), precision(1M). Deterministic + unit-tested.
- `lib/signals` — reliability (Wilson), scoring, state machine, and the engine.
- `lib/trading` — risk engine & position sizing + guards.
- `lib/backtesting` — event-driven, look-ahead-safe replay of the engine.
- `lib/deriv` — server-only Deriv WS integration (single surface, safe fallback).
- `lib/supabase` — browser/server clients; schema in `supabase/migrations`.
- `lib/notifications` — provider abstraction (in-app/browser/Telegram).
- `lib/ai` — explanation service: deterministic templater (always) + Claude
  provider (on-demand, `AI_API_KEY`). Explains decisions from verified facts only.
- `lib/trading/paper.ts` — paper-trading domain (open/mark/resolve/close, P/L).
- `lib/demo` — labelled synthetic data → real engine/backtest output for the UI.
- `app/(app)` — dashboard, radar, signals(+detail), markets, performance,
  backtesting, methodology, system-health, settings, live/paper/history/alerts.

## Working rules
- Strict TypeScript; avoid `any`. Small files/functions; separation of concerns.
- After changes run: `npm run test`, `npm run lint`, `npm run build`. Fix failures.
- Add/keep unit tests for analytics, risk, scoring, state machine, and look-ahead.
- Don't hard-code strategy parameters — put them in `StrategyConfig`.
- Deriv/Supabase/Next behaviour: check current official docs, don't assume.

## Current state (demo)
Runs without any credentials using `lib/demo`. Configure `.env.local` from
`.env.example` to enable live Deriv data, Supabase persistence/auth, Telegram and
AI. Live trading additionally requires explicit user enablement.
