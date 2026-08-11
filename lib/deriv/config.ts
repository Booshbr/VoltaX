/**
 * Deriv configuration (spec §8, §41, §48). SERVER-SIDE ONLY. The API token must
 * NEVER reach the browser — nothing here is prefixed NEXT_PUBLIC_, and a runtime
 * guard refuses to read config in a browser context.
 *
 * NOTE: intended for server contexts only (route handlers, server components,
 * server actions). The `typeof window` guard below is defense-in-depth.
 */
import { z } from 'zod';

const schema = z.object({
  appId: z.string().min(1),
  wsUrl: z.string().url(),
  /** Optional: without a token we can still read public market data. */
  token: z.string().min(1).optional(),
});

export type DerivConfig = z.infer<typeof schema>;

export interface DerivConfigResult {
  configured: boolean;
  /** True when an account token is present (required for trading/balance). */
  hasToken: boolean;
  config: DerivConfig | null;
  error: string | null;
}

/**
 * Read and validate Deriv config from the environment. Never throws — returns a
 * structured result so callers can degrade safely (spec §39 fail-safe).
 */
export function getDerivConfig(): DerivConfigResult {
  if (typeof window !== 'undefined') {
    // Defense in depth: this module is server-only, but guard anyway.
    return { configured: false, hasToken: false, config: null, error: 'server-only' };
  }
  const parsed = schema.safeParse({
    appId: process.env.DERIV_APP_ID ?? '1089',
    wsUrl: process.env.DERIV_WS_URL ?? 'wss://ws.derivws.com/websockets/v3',
    token: process.env.DERIV_API_TOKEN || undefined,
  });
  if (!parsed.success) {
    return {
      configured: false,
      hasToken: false,
      config: null,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return {
    configured: true,
    hasToken: Boolean(parsed.data.token),
    config: parsed.data,
    error: null,
  };
}

/** Redact a token for safe logging — never log the full value (spec §41). */
export function redactToken(token?: string): string {
  if (!token) return '(none)';
  if (token.length <= 4) return '****';
  return `${token.slice(0, 2)}…${token.slice(-2)}`;
}
