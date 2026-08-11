# Setup

## Prerequisites
- Node.js 20+ (Node 22+ recommended — the Deriv client uses the global WebSocket).
- npm.

## Install & run (demo mode)
```bash
npm install
npm run dev      # http://localhost:3000 — runs fully without credentials
```
Demo mode uses labelled synthetic data through the real engine/backtester.

## Configure services (optional, incremental)
Copy the template and fill in only what you need:
```bash
cp .env.example .env.local
```

### Supabase (persistence + auth)
1. Create a project at supabase.com.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Apply the schema: `supabase db push` (or paste `supabase/migrations/0001_init.sql`).

### Deriv (live market data)
1. Register an app at api.deriv.com to get an app id.
2. Set `DERIV_APP_ID`, optionally `DERIV_WS_URL`.
3. For account features (balance/trading), set `DERIV_API_TOKEN` — **server-side**.
   The token is never exposed to the browser. Verify contract semantics against
   current Deriv docs before enabling live trading.

### Telegram (optional alerts)
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (from @BotFather).

### AI explanations (optional)
Set `AI_API_KEY` and `AI_MODEL`. Explanations are generated only for qualified
signals / on request (cost control, spec §67).

## Verify
```bash
npm run test       # 45 tests
npm run lint
npm run build
```

## Notes
- Live trading requires a Deriv token **and** explicit in-app enablement — VoltaX
  never switches paper→live automatically.
- Without a service, its page shows a clear "configuration required" state rather
  than failing.
