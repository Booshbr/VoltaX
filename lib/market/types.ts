/** Shared market-view shape produced by both the live and demo data sources, so
 * the UI is agnostic to where candles come from (spec §62 parity). */
import type { Candle, DataQuality, DataQualityStatus, Timeframe } from '@/lib/types';
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { BacktestResult } from '@/lib/backtesting/backtest';
import type { ResearchResult } from '@/lib/research/patterns';

export interface InstrumentQuality {
  symbol: string;
  quality: DataQuality;
  lastUpdateMs: number;
  timeframe: Timeframe;
  candleCount: number;
  gaps: number;
  issues: string[];
}

export interface DataQualityReport {
  source: DataSource;
  overall: DataQualityStatus;
  instruments: InstrumentQuality[];
  generatedAt: string;
}

export type DataSource = 'live' | 'demo';

export interface MarketSummary {
  scanned: number;
  bullish: number;
  bearish: number;
  neutral: number;
  qualified: number;
  developing: number;
}

export interface MarketView {
  source: DataSource;
  generatedAt: string;
  feed: DataQualityStatus;
  evaluations: EngineEvaluation[];
  summary: MarketSummary;
  accountEquity: number;
}

export interface MarketDetail {
  source: DataSource;
  evaluation: EngineEvaluation;
  backtest: BacktestResult;
  recentCandles: Candle[];
  timeframe: Timeframe;
  /** Historical-pattern research over this instrument's own history (spec §16). */
  research: ResearchResult;
}

export function summarize(evaluations: EngineEvaluation[]): MarketSummary {
  return {
    scanned: evaluations.length,
    bullish: evaluations.filter((e) => e.htf.bias === 'bullish').length,
    bearish: evaluations.filter((e) => e.htf.bias === 'bearish').length,
    neutral: evaluations.filter((e) => e.htf.bias === 'neutral').length,
    qualified: evaluations.filter((e) => e.qualified).length,
    developing: evaluations.filter((e) => e.status === 'developing').length,
  };
}

export type { BacktestResult };
