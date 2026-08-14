-- ============================================================================
-- VoltaX signal outcomes (spec §2, §26). System-wide record of qualified signals
-- and how they actually resolved (win / loss / expired), written by the scheduled
-- cron via the service-role client and read by any authenticated user. This makes
-- "historical reliability" evidence-based rather than purely backtested.
--
-- Not user-owned: outcomes describe the shared engine's public signals, so they
-- follow the reference-data pattern (authenticated read; service-role writes only).
-- ============================================================================

create table if not exists signal_outcomes (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null,
  family        text not null,
  direction     text not null check (direction in ('long','short')),
  entry         numeric not null,
  stop_loss     numeric not null,
  take_profit   numeric not null,
  risk_reward   numeric not null,
  methodology_version text not null,
  -- One open outcome per signal instance: symbol:direction:method:hour-bucket.
  dedup_key     text not null unique,
  status        text not null default 'pending' check (status in ('pending','win','loss','expired')),
  resolution_price numeric,
  resolved_at   timestamptz,
  bars_to_resolve int,
  created_at    timestamptz not null default now()
);
create index if not exists idx_signal_outcomes_status on signal_outcomes(status);
create index if not exists idx_signal_outcomes_symbol on signal_outcomes(symbol, created_at desc);

alter table signal_outcomes enable row level security;

-- Readable by any authenticated user; writes reserved to the service role
-- (which bypasses RLS, so no write policy is granted to normal users).
create policy "read signal outcomes" on signal_outcomes
  for select using (auth.role() = 'authenticated');
