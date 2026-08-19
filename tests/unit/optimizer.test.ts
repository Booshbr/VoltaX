import { describe, it, expect } from 'vitest';
import { pickRecommendation, statsFor, type CandidateResult } from '@/lib/backtesting/optimizer';
import type { BacktestTrade } from '@/lib/backtesting/backtest';

function trade(result: 'win' | 'loss', rMultiple: number): BacktestTrade {
  return { direction: 'long', entryTime: 0, entryPrice: 1, stopLoss: 0.5, takeProfit: 2, exitTime: 1, exitPrice: 2, result, rMultiple };
}

function window(wins: number, losses: number, r: number) {
  const trades = [...Array(wins).fill(trade('win', r)), ...Array(losses).fill(trade('loss', -1))];
  return statsFor(trades);
}

function candidate(rr: number, inS: ReturnType<typeof window>, outS: ReturnType<typeof window>): CandidateResult {
  return { minimumRiskReward: rr, inSample: inS, outOfSample: outS };
}

const baseline = candidate(2.0, window(20, 20, 2), window(20, 20, 2)); // ~+0.5R both windows

describe('statsFor', () => {
  it('computes win rate and expectancy', () => {
    const s = statsFor([trade('win', 2), trade('win', 2), trade('loss', -1)]);
    expect(s.trades).toBe(3);
    expect(s.winRate).toBeCloseTo(2 / 3, 5);
    expect(s.expectancyR).toBeCloseTo((2 + 2 - 1) / 3, 5);
  });
});

describe('pickRecommendation — walk-forward guard', () => {
  it('recommends a candidate that beats baseline both in- and out-of-sample', () => {
    const better = candidate(2.4, window(30, 15, 2.5), window(30, 15, 2.5)); // strong both windows
    expect(pickRecommendation(baseline, [baseline, better], 20)).toBe(better);
  });

  it('does NOT recommend a candidate that wins in-sample but fails out-of-sample (overfit)', () => {
    const overfit = candidate(2.4, window(40, 5, 3), window(5, 25, 3)); // great IS, awful OOS
    expect(pickRecommendation(baseline, [baseline, overfit], 20)).toBeNull();
  });

  it('does NOT recommend when the best is the baseline itself', () => {
    const worse = candidate(1.6, window(10, 30, 1.6), window(10, 30, 1.6));
    expect(pickRecommendation(baseline, [baseline, worse], 20)).toBeNull();
  });

  it('ignores candidates with too few in-sample trades', () => {
    const thin = candidate(2.4, window(3, 0, 3), window(3, 0, 3)); // tiny sample, huge expectancy
    expect(pickRecommendation(baseline, [baseline, thin], 20)).toBeNull();
  });

  it('requires enough out-of-sample trades to trust generalisation', () => {
    const thinOos = candidate(2.4, window(30, 10, 2.5), window(5, 2, 2.5)); // strong IS, tiny OOS
    expect(pickRecommendation(baseline, [baseline, thinOos], 20)).toBeNull();
  });
});
