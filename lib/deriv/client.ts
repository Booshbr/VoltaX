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
import { classifyFamily } from '@/lib/config/families';
import { KNOWN_SYNTHETICS } from './symbols';
import {
  DERIV_GRANULARITY,
  type DerivActiveSymbolsResponse,
  type DerivCandlesResponse,
  type DerivAuthorizeResponse,
  type DerivBalanceResponse,
  type DerivProposalResponse,
  type DerivBuyResponse,
} from './types';

export interface MultiplierOrderParams {
  symbol: string;
  direction: 'long' | 'short';
  /** Stake in account currency. */
  amount: number;
  multiplier: number;
  currency: string;
  /** Monetary stop-loss / take-profit (P/L amounts in currency). */
  stopLoss: number;
  takeProfit: number;
}

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

    const url = this.config.wsUrl.includes('/trading/v1/options/ws/')
      ? this.config.wsUrl
      : `${this.config.wsUrl}?app_id=${encodeURIComponent(this.config.appId)}`;
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

  /** Discover the synthetic-index instrument universe (spec §7 dynamic discovery).
   * Falls back to a curated, verified list when the provider returns none. */
  async getInstruments(): Promise<Instrument[]> {
    const res = await this.send<DerivActiveSymbolsResponse>({
      active_symbols: 'brief',
    });
    if (res.error) throw new Error(`Deriv active_symbols: ${res.error.message}`);
    const discovered = toInstruments(res.active_symbols ?? []);
    if (discovered.length > 0) return discovered;
    return KNOWN_SYNTHETICS.map((k) => ({
      symbol: k.symbol,
      displayName: k.displayName,
      family: classifyFamily(k.symbol, k.displayName),
      pip: 0.01,
      active: true,
    }));
  }

  /**
   * Fetch candles for several timeframes of one symbol in parallel, returning the
   * normalised series per timeframe plus the instrument's price digits (pip_size).
   */
  async getCandleSet(
    symbol: string,
    timeframes: Timeframe[],
    count = 300,
  ): Promise<{ candles: Partial<Record<Timeframe, Candle[]>>; digits: number }> {
    const results = await Promise.all(
      timeframes.map(async (tf) => {
        const res = await this.send<DerivCandlesResponse>({
          ticks_history: symbol,
          style: 'candles',
          granularity: DERIV_GRANULARITY[tf],
          count,
          end: 'latest',
        });
        if (res.error) throw new Error(`Deriv ticks_history ${symbol}/${tf}: ${res.error.message}`);
        return {
          tf,
          candles: dedupeAndSort(validCandles(toCandles(res.candles ?? []))),
          digits: res.pip_size ?? 2,
        };
      }),
    );
    const candles: Partial<Record<Timeframe, Candle[]>> = {};
    let digits = 2;
    for (const r of results) {
      candles[r.tf] = r.candles;
      digits = r.digits;
    }
    return { candles, digits };
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

  /**
   * Authorize this connection with an account token (spec §8). Required before
   * any balance/trading call. The token is used only here, server-side.
   */
  async authorize(token: string): Promise<{ loginid: string; currency: string; balance: number; isVirtual: boolean }> {
    const res = await this.send<DerivAuthorizeResponse>({ authorize: token });
    if (res.error) throw new Error(`Deriv authorize: ${res.error.message}`);
    if (!res.authorize) throw new Error('Deriv authorize: empty response');
    return {
      loginid: res.authorize.loginid,
      currency: res.authorize.currency,
      balance: res.authorize.balance,
      isVirtual: res.authorize.is_virtual === 1,
    };
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    const res = await this.send<DerivBalanceResponse>({ balance: 1 });
    if (res.error) throw new Error(`Deriv balance: ${res.error.message}`);
    if (!res.balance) throw new Error('Deriv balance: empty response');
    return { balance: res.balance.balance, currency: res.balance.currency };
  }

  /**
   * Get a price proposal for a multiplier contract. `stopLoss`/`takeProfit` are
   * MONETARY P/L amounts in the account currency (Deriv multiplier semantics),
   * so they directly bound the money at risk (spec §19 — validated, not assumed).
   */
  async proposeMultiplier(p: MultiplierOrderParams): Promise<{ id: string; askPrice: number }> {
    const res = await this.send<DerivProposalResponse>({
      proposal: 1,
      amount: p.amount,
      basis: 'stake',
      contract_type: p.direction === 'long' ? 'MULTUP' : 'MULTDOWN',
      currency: p.currency,
      symbol: p.symbol,
      multiplier: p.multiplier,
      limit_order: {
        stop_loss: Number(p.stopLoss.toFixed(2)),
        take_profit: Number(p.takeProfit.toFixed(2)),
      },
    });
    if (res.error) throw new Error(`Deriv proposal: ${res.error.message}`);
    if (!res.proposal) throw new Error('Deriv proposal: empty response');
    return { id: res.proposal.id, askPrice: res.proposal.ask_price };
  }

  /** Buy a previously-proposed contract. `maxPrice` caps slippage. */
  async buyContract(proposalId: string, maxPrice: number): Promise<{ contractId: number; buyPrice: number; longcode: string }> {
    const res = await this.send<DerivBuyResponse>({ buy: proposalId, price: maxPrice });
    if (res.error) throw new Error(`Deriv buy: ${res.error.message}`);
    if (!res.buy) throw new Error('Deriv buy: empty response');
    return { contractId: res.buy.contract_id, buyPrice: res.buy.buy_price, longcode: res.buy.longcode };
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
