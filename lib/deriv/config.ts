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
  /** Options account ID, required for the current authenticated Deriv API. */
  accountId: z.string().min(1).optional(),
});

export type DerivConfig = z.infer<typeof schema>;

export interface DerivConfigResult {
  configured: boolean;
  /** True when an account token is present (required for trading/balance). */
  hasToken: boolean;
  /** True when the token and an Options account ID are both present. */
  hasAccount: boolean;
  config: DerivConfig | null;
  error: string | null;
}

/**
 * Read and validate Deriv config from the environment. A project must explicitly
 * provide its own app ID before live market data is attempted. This prevents a
 * deployed demo from opening slow, failing provider connections on every request.
 * Never throws — callers receive a structured, safe fallback state.
 */
export function getDerivConfig(): DerivConfigResult {
  if (typeof window !== 'undefined') {
    // Defense in depth: this module is server-only, but guard anyway.
    return { configured: false, hasToken: false, hasAccount: false, config: null, error: 'server-only' };
  }
  const appId = process.env.DERIV_APP_ID;
  if (!appId) {
    return {
      configured: false,
      hasToken: false,
      hasAccount: false,
      config: null,
      error: 'DERIV_APP_ID is not configured',
    };
  }
  const parsed = schema.safeParse({
    appId,
    // The old `ws.derivws.com/websockets/v3` URL is legacy. Public market data
    // now uses the current Options public WebSocket endpoint.
    wsUrl: process.env.DERIV_WS_URL === 'wss://ws.derivws.com/websockets/v3'
      ? 'wss://api.derivws.com/trading/v1/options/ws/public'
      : process.env.DERIV_WS_URL ?? 'wss://api.derivws.com/trading/v1/options/ws/public',
    token: process.env.DERIV_API_TOKEN || undefined,
    accountId: process.env.DERIV_ACCOUNT_ID || undefined,
  });
  if (!parsed.success) {
    return {
      configured: false,
      hasToken: false,
      hasAccount: false,
      config: null,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return {
    configured: true,
    hasToken: Boolean(parsed.data.token),
    hasAccount: Boolean(parsed.data.token && parsed.data.accountId),
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
