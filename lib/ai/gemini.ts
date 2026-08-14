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
  const { apiKey, model: requestedModel } = config;

  let model = requestedModel;
  let response = await generate(model, apiKey, ctx);
  if (response.status === 404) {
    const available = await findAvailableModel(apiKey);
    if (!available) throw new Error(`Gemini model '${requestedModel}' is unavailable for this API key`);
    model = available;
    response = await generate(model, apiKey, ctx);
  }
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no explanation');
  const parsed = JSON.parse(text) as GeminiExplanationFields;
  return { ...parsed, source: 'ai', model };
}

function generate(model: string, apiKey: string, ctx: SignalExplanationContext): Promise<Response> {
  return fetch(
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
}

/**
 * Resolve model drift per key/project instead of guessing from a stale default.
 * Newer Gemini API keys can no longer call the pinned versioned models
 * (`gemini-2.5-flash` etc. return 404 "no longer available to new users"), even
 * though those names still appear in the model list. The rolling `-latest`
 * aliases remain callable, so prefer those.
 */
async function findAvailableModel(apiKey: string): Promise<string | null> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const payload = (await response.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  const names = (payload.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent') && model.name?.startsWith('models/'))
    .map((model) => model.name!.slice('models/'.length));
  const preferred = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
  return (
    preferred.find((name) => names.includes(name)) ??
    // Any rolling alias is callable by new keys; pinned versions may 404.
    names.find((name) => name.startsWith('gemini') && name.endsWith('-latest') && name.includes('flash')) ??
    names.find((name) => name.startsWith('gemini') && name.endsWith('-latest')) ??
    names.find((name) => name.includes('flash')) ??
    names[0] ??
    null
  );
}

function getGeminiConfig(): { apiKey: string; model: string } | null {
  const explicitKey = process.env.GEMINI_API_KEY;
  const explicitModel = process.env.GEMINI_MODEL;
  if (explicitKey) return { apiKey: explicitKey, model: normaliseModel(explicitModel || 'gemini-flash-latest') };

  // Backward-compatible migration path for an existing project that put a
  // Gemini key in AI_API_KEY and selected a Gemini-named model.
  const legacyModel = process.env.AI_MODEL;
  if (process.env.AI_API_KEY && legacyModel?.toLowerCase().includes('gemini')) {
    return { apiKey: process.env.AI_API_KEY, model: normaliseModel(legacyModel) };
  }
  return null;
}

/**
 * Pinned versioned models that newer API keys can no longer call. We transparently
 * map them to the equivalent rolling alias so an existing `AI_MODEL="Gemini 2.5
 * Flash"` keeps working without a wasted 404 round-trip. Discovery still covers
 * anything not listed here.
 */
const GATED_ALIASES: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-flash-latest',
  'gemini-2.0-flash': 'gemini-flash-latest',
  'gemini-1.5-flash': 'gemini-flash-latest',
  'gemini-2.5-flash-lite': 'gemini-flash-lite-latest',
  'gemini-2.5-pro': 'gemini-pro-latest',
  'gemini-1.5-pro': 'gemini-pro-latest',
  'gemini-pro': 'gemini-pro-latest',
};

function normaliseModel(model: string): string {
  const slug = model.trim().toLowerCase().replace(/\s+/g, '-');
  return GATED_ALIASES[slug] ?? slug;
}
