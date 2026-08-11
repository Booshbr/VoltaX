# Methodology (VOLTAX-METHOD-1.0.0)

VoltaX uses one standardized, deterministic methodology (spec §5). It is a
structured decision engine, not a bag of indicators. Signals are rejected when
mandatory conditions are not met — "no trade" is a valid, common result (spec §60).

## Timeframe hierarchy (spec §3)
- **4H / 1H — Market structure.** Trend, regime, swing points, BOS/CHOCH, zones,
  volatility, directional bias, invalidation.
- **15M — Setup.** Actionable pattern (pullback into a valid zone) aligned with the
  higher-timeframe bias. Never overrides HTF context on its own.
- **5M — Entry confirmation.** Local structure + momentum agree with the setup.
- **1M — Precision.** Refines entry/stop; a refinement, not a trade generator.

## Decision pipeline (spec §5)
```
data freshness → HTF structure (4H+1H aligned) → 15M setup qualified
→ 5M entry confirmed → 1M precision (refine) → risk validation
→ statistical qualification → SIGNAL   (else: no trade)
```

### Mandatory gates
1. Feed fresh (else no new signals, spec §39).
2. 4H and 1H bias aligned and non-neutral.
3. 15M setup status = `qualified`.
4. 5M entry confirmed.
5. Risk not rejected; geometry valid; R:R ≥ minimum.
6. Reliability ≥ minimum; opportunity score ≥ minimum.

Precision (1M) refines entry/stop when it triggers but is **not** a hard gate — it
must never manufacture a trade from noise.

## Structure detection
- **Swings**: confirmed fractal pivots (needs bars either side ⇒ causal).
- **BOS/CHOCH**: a candle close beyond the most recent unbroken swing; BOS if it
  continues the trend, CHOCH if it breaks against it.
- **Trend**: HH+HL (bullish) / LH+LL (bearish). When structure is inconclusive
  (e.g. a clean monotonic trend with no fractal pivots) a slope tiebreaker,
  normalised by ATR, provides the bias.

## Reliability (spec §14)
`reliabilityScore` is the **Wilson score lower bound** (≈95%) of the historical
TP1-hit rate, blended toward the point estimate, from a look-ahead-safe backtest.
Small samples shrink toward a neutral prior and are flagged provisional. At the
~2:1 R:R the engine targets, breakeven is a ~33% hit rate, so a conservative
score around the mid-40s already implies solidly positive expectancy. Thresholds
are configurable, versioned, and meant to be validated — never asserted as optimal.

## Opportunity score (spec §13)
A 0–100 ranking from weighted components: structure, setup, entry, reliability,
risk/reward, and market-condition compatibility. It ranks opportunities; it is
**not** a probability of profit.

## What AI does / does not do (spec §33)
AI explains an already-made algorithmic decision from validated structured data.
It never invents levels, statistics, reasons or outcomes, and never changes engine
numbers. AI failures never affect signal generation.

## Disclaimer
Statistical reliability and backtested performance are not a guarantee of future
performance. Trading synthetic indices carries risk of loss.
