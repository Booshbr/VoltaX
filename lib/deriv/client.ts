/**
 * Deriv WebSocket client (spec §8). SERVER-SIDE ONLY. A single, cohesive
 * integration surface — no Deriv calls are scattered elsewhere. Uses the Node
 * global WebSocket (Node 22+). Handles request/response correlation via req_id,
 * connection lifecycle, and safe timeouts. Trading methods are intentionally
 * gated behind an account token and explicit enablement (spec §18, §42).
 */
import type { Candle, Instrument, Timeframe } from '@/lib/types';
import { validCandles, dedupeAndSort } from '@/lib/market-data/candles';
import { getDerivConfig, redactToken, type DerivConfig } from './config';
import { toInstruments, toCandles } from './mappers';
import {
  DERIV_GRANULARITY,
  type DerivActiveSymbolsResponse,
  type DerivCandlesResponse,
} from './types';

export class DerivNotConfiguredError extends Error {
  constructor(detail: string) {
    super(`Deriv API is not configured: ${detail}`);
    this.name = 'DerivNotConfiguredError';
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DerivClient {
  private ws: WebSocket | null = null;
  private reqId = 0;
  private pending = new Map<number, Pending>();
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly config: DerivConfig, private readonly timeoutMs = 15_000) {}

  /** Open the socket (idempotent). */
  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    const url = `${this.config.wsUrl}?app_id=${encodeURIComponent(this.config.appId)}`;
    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const onError = () => reject(new Error('Deriv WebSocket connection failed'));
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', onError, { once: true });
      ws.addEventListener('message', (ev) => this.onMessage(ev));
      ws.addEventListener('close', () => this.onClose());
    });
    return this.connectPromise;
  }

  private onMessage(ev: MessageEvent): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
    } catch {
      return;
    }
    const echo = data.echo_req as { req_id?: number } | undefined;
    const reqId = (data.req_id as number | undefined) ?? echo?.req_id;
    if (reqId === undefined) return;
    const pending = this.pending.get(reqId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(reqId);
    pending.resolve(data);
  }

  private onClose(): void {
    this.connectPromise = null;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Deriv WebSocket closed'));
    }
    this.pending.clear();
  }

  /** Send a request and await its correlated response. */
  private send<T>(payload: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Deriv WebSocket is not open'));
    }
    const reqId = ++this.reqId;
    const message = { ...payload, req_id: reqId };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error(`Deriv request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      this.pending.set(reqId, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      this.ws!.send(JSON.stringify(message));
    });
  }

  /** Discover the synthetic-index instrument universe (spec §7 dynamic discovery). */
  async getInstruments(): Promise<Instrument[]> {
    const res = await this.send<DerivActiveSymbolsResponse>({
      active_symbols: 'brief',
      product_type: 'basic',
    });
    if (res.error) throw new Error(`Deriv active_symbols: ${res.error.message}`);
    return toInstruments(res.active_symbols ?? []);
  }

  /** Fetch recent historical candles for a symbol/timeframe. */
  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    count = 200,
  ): Promise<Candle[]> {
    const granularity = DERIV_GRANULARITY[timeframe];
    const res = await this.send<DerivCandlesResponse>({
      ticks_history: symbol,
      style: 'candles',
      granularity,
      count,
      end: 'latest',
    });
    if (res.error) throw new Error(`Deriv ticks_history: ${res.error.message}`);
    // Normalise: dedupe, sort, drop malformed candles before analysis (spec §40).
    return dedupeAndSort(validCandles(toCandles(res.candles ?? [])));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

let singleton: DerivClient | null = null;

/**
 * Get a shared, connected client. Throws DerivNotConfiguredError when no config
 * is available so callers surface a clear "configuration required" state rather
 * than a fake connection (spec §81).
 */
export async function getDerivClient(): Promise<DerivClient> {
  const { configured, config, error } = getDerivConfig();
  if (!configured || !config) {
    throw new DerivNotConfiguredError(error ?? 'missing configuration');
  }
  if (!singleton) singleton = new DerivClient(config);
  await singleton.connect();
  return singleton;
}

/** Lightweight status probe for the System Health page (spec §43). */
export async function derivHealth(): Promise<{
  configured: boolean;
  hasToken: boolean;
  connected: boolean;
  tokenPreview: string;
  detail: string;
}> {
  const cfg = getDerivConfig();
  const base = {
    configured: cfg.configured,
    hasToken: cfg.hasToken,
    tokenPreview: redactToken(cfg.config?.token),
  };
  if (!cfg.configured || !cfg.config) {
    return { ...base, connected: false, detail: cfg.error ?? 'not configured' };
  }
  try {
    const client = await getDerivClient();
    await client.getInstruments();
    return { ...base, connected: true, detail: 'ok' };
  } catch (err) {
    return {
      ...base,
      connected: false,
      detail: err instanceof Error ? err.message : 'unknown error',
    };
  }
}
