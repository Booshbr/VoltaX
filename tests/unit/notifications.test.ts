import { describe, it, expect } from 'vitest';
import { buildQualifiedNotification, selectNewQualified, type QualifiedSignalInput } from '@/lib/notifications/inapp';

const sig = (over: Partial<QualifiedSignalInput> = {}): QualifiedSignalInput => ({
  symbol: 'R_75',
  direction: 'long',
  reliability: 82,
  opportunityScore: 71,
  riskReward: 2,
  ...over,
});

describe('buildQualifiedNotification', () => {
  it('builds a stable key and human-readable body', () => {
    const { key, notification } = buildQualifiedNotification(sig());
    expect(key).toBe('qualified:R_75:long');
    expect(notification.kind).toBe('qualified_signal');
    expect(notification.title).toContain('R_75');
    expect(notification.body).toMatch(/BUY/);
    expect(notification.body).toMatch(/82%/);
  });

  it('distinguishes direction in the key', () => {
    expect(buildQualifiedNotification(sig({ direction: 'short' })).key).toBe('qualified:R_75:short');
  });
});

describe('selectNewQualified', () => {
  it('returns only unseen signals', () => {
    const current = [sig({ symbol: 'R_75' }), sig({ symbol: 'BOOM500', direction: 'short' })];
    const seen = ['qualified:R_75:long'];
    const fresh = selectNewQualified(current, seen);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.key).toBe('qualified:BOOM500:short');
  });

  it('returns nothing when all are seen', () => {
    const current = [sig()];
    expect(selectNewQualified(current, ['qualified:R_75:long'])).toHaveLength(0);
  });
});
