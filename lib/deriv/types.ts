/**
 * Minimal Deriv WebSocket API message shapes (spec §8, §75). Only the subset
 * VoltaX uses. Full docs: https://api.deriv.com/api-explorer.
 * These are provider wire types — kept separate from our domain model.
 */

export interface DerivActiveSymbol {
  symbol: string;
  display_name: string;
  market: string;
  submarket: string;
  submarket_display_name: string;
  exchange_is_open: 0 | 1;
  is_trading_suspended: 0 | 1;
  pip: number;
}

export interface DerivActiveSymbolsResponse {
  active_symbols?: DerivActiveSymbol[];
  error?: DerivError;
}

/** ticks_history with style="candles" returns this shape. */
export interface DerivCandle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DerivCandlesResponse {
  candles?: DerivCandle[];
  error?: DerivError;
}

export interface DerivAuthorizeResponse {
  authorize?: {
    loginid: string;
    currency: string;
    balance: number;
    is_virtual: 0 | 1;
  };
  error?: DerivError;
}

export interface DerivError {
  code: string;
  message: string;
}

/** Deriv candle granularities (seconds) accepted by ticks_history. */
export const DERIV_GRANULARITY: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
};
