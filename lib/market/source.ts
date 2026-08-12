/**
 * Unified market-data accessor (spec §39 fail-safe). Chooses the LIVE Deriv source
 * when available and falls back to the labelled DEMO source on any error or
 * timeout, so the UI always renders. Both sources return the same MarketView shape.
 *
 * Data source resolution:
 *   VOLTAX_DATA_SOURCE=demo  → always demo
 *   VOLTAX_DATA_SOURCE=live  → live (falls back to demo on failure)
 *   unset                    → live when Deriv is configured, else demo
 */
import { getDerivConfig } from '@/lib/deriv/config';
import { getLiveMarketView, getLiveDetail, getLivePerformance, getLiveDataQuality } from '@/lib/deriv/live';
import { getDemoMarketView, getDemoDetail, getDemoPerformance } from '@/lib/demo/dataset';
import {
  summarize,
  type DataQualityReport,
  type InstrumentQuality,
  type MarketDetail,
  type MarketView,
} from './types';

export interface PerformanceRow {
  symbol: string;
  family: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  expectancyR: number;
}

export interface Performance {
  source: 'live' | 'demo';
  rows: PerformanceRow[];
  totals: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number | null;
    expectancyR: number;
    profitFactor: number | null;
  };
}

const LIVE_TIMEOUT_MS = 15_000;

function liveEnabled(): boolean {
  const pref = process.env.VOLTAX_DATA_SOURCE;
  if (pref === 'demo') return false;
  if (pref === 'live') return true;
  return getDerivConfig().configured;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('live data timeout')), ms)),
  ]);
}

function demoView(): MarketView {
  const v = getDemoMarketView();
  return {
    source: 'demo',
    generatedAt: v.generatedAt,
    feed: v.feed,
    evaluations: v.evaluations,
    summary: summarize(v.evaluations),
    accountEquity: v.accountEquity,
  };
}

let lastSource: 'live' | 'demo' = 'demo';

export function getLastSource(): 'live' | 'demo' {
  return lastSource;
}

export async function getMarketView(): Promise<MarketView> {
  if (liveEnabled()) {
    try {
      const view = await withTimeout(getLiveMarketView(), LIVE_TIMEOUT_MS);
      if (view.evaluations.length > 0) {
        lastSource = 'live';
        return view;
      }
    } catch {
      // fall through to demo
    }
  }
  lastSource = 'demo';
  return demoView();
}

export async function getMarketDetail(symbol: string): Promise<MarketDetail | undefined> {
  if (liveEnabled()) {
    try {
      const detail = await withTimeout(getLiveDetail(symbol), LIVE_TIMEOUT_MS);
      if (detail) {
        lastSource = 'live';
        return detail;
      }
    } catch {
      // fall through to demo
    }
  }
  const demo = getDemoDetail(symbol);
  if (!demo) return undefined;
  lastSource = 'demo';
  return { source: 'demo', ...demo };
}

export async function getDataQuality(): Promise<DataQualityReport> {
  const view = await getMarketView();
  if (view.source === 'live') {
    try {
      const instruments = await withTimeout(getLiveDataQuality(), LIVE_TIMEOUT_MS);
      return { source: 'live', overall: view.feed, instruments, generatedAt: new Date().toISOString() };
    } catch {
      // fall through to demo-style report
    }
  }
  // Demo data is synthetic and internally consistent (no gaps), anchored to a
  // fixed generation time — report it as clean, matching the demo feed.
  const instruments: InstrumentQuality[] = view.evaluations.map((e) => ({
    symbol: e.instrumentSymbol,
    quality: 'healthy',
    lastUpdateMs: view.feed.lastUpdateMs,
    timeframe: '1m',
    candleCount: 0,
    gaps: 0,
    issues: [],
  }));
  return { source: 'demo', overall: view.feed, instruments, generatedAt: new Date().toISOString() };
}

export async function getPerformance(): Promise<Performance> {
  if (liveEnabled()) {
    try {
      const perf = await withTimeout(getLivePerformance(), LIVE_TIMEOUT_MS);
      if (perf.rows.length > 0) {
        lastSource = 'live';
        return { source: 'live', ...perf };
      }
    } catch {
      // fall through to demo
    }
  }
  lastSource = 'demo';
  const demo = getDemoPerformance();
  return { source: 'demo', ...demo };
}
