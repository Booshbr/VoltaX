/** Serializable signal shape passed from server pages to the paper-trading client. */
import type { Direction } from '@/lib/types';

export interface TradeableSignal {
  symbol: string;
  family: string;
  direction: Direction;
  entry: number;
  stop: number;
  takeProfit: number;
  size: number;
  reliability: number;
  opportunityScore: number;
  lastPrice: number;
  qualified: boolean;
}
