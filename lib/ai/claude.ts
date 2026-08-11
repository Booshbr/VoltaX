/**
 * Claude explanation provider (spec §33, §67, §68). SERVER-SIDE ONLY. Explains an
 * already-decided signal from verified structured facts. The prompt forbids the
 * model from introducing facts, altering numbers, or predicting guaranteed
 * outcomes. Activates only when AI_API_KEY is configured; any failure is caught by
 * the orchestrator so signal generation is never affected.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SignalExplanation, SignalExplanationContext } from './types';

export function isAiConfigured(): boolean {
  if (typeof window !== 'undefined') return false;
  return Boolean(process.env.AI_API_KEY);
}

const SYSTEM_PROMPT = `You explain trading-signal decisions that a deterministic engine has ALREADY made, for a beginner audience. You receive verified, structured facts as JSON.

Strict rules:
- Do NOT introduce any fact, price level, indicator, or statistic that is not present in the supplied data.
- Do NOT alter any numerical value.
- Do NOT predict guaranteed outcomes. Never use words like "guaranteed", "certain", "will win", or "risk-free". Use "historically", "statistically", "based on backtested data".
- Do NOT invent technical reasons. Only explain the decision the data describes.
- If a piece of data is unavailable, say so plainly.
- Keep each field to 1-3 clear sentences.

Explain the existing algorithmic decision — you are a research and explanation layer, not a decision maker.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    structure: { type: 'string' },
    setup: { type: 'string' },
    entry: { type: 'string' },
    risk: { type: 'string' },
    reliability: { type: 'string' },
    invalidation: { type: 'string' },
  },
  required: ['summary', 'structure', 'setup', 'entry', 'risk', 'reliability', 'invalidation'],
} as const;

interface ClaudeExplanationFields {
  summary: string;
  structure: string;
  setup: string;
  entry: string;
  risk: string;
  reliability: string;
  invalidation: string;
}

/** Generate an explanation via Claude. Throws on failure — the caller decides how
 * to degrade (the orchestrator falls back to the deterministic explainer). */
export async function explainWithClaude(
  ctx: SignalExplanationContext,
): Promise<SignalExplanation> {
  if (!isAiConfigured()) throw new Error('AI provider not configured');
  const model = process.env.AI_MODEL || 'claude-sonnet-5';
  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });

  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Explain this signal from the following verified facts. Return JSON with the required fields.\n\n${JSON.stringify(ctx, null, 2)}`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI returned no text content');
  }
  const parsed = JSON.parse(textBlock.text) as ClaudeExplanationFields;

  return { ...parsed, source: 'ai', model };
}
