import { describe, it, expect } from 'vitest';
import { formatSymbolName, formatSymbolLong } from '@/lib/utils/format';

describe('formatSymbolName', () => {
  it('maps volatility index codes', () => {
    expect(formatSymbolName('R_75')).toBe('Volatility 75 Index');
    expect(formatSymbolName('R_100')).toBe('Volatility 100 Index');
  });

  it('maps 1-second volatility codes', () => {
    expect(formatSymbolName('1HZ75V')).toBe('Volatility 75 (1s) Index');
    expect(formatSymbolName('1HZ10V')).toBe('Volatility 10 (1s) Index');
  });

  it('maps boom and crash codes', () => {
    expect(formatSymbolName('BOOM1000')).toBe('Boom 1000 Index');
    expect(formatSymbolName('BOOM300N')).toBe('Boom 300 Index');
    expect(formatSymbolName('CRASH500')).toBe('Crash 500 Index');
    expect(formatSymbolName('CRASH300N')).toBe('Crash 300 Index');
  });

  it('maps step / jump / bull / bear', () => {
    expect(formatSymbolName('stpRNG')).toBe('Step Index');
    expect(formatSymbolName('JD100')).toBe('Jump 100 Index');
    expect(formatSymbolName('RDBULL')).toBe('Bull Market Index');
  });

  it('returns unknown codes unchanged', () => {
    expect(formatSymbolName('WLDAUD')).toBe('WLDAUD');
    expect(formatSymbolName('')).toBe('');
  });

  it('formatSymbolLong appends the code, or just the code when unmapped', () => {
    expect(formatSymbolLong('R_75')).toBe('Volatility 75 Index (R_75)');
    expect(formatSymbolLong('WLDAUD')).toBe('WLDAUD');
  });
});
