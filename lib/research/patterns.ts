/**
 * Historical-pattern research (spec §16, §63). A deterministic nearest-neighbour
 * analog search: describe the recent price SHAPE as a normalised feature vector,
 * find the most similar past windows, and report what happened AFTER each one.
 *
 * This is a RESEARCH tool, never a prediction engine. Output is framed as
 * "historically similar conditions produced X outcomes across N observations",
 * with the sample size and full distribution always shown (spec §16).
 */
import type { Candle } from '@/lib/types';

export interface Analog {
  /** Index in the source series where the analog window ends. */
  index: number;
  time: number;
  /** 0..1 similarity to the current window (1 = identical shape). */
  similarity: number;
  /** Forward return over `forward` bars after the analog window, as a fraction. */
  forwardReturn: number;
  direction: 'up' | 'down' | 'flat';
}

export interface ResearchResult {
  window: number;
  forward: number;
  analogs: Analog[];
  stats: {
    sampleSize: number;
    /** Fraction of analogs whose forward move was up. */
    pctUp: number;
    /** Mean / median forward return across analogs. */
    avgForwardReturn: number;
    medianForwardReturn: number;
    bestForwardReturn: number;
    worstForwardReturn: number;
    /** Average similarity of the selected analogs. */
    avgSimilarity: number;
  } | null;
}

export interface ResearchOptions {
  /** Bars in the comparison window (recent shape). */
  window?: number;
  /** Bars to look forward for the outcome. */
  forward?: number;
  /** Number of nearest analogs to keep. */
  k?: number;
  /** |return| below this is classified 'flat'. */
  flatThreshold?: number;
}

/** z-scored log returns of the `window` bars ending at index `end` (inclusive). */
function shapeVector(candles: Candle[], end: number, window: number): number[] | null {
  const start = end - window + 1;
  if (start < 1) return null;
  const rets: number[] = [];
  for (let i = start; i <= end; i++) {
    const prev = candles[i - 1]!.close;
    const cur = candles[i]!.close;
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
    else rets.push(0);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const std = Math.sqrt(variance) || 1;
  return rets.map((r) => (r - mean) / std);
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(sum);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Find analogs to the CURRENT window (the most recent `window` bars) among past,
 * non-overlapping windows, and summarise their forward outcomes.
 */
export function researchAnalogs(candles: Candle[], options: ResearchOptions = {}): ResearchResult {
  const window = options.window ?? 20;
  const forward = options.forward ?? 10;
  const k = options.k ?? 8;
  const flat = options.flatThreshold ?? 0.001;

  const end = candles.length - 1;
  const current = shapeVector(candles, end, window);
  const base: ResearchResult = { window, forward, analogs: [], stats: null };
  if (!current) return base;

  // Candidate windows end at j and must (a) have full data, (b) have a forward
  // outcome, and (c) not overlap the current window.
  const candidates: Analog[] = [];
  const lastCandidateEnd = end - window - forward; // no overlap + forward exists
  for (let j = window - 1; j <= lastCandidateEnd; j++) {
    const vec = shapeVector(candles, j, window);
    if (!vec) continue;
    const dist = euclidean(current, vec);
    const c0 = candles[j]!.close;
    const cF = candles[j + forward]!.close;
    if (c0 <= 0) continue;
    const forwardReturn = (cF - c0) / c0;
    candidates.push({
      index: j,
      time: candles[j]!.time,
      similarity: 1 / (1 + dist),
      forwardReturn,
      direction: forwardReturn > flat ? 'up' : forwardReturn < -flat ? 'down' : 'flat',
    });
  }

  if (candidates.length === 0) return base;

  candidates.sort((a, b) => b.similarity - a.similarity);
  const analogs = candidates.slice(0, Math.min(k, candidates.length));

  const returns = analogs.map((a) => a.forwardReturn);
  const ups = analogs.filter((a) => a.forwardReturn > 0).length;
  const stats = {
    sampleSize: analogs.length,
    pctUp: ups / analogs.length,
    avgForwardReturn: returns.reduce((a, b) => a + b, 0) / analogs.length,
    medianForwardReturn: median(returns),
    bestForwardReturn: Math.max(...returns),
    worstForwardReturn: Math.min(...returns),
    avgSimilarity: analogs.reduce((a, b) => a + b.similarity, 0) / analogs.length,
  };

  return { window, forward, analogs, stats };
}
