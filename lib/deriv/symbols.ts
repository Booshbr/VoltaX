/**
 * Curated synthetic-index symbols used for discovery when the provider's
 * `active_symbols` list is unavailable (spec §7 keeps discovery dynamic, this is
 * the fallback). All symbols here are verified to resolve on Deriv's public
 * endpoint. Family is derived via `classifyFamily`.
 */
export interface KnownSymbol {
  symbol: string;
  displayName: string;
}

export const KNOWN_SYNTHETICS: KnownSymbol[] = [
  { symbol: 'R_25', displayName: 'Volatility 25 Index' },
  { symbol: 'R_50', displayName: 'Volatility 50 Index' },
  { symbol: 'R_75', displayName: 'Volatility 75 Index' },
  { symbol: 'R_100', displayName: 'Volatility 100 Index' },
  { symbol: 'BOOM500', displayName: 'Boom 500 Index' },
  { symbol: 'BOOM1000', displayName: 'Boom 1000 Index' },
  { symbol: 'CRASH500', displayName: 'Crash 500 Index' },
  { symbol: 'CRASH1000', displayName: 'Crash 1000 Index' },
  { symbol: 'JD50', displayName: 'Jump 50 Index' },
  { symbol: 'JD100', displayName: 'Jump 100 Index' },
  { symbol: 'stpRNG', displayName: 'Step Index' },
];
