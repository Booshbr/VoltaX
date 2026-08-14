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

  const base = { amount: 1, basis: 'stake', currency: 'USD', multiplier: 100 };
  const variants: Array<{ label: string; payload: Record<string, unknown> }> = [
    { label: 'bare-proposal (reveals required fields)', payload: { proposal: 1 } },
    { label: 'classic symbol + MULTUP', payload: { proposal: 1, ...base, contract_type: 'MULTUP', symbol } },
    { label: 'underlying instead of symbol', payload: { proposal: 1, ...base, contract_type: 'MULTUP', underlying: symbol } },
    { label: 'instrument instead of symbol', payload: { proposal: 1, ...base, contract_type: 'MULTUP', instrument: symbol } },
    { label: 'symbol + product_type multiplier', payload: { proposal: 1, ...base, contract_type: 'MULTUP', symbol, product_type: 'multiplier' } },
    { label: 'symbol + limit_order', payload: { proposal: 1, ...base, contract_type: 'MULTUP', symbol, limit_order: { stop_loss: 0.5 } } },
    { label: 'CALL (rise) symbol + duration', payload: { proposal: 1, amount: 1, basis: 'stake', currency: 'USD', contract_type: 'CALL', symbol, duration: 5, duration_unit: 't' } },
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
