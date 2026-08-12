import { describe, it, expect } from 'vitest';
import { researchAnalogs } from '@/lib/research/patterns';
import type { Candle } from '@/lib/types';

function fromCloses(closes: number[]): Candle[] {
  return closes.map((c, i) => ({ time: i * 900, open: c, high: c + 1, low: c - 1, close: c }));
}

describe('researchAnalogs', () => {
  it('returns null stats when there is not enough history', () => {
    const res = researchAnalogs(fromCloses([1, 2, 3, 4, 5]), { window: 20, forward: 10 });
    expect(res.stats).toBeNull();
    expect(res.analogs).toHaveLength(0);
  });

  it('finds analogs and summarises forward outcomes', () => {
    // Build a long series with a recurring rise-then-fall motif.
    const closes: number[] = [];
    for (let cycle = 0; cycle < 12; cycle++) {
      for (let i = 0; i < 12; i++) closes.push(100 + 10 * Math.sin((i / 12) * Math.PI * 2) + cycle * 0.5);
    }
    const res = researchAnalogs(fromCloses(closes), { window: 8, forward: 6, k: 5 });
    expect(res.stats).not.toBeNull();
    expect(res.analogs.length).toBeGreaterThan(0);
    expect(res.analogs.length).toBeLessThanOrEqual(5);
    // Similarity is a 0..1 score, sorted descending.
    for (const a of res.analogs) {
      expect(a.similarity).toBeGreaterThan(0);
      expect(a.similarity).toBeLessThanOrEqual(1);
      expect(['up', 'down', 'flat']).toContain(a.direction);
    }
    for (let i = 1; i < res.analogs.length; i++) {
      expect(res.analogs[i - 1]!.similarity).toBeGreaterThanOrEqual(res.analogs[i]!.similarity);
    }
    expect(res.stats!.pctUp).toBeGreaterThanOrEqual(0);
    expect(res.stats!.pctUp).toBeLessThanOrEqual(1);
  });

  it('analog windows never overlap the current window (no look-ahead)', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i);
    const window = 10;
    const forward = 5;
    const res = researchAnalogs(fromCloses(closes), { window, forward, k: 20 });
    const currentStart = closes.length - window;
    // Every analog must end (and its forward outcome must land) before the current window starts.
    for (const a of res.analogs) {
      expect(a.index + forward).toBeLessThan(currentStart);
    }
  });

  it('is deterministic', () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const a = researchAnalogs(fromCloses(closes), { window: 10, forward: 5 });
    const b = researchAnalogs(fromCloses(closes), { window: 10, forward: 5 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
