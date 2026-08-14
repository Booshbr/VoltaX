import { describe, it, expect, afterEach } from 'vitest';
import { buildQualifiedNotification, selectNewQualified, type QualifiedSignalInput } from '@/lib/notifications/inapp';
import { telegramButtonUrl } from '@/lib/notifications/index';

const sig = (over: Partial<QualifiedSignalInput> = {}): QualifiedSignalInput => ({
  symbol: 'R_75',
  direction: 'long',
  reliability: 82,
  opportunityScore: 71,
  riskReward: 2,
  entry: 52000,
  stopLoss: 51900,
  takeProfits: [52200, 52300],
  methodologyVersion: 'VOLTAX-METHOD-1.0.0',
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
    expect(notification.body).toMatch(/Entry: 52,000/);
    expect(notification.body).toMatch(/Stop loss: 51,900/);
    expect(notification.body).toMatch(/TP1: 52,200/);
  });

  it('distinguishes direction in the key', () => {
    expect(buildQualifiedNotification(sig({ direction: 'short' })).key).toBe('qualified:R_75:short');
  });
});

describe('deep links', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it('adds a public signal URL when the app URL is a public https origin', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://volta-x.vercel.app';
    expect(buildQualifiedNotification(sig()).notification.url).toBe('https://volta-x.vercel.app/signals/R_75');
  });

  it('omits the URL for a localhost dev app URL (no broken links)', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    expect(buildQualifiedNotification(sig()).notification.url).toBeUndefined();
  });
});

describe('telegramButtonUrl', () => {
  it('accepts a public https URL', () => {
    expect(telegramButtonUrl('https://volta-x.vercel.app/signals/R_75')).toBe('https://volta-x.vercel.app/signals/R_75');
  });
  it('rejects http, localhost, and malformed URLs', () => {
    expect(telegramButtonUrl('http://volta-x.vercel.app')).toBeNull();
    expect(telegramButtonUrl('https://localhost:3000/x')).toBeNull();
    expect(telegramButtonUrl('not a url')).toBeNull();
    expect(telegramButtonUrl(undefined)).toBeNull();
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
