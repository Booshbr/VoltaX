/**
 * Minimal Deriv WebSocket API message shapes (spec §8, §75). Only the subset
 * VoltaX uses. Full docs: https://api.deriv.com/api-explorer.
 * These are provider wire types — kept separate from our domain model.
 */

export interface DerivActiveSymbol {
  symbol?: string;
  display_name?: string;
  market: string;
  submarket: string;
  submarket_display_name?: string;
  exchange_is_open: 0 | 1;
  is_trading_suspended: 0 | 1;
  pip?: number;
  underlying_symbol?: string;
  underlying_symbol_name?: string;
  pip_size?: number;
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
  /** Number of decimal digits for the instrument's price. */
  pip_size?: number;
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

/** Multiplier proposal response (subset). */
export interface DerivProposalResponse {
  proposal?: {
    id: string;
    ask_price: number;
    display_value: string;
    spot: number;
    spot_time: number;
  };
  error?: DerivError;
}

/** Buy response (subset). */
export interface DerivBuyResponse {
  buy?: {
    contract_id: number;
    buy_price: number;
    balance_after: number;
    longcode: string;
    purchase_time: number;
    transaction_id: number;
  };
  error?: DerivError;
}

export interface DerivBalanceResponse {
  balance?: { balance: number; currency: string; loginid: string };
  error?: DerivError;
}

/** portfolio: list of open contracts (subset). */
export interface DerivPortfolioContract {
  contract_id: number;
  symbol?: string;
  longcode?: string;
  buy_price?: number;
  purchase_time?: number;
  contract_type?: string;
  currency?: string;
}
export interface DerivPortfolioResponse {
  portfolio?: { contracts?: DerivPortfolioContract[] };
  error?: DerivError;
}

/** proposal_open_contract: live valuation of one open contract (subset). */
export interface DerivOpenContractResponse {
  proposal_open_contract?: {
    contract_id: number;
    profit?: number;
    bid_price?: number;
    buy_price?: number;
    is_sold?: 0 | 1;
    is_valid_to_sell?: 0 | 1;
    underlying?: string;
    longcode?: string;
  };
  error?: DerivError;
}

/** sell: close a contract at market (price 0 = any price). */
export interface DerivSellResponse {
  sell?: { contract_id: number; sold_for: number; balance_after: number; transaction_id: number };
  error?: DerivError;
}

/** profit_table: closed transactions, used for realised daily P/L (subset). */
export interface DerivProfitTableResponse {
  profit_table?: { transactions?: Array<{ buy_price?: number; sell_price?: number; sell_time?: number }>; count?: number };
  error?: DerivError;
}

/** Deriv candle granularities (seconds) accepted by ticks_history. */
export const DERIV_GRANULARITY: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
};
