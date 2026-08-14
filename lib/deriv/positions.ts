/**
 * Live open positions + realised daily P/L (spec §18, §26). SERVER-SIDE ONLY.
 * Reads the authenticated Deriv account via the OTP socket; used by the risk
 * guardrail dashboard and the positions view. Fail-safe: returns a structured
 * error state rather than throwing, and never opens a trade.
 */
import { DerivAccountSocket } from './account';
import { getDerivConfig } from './config';
import type {
  DerivBalanceResponse,
  DerivPortfolioResponse,
  DerivOpenContractResponse,
  DerivProfitTableResponse,
  DerivSellResponse,
} from './types';

export interface LivePosition {
  contractId: number;
  symbol: string;
  longcode: string;
  buyPrice: number;
  /** Money at risk: the multiplier stop-loss amount, or the full deposit if none. */
  riskAmount: number;
  profit: number;
  isValidToSell: boolean;
}

export interface LiveRiskSnapshot {
  connected: boolean;
  isVirtual: boolean;
  balance: number;
  currency: string;
  positions: LivePosition[];
  /** Capital committed to open contracts (sum of buy prices / deposits). */
  openStake: number;
  /** Money genuinely at risk across open contracts (sum of stop-loss caps). */
  openRisk: number;
  /** Realised P/L since 00:00 UTC today; negative is a loss. */
  dailyRealizedPnl: number;
  error?: string;
}

const EMPTY: LiveRiskSnapshot = {
  connected: false,
  isVirtual: true,
  balance: 0,
  currency: 'USD',
  positions: [],
  openStake: 0,
  openRisk: 0,
  dailyRealizedPnl: 0,
};

function startOfUtcTodaySeconds(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

/** Snapshot of balance, open positions (with live P/L) and today's realised P/L. */
export async function getLiveRiskSnapshot(): Promise<LiveRiskSnapshot> {
  if (!getDerivConfig().hasAccount) return { ...EMPTY, error: 'Configure DERIV_API_TOKEN and DERIV_ACCOUNT_ID.' };

  // Bound each read so a slow provider can't blow the serverless time budget.
  const READ_TIMEOUT_MS = 7000;
  let client: DerivAccountSocket | null = null;
  try {
    client = await DerivAccountSocket.open();
    const c = client;

    // Balance, portfolio and today's statement run concurrently on the one socket
    // (requests are multiplexed by req_id), instead of one slow round-trip at a time.
    const [balanceRes, portfolio, table] = await Promise.all([
      c.request<DerivBalanceResponse>({ balance: 1 }, READ_TIMEOUT_MS),
      c.request<DerivPortfolioResponse>({ portfolio: 1 }, READ_TIMEOUT_MS),
      c
        .request<DerivProfitTableResponse>({ profit_table: 1, description: 0, date_from: startOfUtcTodaySeconds() }, READ_TIMEOUT_MS)
        .catch(() => ({} as DerivProfitTableResponse)),
    ]);

    const balance = balanceRes.balance?.balance ?? 0;
    const currency = balanceRes.balance?.currency ?? 'USD';
    const contracts = portfolio.portfolio?.contracts ?? [];

    // Value every open contract in parallel; skip any that fails.
    const valued = await Promise.all(
      contracts.map((contract) =>
        c
          .request<DerivOpenContractResponse>({ proposal_open_contract: 1, contract_id: contract.contract_id }, READ_TIMEOUT_MS)
          .then((poc) => ({ contract, p: poc.proposal_open_contract }))
          .catch(() => null),
      ),
    );

    const positions: LivePosition[] = [];
    for (const item of valued) {
      if (!item || item.p?.is_sold) continue;
      const { contract, p } = item;
      const buyPrice = p?.buy_price ?? contract.buy_price ?? 0;
      const stopLossCap = p?.limit_order?.stop_loss?.order_amount;
      positions.push({
        contractId: contract.contract_id,
        symbol: contract.symbol ?? p?.underlying ?? '—',
        longcode: contract.longcode ?? p?.longcode ?? '',
        buyPrice,
        riskAmount: typeof stopLossCap === 'number' && stopLossCap > 0 ? stopLossCap : buyPrice,
        profit: p?.profit ?? 0,
        isValidToSell: p?.is_valid_to_sell === 1,
      });
    }

    let dailyRealizedPnl = 0;
    for (const t of table.profit_table?.transactions ?? []) {
      if (typeof t.sell_price === 'number' && typeof t.buy_price === 'number') {
        dailyRealizedPnl += t.sell_price - t.buy_price;
      }
    }

    return {
      connected: true,
      isVirtual: client.isVirtual,
      balance,
      currency,
      positions,
      openStake: positions.reduce((sum, p) => sum + p.buyPrice, 0),
      openRisk: positions.reduce((sum, p) => sum + p.riskAmount, 0),
      dailyRealizedPnl,
    };
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : 'Could not read the Deriv account.' };
  } finally {
    client?.close();
  }
}

export interface CloseResult {
  ok: boolean;
  soldFor?: number;
  error?: string;
}

export interface DailyPnl {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  pnl: number;
}

/** Realised P/L per UTC day for the last `days` days (closed contracts only). */
export async function getDailyPnlHistory(days = 14): Promise<DailyPnl[]> {
  if (!getDerivConfig().hasAccount) return [];
  let client: DerivAccountSocket | null = null;
  try {
    client = await DerivAccountSocket.open();
    const from = startOfUtcTodaySeconds() - (days - 1) * 86400;
    const table = await client.request<DerivProfitTableResponse>({ profit_table: 1, description: 0, date_from: from, sort: 'ASC' });
    const buckets = new Map<string, number>();
    for (const t of table.profit_table?.transactions ?? []) {
      if (typeof t.sell_price === 'number' && typeof t.buy_price === 'number' && typeof t.sell_time === 'number') {
        const date = new Date(t.sell_time * 1000).toISOString().slice(0, 10);
        buckets.set(date, (buckets.get(date) ?? 0) + (t.sell_price - t.buy_price));
      }
    }
    const out: DailyPnl[] = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date((startOfUtcTodaySeconds() - (days - 1 - i) * 86400) * 1000).toISOString().slice(0, 10);
      out.push({ date, pnl: Number((buckets.get(date) ?? 0).toFixed(2)) });
    }
    return out;
  } catch {
    return [];
  } finally {
    client?.close();
  }
}

/** Close (sell) one open contract at market. */
export async function closeLivePosition(contractId: number): Promise<CloseResult> {
  if (!getDerivConfig().hasAccount) return { ok: false, error: 'Deriv account not configured.' };
  let client: DerivAccountSocket | null = null;
  try {
    client = await DerivAccountSocket.open();
    const res = await client.request<DerivSellResponse>({ sell: contractId, price: 0 });
    if (!res.sell) return { ok: false, error: 'Deriv returned no sell confirmation.' };
    return { ok: true, soldFor: res.sell.sold_for };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not close the position.' };
  } finally {
    client?.close();
  }
}

/** Close every open contract (kill-switch). Returns per-contract results. */
export async function closeAllLivePositions(): Promise<{ closed: number; failed: number }> {
  if (!getDerivConfig().hasAccount) return { closed: 0, failed: 0 };
  let client: DerivAccountSocket | null = null;
  let closed = 0;
  let failed = 0;
  try {
    client = await DerivAccountSocket.open();
    const portfolio = await client.request<DerivPortfolioResponse>({ portfolio: 1 });
    const contracts = portfolio.portfolio?.contracts ?? [];
    for (const c of contracts) {
      try {
        const res = await client.request<DerivSellResponse>({ sell: c.contract_id, price: 0 });
        if (res.sell) closed += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
  } catch {
    // Connection failed — nothing closed.
  } finally {
    client?.close();
  }
  return { closed, failed };
}
