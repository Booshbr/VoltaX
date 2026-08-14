import { describe, it, expect } from 'vitest';
import { resolveOutcome, aggregateOutcomes, type OpenSignal, type OutcomeRecord } from '@/lib/trading/outcomes';
import type { Candle } from '@/lib/types';

function candle(time: number, low: number, high: number, close = (low + high) / 2): Candle {
  return { time, open: (low + high) / 2, high, low, close };
}

const longSignal: OpenSignal = { direction: 'long', entry: 100, stopLoss: 95, takeProfit: 110, createdAtSec: 1000 };

describe('resolveOutcome', () => {
  it('only evaluates candles strictly after the decision time', () => {
    // A candle AT the decision time that would hit the target must be ignored.
    const res = resolveOutcome(longSignal, [candle(1000, 90, 115)]);
    expect(res.status).toBe('pending');
  });

  it('records a win when a later candle reaches the target', () => {
    const res = resolveOutcome(longSignal, [candle(1060, 99, 101), candle(1120, 105, 111)]);
    expect(res.status).toBe('win');
    expect(res.price).toBe(110);
    expect(res.resolvedAtSec).toBe(1120);
    expect(res.barsToResolve).toBe(2);
  });

  it('records a loss when the stop is hit', () => {
    const res = resolveOutcome(longSignal, [candle(1060, 94, 101)]);
    expect(res.status).toBe('loss');
    expect(res.price).toBe(95);
  });

  it('counts the stop when a single bar straddles both stop and target', () => {
    const res = resolveOutcome(longSignal, [candle(1060, 94, 111)]);
    expect(res.status).toBe('loss');
  });

  it('inverts stop/target for shorts', () => {
    const short: OpenSignal = { direction: 'short', entry: 100, stopLoss: 105, takeProfit: 90, createdAtSec: 1000 };
    expect(resolveOutcome(short, [candle(1060, 88, 99)]).status).toBe('win');
    expect(resolveOutcome(short, [candle(1060, 101, 106)]).status).toBe('loss');
  });

  it('expires only once the horizon has elapsed', () => {
    const near = resolveOutcome(longSignal, [candle(1100, 99, 101)], { maxHorizonSec: 3600 });
    expect(near.status).toBe('pending');
    const far = resolveOutcome(longSignal, [candle(1100, 99, 101), candle(5000, 99, 101)], { maxHorizonSec: 3600 });
    expect(far.status).toBe('expired');
    expect(far.resolvedAtSec).toBe(5000);
  });

  it('resolves regardless of candle input order', () => {
    const res = resolveOutcome(longSignal, [candle(1120, 105, 111), candle(1060, 99, 101)]);
    expect(res.status).toBe('win');
    expect(res.barsToResolve).toBe(2);
  });
});

describe('aggregateOutcomes', () => {
  const rec = (status: OutcomeRecord['status'], family = 'volatility'): OutcomeRecord & { status: typeof status } => ({
    status,
    family,
    entry: 100,
    stopLoss: 95,
    takeProfit: 110, // reward:risk = 10/5 = 2R on a win
  });

  it('excludes pending and expired from win rate but counts expired as resolved', () => {
    const stats = aggregateOutcomes([rec('win'), rec('win'), rec('loss'), rec('expired'), rec('pending')]);
    expect(stats.total).toBe(5);
    expect(stats.pending).toBe(1);
    expect(stats.decided).toBe(3); // 2 win + 1 loss
    expect(stats.winRate).toBeCloseTo(2 / 3, 5);
  });

  it('computes expectancy as mean realised R over decided + expired', () => {
    // 2 wins (+2R each) + 1 loss (-1R) + 1 expired (0R) = 3 over 4 = 0.75R
    const stats = aggregateOutcomes([rec('win'), rec('win'), rec('loss'), rec('expired')]);
    expect(stats.expectancyR).toBeCloseTo(0.75, 5);
  });

  it('applies the Wilson lower bound conservatively below the raw rate', () => {
    const stats = aggregateOutcomes([rec('win'), rec('win'), rec('win'), rec('loss')]);
    expect(stats.winRate).toBeCloseTo(0.75, 5);
    expect(stats.wilsonLower).not.toBeNull();
    expect(stats.wilsonLower!).toBeLessThan(0.75);
  });

  it('splits stats per family', () => {
    const stats = aggregateOutcomes([rec('win', 'volatility'), rec('loss', 'boom'), rec('win', 'boom')]);
    const boom = stats.families.find((f) => f.family === 'boom');
    expect(boom?.decided).toBe(2);
    expect(boom?.wins).toBe(1);
  });

  it('returns null rates when nothing is decided', () => {
    const stats = aggregateOutcomes([rec('pending'), rec('expired')]);
    expect(stats.winRate).toBeNull();
    expect(stats.wilsonLower).toBeNull();
  });
});
