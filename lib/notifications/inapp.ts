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

/** Build a detailed and still evidence-bound alert. */
export function buildQualifiedNotification(s: QualifiedSignalInput): { key: string; notification: AppNotification } {
  const direction = s.direction === 'long' ? '🟢 BUY / LONG' : '🔴 SELL / SHORT';
  const targets = s.takeProfits.map((price, index) => `🎯 TP${index + 1}: ${formatPrice(price)}`).join('\n');
  return {
    key: `qualified:${s.symbol}:${s.direction}`,
    notification: {
      kind: 'qualified_signal',
      title: `📈 Qualified signal — ${s.symbol}`,
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

/** From current qualified signals, return only those whose key has not been seen. */
export function selectNewQualified(current: QualifiedSignalInput[], seenKeys: Iterable<string>): { key: string; notification: AppNotification }[] {
  const seen = new Set(seenKeys);
  return current.map(buildQualifiedNotification).filter((item) => !seen.has(item.key));
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(price);
}
