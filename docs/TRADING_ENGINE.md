# Trading engine

## Strategy engine — `lib/signals/engine.ts`
`evaluate(input)` takes an instrument, per-timeframe candles, account equity, feed
status, optional historical sample, and a `StrategyConfig`; it returns an
`EngineEvaluation` that is **always fully populated** (so the radar can rank every
instrument) and includes a `Signal` only when qualified.

The engine is the single decision core for backtest, paper and live (spec §62).
It is deterministic: identical input ⇒ identical output (tested).

## Analytical modes
| Mode | TF | Function | Output |
|---|---|---|---|
| A Structure | 4H/1H | `analyzeStructure` | trend, regime, BOS/CHOCH, zones, invalidation |
| B Setup | 15M | `analyzeSetup` | status, zone, confluence, quality |
| C Entry | 5M | `analyzeEntry` | confirmation, momentum, quality |
| D Precision | 1M | `analyzePrecision` | trigger, refined entry/stop |

## Scoring — `lib/signals/scoring.ts`
`opportunityScore(components, weights)` → 0–100. Weights live in `StrategyConfig`
and must sum to 1 (asserted at runtime). `riskRewardQuality` soft-caps R:R around
a 3:1 target.

## Reliability — `lib/signals/reliability.ts`
`computeReliability({wins, losses})` → `{ score, sampleSize, winRate, sufficient }`
using the Wilson lower bound. Empty sample ⇒ neutral prior (50), insufficient.

## Risk engine — `lib/trading/risk.ts`
`calculatePosition(input, riskConfig, guard?)`:
- Validates directional geometry (stop/TP on correct sides).
- `riskAmount = equity × perTradeRisk`; `size = riskAmount / (stopDistance ×
  valuePerPricePerUnit)`, clamped to instrument min/max.
- Rejects on bad geometry, sub-minimum size, emergency stop, consecutive-loss
  limit, or daily/open-risk limits. Rejection ⇒ **no trade** (fail safe).

> Deriv contract semantics are not conventional spot sizing. `valuePerPricePerUnit`
> must be validated against the live contract spec before real trading (spec §19).

## Signal lifecycle — `lib/signals/state-machine.ts`
States: `scanning → developing → qualified → active → tp1 → tp2 → completed`, plus
`invalidated / stopped / expired / cancelled`. Transitions are validated; each
emits an **immutable `SignalEvent`**. History is never overwritten (spec §12).

## Configuration — `lib/config/strategy.ts`
`StrategyConfig` holds thresholds, scoring weights and the risk framework, tagged
with `METHODOLOGY_VERSION`. Change logic ⇒ bump the version so historical signals
stay associated with the methodology that produced them.
