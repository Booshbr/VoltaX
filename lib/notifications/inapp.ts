/** Pure qualified-signal notification builders. */
import type { AppNotification } from './index';

export interface StoredNotification extends AppNotification {
  id: string;
  key: string;
  read: boolean;
  createdAt: string;
}

export interface QualifiedSignalInput {
  symbol: string;
  direction: 'long' | 'short';
  reliability: number;
  opportunityScore: number;
  riskReward: number;
  entry: number;
  stopLoss: number;
  takeProfits: number[];
  methodologyVersion: string;
}

/** Public base URL for deep links. Only a public https origin qualifies, so a
 * localhost dev value never produces a broken alert link. */
export function publicBaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return undefined;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return undefined;
    return u.origin;
  } catch {
    return undefined;
  }
}

function signalUrl(symbol: string): string | undefined {
  const base = publicBaseUrl();
  return base ? `${base}/signals/${encodeURIComponent(symbol)}` : undefined;
}

/** Build a detailed and still evidence-bound alert. */
export function buildQualifiedNotification(s: QualifiedSignalInput): { key: string; notification: AppNotification } {
  const direction = s.direction === 'long' ? '🟢 BUY / LONG' : '🔴 SELL / SHORT';
  const targets = s.takeProfits.map((price, index) => `🎯 TP${index + 1}: ${formatPrice(price)}`).join('\n');
  return {
    key: `qualified:${s.symbol}:${s.direction}`,
    notification: {
      kind: 'qualified_signal',
      title: `📈 Qualified signal — ${s.symbol}`,
      url: signalUrl(s.symbol),
      body: [
        direction,
        '',
        `📍 Entry: ${formatPrice(s.entry)}`,
        `🛑 Stop loss: ${formatPrice(s.stopLoss)}`,
        targets,
        '',
        `📊 Historical reliability: ${Math.round(s.reliability)}%`,
        `⚖️ Risk:reward: 1:${s.riskReward.toFixed(1)}`,
        `✨ Opportunity score: ${s.opportunityScore}/100`,
        `🧭 Method: ${s.methodologyVersion}`,
        '',
        '⚠️ Analysis only — historical performance is not a guarantee.',
      ].join('\n'),
    },
  };
}

/** Warn (once per stale episode) that live data has gone stale and new alerts are
 * paused — the fail-safe response to an unreliable feed (spec §4). */
export function buildFeedStaleNotification(minutesStale: number): AppNotification {
  return {
    kind: 'data_feed_failure',
    title: '⚠️ Data feed stale — alerts paused',
    url: publicBaseUrl() ? `${publicBaseUrl()}/data-quality` : undefined,
    body: [
      `The market data feed has not updated in ~${Math.round(minutesStale)} min.`,
      '',
      'VoltaX has paused NEW signal alerts until the feed recovers (fail-safe).',
      'No action needed — you will be alerted again once live data resumes.',
    ].join('\n'),
  };
}

/** From current qualified signals, return only those whose key has not been seen. */
export function selectNewQualified(current: QualifiedSignalInput[], seenKeys: Iterable<string>): { key: string; notification: AppNotification }[] {
  const seen = new Set(seenKeys);
  return current.map(buildQualifiedNotification).filter((item) => !seen.has(item.key));
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(price);
}
