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
