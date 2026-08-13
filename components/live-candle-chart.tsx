'use client';

import { useEffect, useRef, useState } from 'react';
import { CandleChart } from './candle-chart';
import type { Candle, SwingPoint, Timeframe, Zone } from '@/lib/types';
import { TIMEFRAME_SECONDS } from '@/lib/types';

interface Level {
  price: number;
  label: string;
  tone: 'bull' | 'bear' | 'accent';
}

type StreamState = 'connecting' | 'live' | 'reconnecting' | 'offline';

/**
 * Displays the server-fetched candle history, then keeps the newest candle in
 * sync with Deriv's public tick stream. Public market data needs no account token;
 * client updates are deliberately visual only and never alter engine signals.
 */
export function LiveCandleChart({
  symbol,
  timeframe,
  candles: initialCandles,
  levels,
  swings,
  zones,
}: {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  levels: Level[];
  swings: SwingPoint[];
  zones: Zone[];
}) {
  const [candles, setCandles] = useState(initialCandles);
  const [state, setState] = useState<StreamState>('connecting');
  const pendingPrice = useRef<{ epoch: number; quote: number } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCandles(initialCandles);
  }, [initialCandles]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let attempts = 0;

    const flush = () => {
      flushTimer.current = null;
      const tick = pendingPrice.current;
      pendingPrice.current = null;
      if (!tick) return;
      const seconds = TIMEFRAME_SECONDS[timeframe];
      const bucket = Math.floor(tick.epoch / seconds) * seconds;
      setCandles((current) => mergeTick(current, bucket, tick.quote));
    };

    const scheduleFlush = () => {
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, 250);
    };

    const connect = () => {
      if (stopped) return;
      setState(attempts ? 'reconnecting' : 'connecting');
      // Deriv documents this unauthenticated public endpoint for live market data.
      socket = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
      socket.onopen = () => {
        attempts = 0;
        socket?.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        setState('live');
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            msg_type?: string;
            tick?: { epoch?: number; quote?: number; symbol?: string };
          };
          if (message.msg_type !== 'tick' || message.tick?.symbol !== symbol) return;
          const { epoch, quote } = message.tick;
          if (typeof epoch !== 'number' || typeof quote !== 'number') return;
          pendingPrice.current = { epoch, quote };
          scheduleFlush();
        } catch {
          // Ignore one malformed provider message; leave the last verified candle visible.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (stopped) return;
        attempts += 1;
        setState(attempts > 3 ? 'offline' : 'reconnecting');
        reconnectTimer = setTimeout(connect, Math.min(15_000, 1_000 * 2 ** Math.min(attempts, 4)));
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      socket?.close();
    };
  }, [symbol, timeframe]);

  const copy: Record<StreamState, string> = {
    connecting: 'Connecting to live ticks…',
    live: 'Live tick stream',
    reconnecting: 'Reconnecting to live ticks…',
    offline: 'Live ticks unavailable — showing the last verified candles',
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted" aria-live="polite">
        <span className={`h-2 w-2 rounded-full ${state === 'live' ? 'bg-bull' : state === 'offline' ? 'bg-warn' : 'animate-pulse bg-accent'}`} aria-hidden />
        {copy[state]}
      </div>
      <CandleChart candles={candles} levels={levels} swings={swings} zones={zones} height={360} />
    </div>
  );
}

function mergeTick(candles: Candle[], time: number, price: number): Candle[] {
  if (candles.length === 0) return candles;
  const last = candles[candles.length - 1]!;
  if (time < last.time) return candles;
  if (time === last.time) {
    return [...candles.slice(0, -1), { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price }];
  }
  const next: Candle = { time, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price };
  return [...candles, next].slice(-140);
}
