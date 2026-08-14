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
  profit: number;
  isValidToSell: boolean;
}

export interface LiveRiskSnapshot {
  connected: boolean;
  isVirtual: boolean;
  balance: number;
  currency: string;
  positions: LivePosition[];
  /** Capital committed to open contracts (sum of buy prices). */
  openStake: number;
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
  dailyRealizedPnl: 0,
};

function startOfUtcTodaySeconds(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

/** Snapshot of balance, open positions (with live P/L) and today's realised P/L. */
export async function getLiveRiskSnapshot(): Promise<LiveRiskSnapshot> {
  if (!getDerivConfig().hasAccount) return { ...EMPTY, error: 'Configure DERIV_API_TOKEN and DERIV_ACCOUNT_ID.' };

  let client: DerivAccountSocket | null = null;
  try {
    client = await DerivAccountSocket.open();

    const balanceRes = await client.request<DerivBalanceResponse>({ balance: 1 });
    const balance = balanceRes.balance?.balance ?? 0;
    const currency = balanceRes.balance?.currency ?? 'USD';

    const portfolio = await client.request<DerivPortfolioResponse>({ portfolio: 1 });
    const contracts = portfolio.portfolio?.contracts ?? [];

    const positions: LivePosition[] = [];
    for (const c of contracts) {
      try {
        const poc = await client.request<DerivOpenContractResponse>({ proposal_open_contract: 1, contract_id: c.contract_id });
        const p = poc.proposal_open_contract;
        if (p?.is_sold) continue;
        positions.push({
          contractId: c.contract_id,
          symbol: c.symbol ?? p?.underlying ?? '—',
          longcode: c.longcode ?? p?.longcode ?? '',
          buyPrice: p?.buy_price ?? c.buy_price ?? 0,
          profit: p?.profit ?? 0,
          isValidToSell: p?.is_valid_to_sell === 1,
        });
      } catch {
        // Skip a contract we can't value rather than fail the whole snapshot.
      }
    }

    let dailyRealizedPnl = 0;
    try {
      const table = await client.request<DerivProfitTableResponse>({ profit_table: 1, description: 0, date_from: startOfUtcTodaySeconds() });
      for (const t of table.profit_table?.transactions ?? []) {
        if (typeof t.sell_price === 'number' && typeof t.buy_price === 'number') {
          dailyRealizedPnl += t.sell_price - t.buy_price;
        }
      }
    } catch {
      // Realised P/L is best-effort; leave at 0 if the statement call fails.
    }

    return {
      connected: true,
      isVirtual: client.isVirtual,
      balance,
      currency,
      positions,
      openStake: positions.reduce((sum, p) => sum + p.buyPrice, 0),
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
