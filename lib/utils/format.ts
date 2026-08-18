/** Display formatting helpers. Pure and locale-stable. */

export function formatPrice(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatRR(rr: number): string {
  if (!Number.isFinite(rr) || rr <= 0) return '—';
  return `1 : ${rr.toFixed(1)}`;
}

export function formatMoney(n: number, currency = 'USD'): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency });
}

/** Compact relative time from an ISO string to `now` (ms). */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function titleCase(s: string): string {
  return s.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase()).replace(/-/g, ' ');
}

/**
 * Human-readable Deriv synthetic-index name from its provider code, e.g.
 * `R_75` → "Volatility 75 Index", `1HZ75V` → "Volatility 75 (1s) Index",
 * `BOOM1000` → "Boom 1000 Index". Unknown codes are returned unchanged.
 */
export function formatSymbolName(symbol: string): string {
  if (!symbol) return symbol;
  const s = symbol.trim();
  let m: RegExpExecArray | null;
  if ((m = /^R_(\d+)$/i.exec(s))) return `Volatility ${m[1]} Index`;
  if ((m = /^1HZ(\d+)V$/i.exec(s))) return `Volatility ${m[1]} (1s) Index`;
  if ((m = /^BOOM(\d+)N?$/i.exec(s))) return `Boom ${m[1]} Index`;
  if ((m = /^CRASH(\d+)N?$/i.exec(s))) return `Crash ${m[1]} Index`;
  if ((m = /^JD(\d+)$/i.exec(s))) return `Jump ${m[1]} Index`;
  if (/^stpRNG$/i.test(s)) return 'Step Index';
  if (/^RDBULL$/i.test(s)) return 'Bull Market Index';
  if (/^RDBEAR$/i.test(s)) return 'Bear Market Index';
  return s;
}

/** Full name with the raw code appended, e.g. "Volatility 75 Index (R_75)".
 * Returns just the name when it has no mapping (name === code). */
export function formatSymbolLong(symbol: string): string {
  const name = formatSymbolName(symbol);
  return name === symbol ? symbol : `${name} (${symbol})`;
}
