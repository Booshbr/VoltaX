/**
 * Pure mappers from Deriv wire types to the VoltaX domain model (spec §8).
 * Kept pure and dependency-free so they are trivially unit-testable and reused by
 * both live and any recorded-data paths.
 */
import type { Candle, Instrument } from '@/lib/types';
import { classifyFamily } from '@/lib/config/families';
import type { DerivActiveSymbol, DerivCandle } from './types';

/** Map a Deriv active symbol to a domain Instrument. */
export function toInstrument(sym: DerivActiveSymbol): Instrument {
  return {
    symbol: sym.symbol,
    displayName: sym.display_name,
    family: classifyFamily(sym.symbol, sym.display_name),
    pip: sym.pip > 0 ? sym.pip : 0.01,
    active: sym.exchange_is_open === 1 && sym.is_trading_suspended === 0,
  };
}

/** Filter Deriv symbols to synthetic-index markets and map them. */
export function toInstruments(symbols: DerivActiveSymbol[]): Instrument[] {
  return symbols
    .filter((s) => s.market === 'synthetic_index' || s.submarket.includes('synthetic'))
    .map(toInstrument);
}

/** Map Deriv candles to domain candles (epoch → time). */
export function toCandles(candles: DerivCandle[]): Candle[] {
  return candles.map((c) => ({
    time: c.epoch,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}
