/**
 * Current Deriv Options account connection. SERVER-SIDE ONLY.
 *
 * Public market data uses a public socket; account balance and execution use a
 * short-lived OTP created with a Personal Access Token (PAT). This prevents the
 * app from accidentally reading a virtual account or sending a private token to
 * the browser.
 */
import { getDerivConfig } from './config';

interface DerivSocketError { error?: { message?: string }; req_id?: number; }

export interface DerivAccountSummary {
  connected: boolean;
  balance?: number;
  currency?: string;
  isVirtual?: boolean;
  accountId?: string;
  error?: string;
}

export class DerivAccountSocket {
  private requestId = 0;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  private constructor(private readonly socket: WebSocket, readonly isVirtual: boolean) {
    socket.addEventListener('message', (event) => this.onMessage(event));
    socket.addEventListener('close', () => this.rejectAll(new Error('Deriv account connection closed')));
  }

  static async open(): Promise<DerivAccountSocket> {
    const cfg = getDerivConfig();
    if (!cfg.configured || !cfg.config?.token || !cfg.config.accountId) {
      throw new Error('Set DERIV_API_TOKEN and DERIV_ACCOUNT_ID to connect to a Deriv account.');
    }

    const response = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(cfg.config.accountId)}/otp`,
      {
        method: 'POST',
        headers: { 'Deriv-App-ID': cfg.config.appId, Authorization: `Bearer ${cfg.config.token}` },
        cache: 'no-store',
      },
    );
    const body = (await response.json().catch(() => null)) as { data?: { url?: string }; errors?: Array<{ message?: string }> } | null;
    const url = body?.data?.url;
    if (!response.ok || !url) {
      throw new Error(body?.errors?.[0]?.message ?? `Deriv account authentication failed (${response.status})`);
    }

    const socket = await openSocket(url);
    return new DerivAccountSocket(socket, url.includes('/ws/demo'));
  }

  request<T>(payload: Record<string, unknown>, timeoutMs = 12_000): Promise<T> {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Deriv account connection is not open'));
    const reqId = ++this.requestId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error('Deriv account request timed out'));
      }, timeoutMs);
      this.pending.set(reqId, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.socket.send(JSON.stringify({ ...payload, req_id: reqId }));
    });
  }

  close(): void { this.socket.close(); }

  private onMessage(event: MessageEvent): void {
    let message: DerivSocketError & Record<string, unknown>;
    try { message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)); } catch { return; }
    const reqId = message.req_id ?? (message.echo_req as { req_id?: number } | undefined)?.req_id;
    if (typeof reqId !== 'number') return;
    const pending = this.pending.get(reqId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(reqId);
    if (message.error?.message) pending.reject(new Error(message.error.message));
    else pending.resolve(message);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
}

export async function getDerivAccountSummary(): Promise<DerivAccountSummary> {
  const cfg = getDerivConfig();
  if (!cfg.hasAccount || !cfg.config?.accountId) {
    return { connected: false, error: 'Set DERIV_API_TOKEN and DERIV_ACCOUNT_ID for the account you want to use.' };
  }
  let account: DerivAccountSocket | null = null;
  try {
    account = await DerivAccountSocket.open();
    const response = await account.request<{ balance?: { balance?: number; currency?: string } }>({ balance: 1 });
    const balance = response.balance?.balance;
    const currency = response.balance?.currency;
    if (typeof balance !== 'number' || !currency) throw new Error('Deriv returned no account balance');
    return { connected: true, balance, currency, isVirtual: account.isVirtual, accountId: cfg.config.accountId };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : 'Could not connect to the Deriv account.' };
  } finally {
    account?.close();
  }
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => { socket.close(); reject(new Error('Deriv account WebSocket connection timed out')); }, 12_000);
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve(socket); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Deriv account WebSocket connection failed')); }, { once: true });
  });
}
