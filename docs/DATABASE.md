# Database (Supabase / PostgreSQL)

Schema: `supabase/migrations/0001_init.sql`. Single-user today, multi-user ready:
every user-owned row carries `user_id` and is protected by Row Level Security, so
authorization is enforced in the database (spec §10, §31, §70).

## Tables (summary)
- **Reference**: `instrument_families`, `instruments`, `strategy_versions`,
  `candles` (time-series, composite PK `symbol,timeframe,time`).
- **User**: `profiles`, `user_settings`.
- **Signals**: `signals` (immutable record), `signal_reasons`, `signal_events`
  (immutable lifecycle log).
- **Trading**: `paper_trades`, `live_trades` (separated on purpose, spec §17/§18).
- **Backtesting**: `backtest_runs`, `backtest_trades`.
- **Analytics/ops**: `performance_snapshots`, `alert_preferences`,
  `notification_events`, `audit_logs`.

## RLS
- User tables: `auth.uid() = user_id` for both `using` and `with check`.
- Child rows (`signal_reasons`, `signal_events`, `backtest_trades`) are reachable
  only via an owned parent.
- Reference tables: readable by authenticated users; writes are reserved to the
  service role (which bypasses RLS) — no user write policy is granted.

## Indexes
Time-series and lookup patterns are indexed: `candles(symbol,timeframe,time desc)`,
`signals(user_id,created_at desc)`, plus per-status/symbol and per-user indexes on
trades, backtests, performance, notifications and audit.

## Applying migrations
```bash
# with the Supabase CLI, linked to your project:
supabase db push
# or paste supabase/migrations/0001_init.sql into the SQL editor.
```

## Clients
- `lib/supabase/client.ts` — browser client (anon key, RLS-gated). Returns null
  when unconfigured so the UI shows a configuration state instead of crashing.
- `lib/supabase/server.ts` — server client wired to Next cookies; `getCurrentUser`
  for server-side auth checks (never trust the client, spec §31).
- The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only and never
  bundled into the client.
