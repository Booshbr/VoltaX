/**
 * Gemini explanation provider. SERVER-SIDE ONLY.
 * Gemini receives the same verified context as every other provider and cannot
 * change the deterministic engine's decision.
 */
import type { SignalExplanation, SignalExplanationContext } from './types';

const SYSTEM_PROMPT = `You explain trading-signal decisions that a deterministic engine has ALREADY made, for a beginner audience. You receive verified, structured facts as JSON.

Strict rules:
- Do NOT introduce any fact, price level, indicator, or statistic that is not present in the supplied data.
- Do NOT alter any numerical value.
- Do NOT predict guaranteed outcomes. Never use words like "guaranteed", "certain", "will win", or "risk-free". Use "historically", "statistically", "based on backtested data".
- Do NOT invent technical reasons. Only explain the decision the data describes.
- If a piece of data is unavailable, say so plainly.
- Keep each field to 1-3 clear sentences.

Explain the existing algorithmic decision. You are a research and explanation layer, not a decision maker.`;

interface GeminiExplanationFields {
  summary: string;
  structure: string;
  setup: string;
  entry: string;
  risk: string;
  reliability: string;
  invalidation: string;
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    structure: { type: 'STRING' },
    setup: { type: 'STRING' },
    entry: { type: 'STRING' },
    risk: { type: 'STRING' },
    reliability: { type: 'STRING' },
    invalidation: { type: 'STRING' },
  },
  required: ['summary', 'structure', 'setup', 'entry', 'risk', 'reliability', 'invalidation'],
} as const;

export function isGeminiConfigured(): boolean {
  return typeof window === 'undefined' && Boolean(getGeminiConfig()?.apiKey);
}

export async function explainWithGemini(ctx: SignalExplanationContext): Promise<SignalExplanation> {
  const config = getGeminiConfig();
  if (!config) throw new Error('Gemini API key is not configured');
  const { apiKey, model } = config;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Explain this signal from the following verified facts. Return JSON with the required fields.\n\n${JSON.stringify(ctx)}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.2 },
      }),
      cache: 'no-store',
    },
  );
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no explanation');
  const parsed = JSON.parse(text) as GeminiExplanationFields;
  return { ...parsed, source: 'ai', model };
}

function getGeminiConfig(): { apiKey: string; model: string } | null {
  const explicitKey = process.env.GEMINI_API_KEY;
  const explicitModel = process.env.GEMINI_MODEL;
  if (explicitKey) return { apiKey: explicitKey, model: normaliseModel(explicitModel || 'gemini-2.5-flash') };

  // Backward-compatible migration path for an existing project that put a
  // Gemini key in AI_API_KEY and selected a Gemini-named model.
  const legacyModel = process.env.AI_MODEL;
  if (process.env.AI_API_KEY && legacyModel?.toLowerCase().includes('gemini')) {
    return { apiKey: process.env.AI_API_KEY, model: normaliseModel(legacyModel) };
  }
  return null;
}

function normaliseModel(model: string): string {
  return model.trim().toLowerCase().replace(/\s+/g, '-');
}
