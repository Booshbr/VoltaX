/**
 * AI explanation types (spec §33, §68). The context contains ONLY validated,
 * structured facts already produced by the deterministic engine — never free text
 * the model could hallucinate from. The AI's job is to explain these facts in
 * plain language, not to decide anything.
 */

export interface SignalExplanationContext {
  instrument: string;
  family: string;
  direction: 'long' | 'short' | null;
  status: string;
  qualified: boolean;
  methodologyVersion: string;

  htf: { bias: string; regime: string; volatility: string };
  mtf: { bias: string; regime: string };
  setup: { status: string; type: string | null; confluence: string[] };
  entry: { confirmed: boolean; momentum: number };
  precision: { triggered: boolean };

  risk: {
    entry: number;
    stopLoss: number;
    takeProfits: number[];
    riskReward: number;
  } | null;

  reliability: { score: number; sampleSize: number; winRate: number | null; sufficient: boolean };
  opportunityScore: number;
  rejectionReason: string | null;
}

/** Structured explanation output (spec §33). Each field is human-readable prose
 * derived strictly from the context. */
export interface SignalExplanation {
  summary: string;
  structure: string;
  setup: string;
  entry: string;
  risk: string;
  reliability: string;
  invalidation: string;
  /** Which provider produced this: the deterministic templater or a live AI model. */
  source: 'deterministic' | 'ai';
  model?: string;
}
