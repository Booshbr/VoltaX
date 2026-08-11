# Backtesting

`lib/backtesting/backtest.ts` replays history bar-by-bar through the **same**
`evaluate()` used live (spec §62). This guarantees backtest and live can't drift.

## Look-ahead safety (spec §15)
At each decision time `ts`, the backtester exposes only candles whose **close time
is at or before `ts`** (`time + timeframeSize ≤ ts`). Analyzers are pure functions
of their inputs, so a decision computed at `ts` is provably independent of any
future candle. Tests in `tests/backtesting/lookahead.test.ts` assert this by
mutating future bars and confirming a past decision is unchanged.

Additional guards:
- Candle aggregation drops incomplete trailing buckets (no partial candles).
- Swings are only confirmed once the required bars exist on both sides.

## Trade simulation
On a qualified signal the backtester opens a trade at the signal entry and walks
forward to the first stop/TP touch. Within a bar the **adverse level is checked
first** (conservative). Trades that never resolve within available data are not
counted. After a trade closes, scanning resumes past the exit to avoid overlap.

## Bootstrapping reliability
The backtester **measures** the mechanical setup, so it runs with the statistical
gates (reliability/opportunity thresholds) disabled — otherwise reliability would
depend on itself and never bootstrap. All structural and risk gates remain active.
The resulting win/loss sample feeds `computeReliability`, which live `evaluate()`
then applies against the real thresholds.

## Outputs — `BacktestResult`
`trades`, `wins`, `losses`, `winRate`, `expectancyR` (mean R multiple), and
`evaluatedBars`. Determinism is tested.

## Where it surfaces
- Per-instrument runs on **Backtesting** and the **signal detail** page.
- Aggregated portfolio metrics on **Performance** (win rate, expectancy, profit
  factor). Reliability shown on signals is derived from these runs, not asserted.
