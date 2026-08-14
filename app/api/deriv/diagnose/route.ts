/**
 * SAFE order-schema probe (temporary diagnostic). Sends only `proposal` (price
 * quote) messages — NEVER a `buy` — so it spends no money. It tries several payload
 * shapes against the real Deriv Options socket and reports which one the API accepts,
 * so live-order execution can be built against the correct schema instead of guessed.
 *
 * Auth: session-gated by the proxy (you must be signed in). Pass ?symbol=BOOM300N to
 * probe the exact instrument you trade. Remove this route once execution is fixed.
 */
import { NextResponse } from 'next/server';
import { DerivAccountSocket } from '@/lib/deriv/account';
import { getDerivConfig } from '@/lib/deriv/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol') ?? 'R_100';
  if (!getDerivConfig().hasAccount) {
    return NextResponse.json({ ok: false, error: 'DERIV_API_TOKEN + DERIV_ACCOUNT_ID not configured.' });
  }

  // Confirmed from the bare-proposal error: required = currency, underlying_symbol,
  // contract_type. The instrument field is `underlying_symbol`. Now confirm the full
  // multiplier shape (multiplier + limit_order) and whether MULT* is valid here.
  const us = { currency: 'USD', underlying_symbol: symbol };
  const variants: Array<{ label: string; payload: Record<string, unknown> }> = [
    { label: 'A minimal MULTUP', payload: { proposal: 1, ...us, contract_type: 'MULTUP' } },
    { label: 'B + amount/basis', payload: { proposal: 1, ...us, contract_type: 'MULTUP', amount: 1, basis: 'stake' } },
    { label: 'C + multiplier', payload: { proposal: 1, ...us, contract_type: 'MULTUP', amount: 1, basis: 'stake', multiplier: 100 } },
    { label: 'D + limit_order (full multiplier)', payload: { proposal: 1, ...us, contract_type: 'MULTUP', amount: 1, basis: 'stake', multiplier: 100, limit_order: { stop_loss: 0.5, take_profit: 1 } } },
    { label: 'E MULTDOWN full', payload: { proposal: 1, ...us, contract_type: 'MULTDOWN', amount: 1, basis: 'stake', multiplier: 100, limit_order: { stop_loss: 0.5, take_profit: 1 } } },
    { label: 'F CALL rise + duration', payload: { proposal: 1, ...us, contract_type: 'CALL', amount: 1, basis: 'stake', duration: 5, duration_unit: 't' } },
  ];

  let client: DerivAccountSocket | null = null;
  const results: unknown[] = [];
  try {
    client = await DerivAccountSocket.open();
    for (const v of variants) {
      try {
        const res = await client.request<{ proposal?: { id?: string; ask_price?: number; display_value?: string } }>(v.payload, 9000);
        results.push({
          label: v.label,
          sent: v.payload,
          ok: true,
          proposal: res.proposal ? { id: res.proposal.id, ask_price: res.proposal.ask_price, display_value: res.proposal.display_value } : res,
        });
      } catch (err) {
        results.push({ label: v.label, sent: v.payload, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Could not open the Deriv account socket.' });
  } finally {
    client?.close();
  }

  return NextResponse.json({ ok: true, symbol, note: 'Quotes only — no orders were placed.', results }, { status: 200 });
}
