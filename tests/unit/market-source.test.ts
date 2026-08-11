import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the live source to throw, proving the unified accessor falls back to demo
// (spec §39 fail-safe: the UI must always render).
vi.mock('@/lib/deriv/live', () => ({
  getLiveMarketView: vi.fn(async () => {
    throw new Error('deriv unreachable');
  }),
  getLiveDetail: vi.fn(async () => {
    throw new Error('deriv unreachable');
  }),
  getLivePerformance: vi.fn(async () => {
    throw new Error('deriv unreachable');
  }),
}));

describe('unified data source fallback', () => {
  beforeEach(() => {
    process.env.VOLTAX_DATA_SOURCE = 'live'; // force live attempt
  });

  it('falls back to demo when the live source fails', async () => {
    const { getMarketView } = await import('@/lib/market/source');
    const view = await getMarketView();
    expect(view.source).toBe('demo');
    expect(view.evaluations.length).toBeGreaterThan(0);
  });

  it('falls back to demo detail when live detail fails', async () => {
    const { getMarketDetail } = await import('@/lib/market/source');
    const detail = await getMarketDetail('R_75');
    expect(detail?.source).toBe('demo');
    expect(detail?.evaluation.instrumentSymbol).toBe('R_75');
  });

  it('demo mode preference skips live entirely', async () => {
    process.env.VOLTAX_DATA_SOURCE = 'demo';
    const { getMarketView, getPerformance } = await import('@/lib/market/source');
    expect((await getMarketView()).source).toBe('demo');
    expect((await getPerformance()).source).toBe('demo');
  });
});
