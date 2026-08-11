-- ============================================================================
-- VoltaX initial schema (spec §10). PostgreSQL + Row Level Security.
-- Single-user today, multi-user ready: every user-owned row carries user_id and
-- is protected by RLS so authorization is enforced in the database, never trusted
-- from the client (spec §31, §41, §70).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reference data: instruments & families (not user-owned; readable by all auth)
-- ---------------------------------------------------------------------------
create table if not exists instrument_families (
  id           text primary key,              -- 'volatility', 'boom', ...
  label        text not null,
  characteristics text[] not null default '{}'
);

create table if not exists instruments (
  symbol        text primary key,             -- provider symbol, e.g. 'R_75'
  display_name  text not null,
  family        text not null references instrument_families(id),
  pip           numeric not null default 0.01,
  active        boolean not null default true,
  metadata      jsonb not null default '{}',
  updated_at    timestamptz not null default now()
);
create index if not exists idx_instruments_family on instruments(family);

-- ---------------------------------------------------------------------------
-- Profiles & settings (user-owned)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

create table if not exists user_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  theme       text not null default 'system' check (theme in ('dark','light','system')),
  trading_mode text not null default 'paper' check (trading_mode in ('paper','live')),
  risk_config jsonb not null default '{}',
  signal_prefs jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Strategy versioning (spec §34)
-- ---------------------------------------------------------------------------
create table if not exists strategy_versions (
  version     text primary key,               -- 'VOLTAX-METHOD-1.0.0'
  config      jsonb not null,
  created_at  timestamptz not null default now(),
  notes       text
);

-- ---------------------------------------------------------------------------
-- Candles (time-series). Composite PK keeps them unique per symbol/tf/time.
-- ---------------------------------------------------------------------------
create table if not exists candles (
  symbol      text not null references instruments(symbol) on delete cascade,
  timeframe   text not null,
  time        bigint not null,                -- unix seconds, candle open
  open        numeric not null,
  high        numeric not null,
  low         numeric not null,
  close       numeric not null,
  volume      numeric,
  primary key (symbol, timeframe, time)
);
create index if not exists idx_candles_symbol_tf_time on candles(symbol, timeframe, time desc);

-- ---------------------------------------------------------------------------
-- Signals (immutable record) + lifecycle events + structured reasons (spec §11,§12)
-- ---------------------------------------------------------------------------
create table if not exists signals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  instrument_symbol text not null references instruments(symbol),
  instrument_family text not null,
  direction     text not null check (direction in ('long','short')),
  mode          text not null check (mode in ('structure','setup','entry','precision')),
  status        text not null,
  entry_price   numeric not null,
  stop_loss     numeric not null,
  take_profits  jsonb not null default '[]',
  risk_reward   numeric not null,
  reliability_score numeric not null,
  opportunity_score numeric not null,
  methodology_version text not null references strategy_versions(version),
  market_context jsonb not null default '{}',
  setup_context jsonb not null default '{}',
  entry_context jsonb not null default '{}',
  risk_context  jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_signals_user_created on signals(user_id, created_at desc);
create index if not exists idx_signals_symbol on signals(instrument_symbol);
create index if not exists idx_signals_status on signals(status);

create table if not exists signal_reasons (
  id          uuid primary key default gen_random_uuid(),
  signal_id   uuid not null references signals(id) on delete cascade,
  category    text not null,
  code        text not null,
  text        text not null,
  polarity    text not null check (polarity in ('supporting','cautionary'))
);
create index if not exists idx_signal_reasons_signal on signal_reasons(signal_id);

create table if not exists signal_events (
  id          uuid primary key default gen_random_uuid(),
  signal_id   uuid not null references signals(id) on delete cascade,
  from_status text not null,
  to_status   text not null,
  price       numeric,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_signal_events_signal on signal_events(signal_id, created_at);

-- ---------------------------------------------------------------------------
-- Trades: paper & live are separated by table (spec §17, §18)
-- ---------------------------------------------------------------------------
create table if not exists paper_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  signal_id   uuid references signals(id) on delete set null,
  symbol      text not null,
  direction   text not null check (direction in ('long','short')),
  size        numeric not null,
  entry_price numeric not null,
  stop_loss   numeric not null,
  take_profit numeric,
  status      text not null default 'open',
  pnl         numeric,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz
);
create index if not exists idx_paper_trades_user on paper_trades(user_id, opened_at desc);

create table if not exists live_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  signal_id   uuid references signals(id) on delete set null,
  provider_ref text,                          -- Deriv contract id
  symbol      text not null,
  direction   text not null check (direction in ('long','short')),
  size        numeric not null,
  entry_price numeric not null,
  stop_loss   numeric not null,
  take_profit numeric,
  status      text not null default 'pending',
  pnl         numeric,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz
);
create index if not exists idx_live_trades_user on live_trades(user_id, opened_at desc);

-- ---------------------------------------------------------------------------
-- Backtesting (spec §15)
-- ---------------------------------------------------------------------------
create table if not exists backtest_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  symbol      text not null,
  methodology_version text not null,
  params      jsonb not null default '{}',
  metrics     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_backtest_runs_user on backtest_runs(user_id, created_at desc);

create table if not exists backtest_trades (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references backtest_runs(id) on delete cascade,
  direction   text not null,
  entry_time  bigint not null,
  entry_price numeric not null,
  exit_time   bigint not null,
  exit_price  numeric not null,
  result      text not null,
  r_multiple  numeric not null
);
create index if not exists idx_backtest_trades_run on backtest_trades(run_id);

-- ---------------------------------------------------------------------------
-- Performance, alerts, audit (spec §26, §28, §44)
-- ---------------------------------------------------------------------------
create table if not exists performance_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  scope       text not null,                  -- 'overall' | 'symbol:R_75' | ...
  metrics     jsonb not null default '{}',
  captured_at timestamptz not null default now()
);
create index if not exists idx_perf_user on performance_snapshots(user_id, captured_at desc);

create table if not exists alert_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  browser     boolean not null default true,
  telegram    boolean not null default false,
  in_app      boolean not null default true,
  min_reliability numeric not null default 55
);

create table if not exists notification_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notif_user on notification_events(user_id, created_at desc);

create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  event       text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_user on audit_logs(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles              enable row level security;
alter table user_settings         enable row level security;
alter table signals               enable row level security;
alter table signal_reasons        enable row level security;
alter table signal_events         enable row level security;
alter table paper_trades          enable row level security;
alter table live_trades           enable row level security;
alter table backtest_runs         enable row level security;
alter table backtest_trades       enable row level security;
alter table performance_snapshots enable row level security;
alter table alert_preferences     enable row level security;
alter table notification_events   enable row level security;
alter table audit_logs            enable row level security;

-- Reference tables: readable by any authenticated user, writable by service role only.
alter table instruments           enable row level security;
alter table instrument_families   enable row level security;
alter table strategy_versions     enable row level security;
alter table candles               enable row level security;

do $$
begin
  -- Owner-scoped policies for user data.
  perform 1;
end $$;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own signals" on signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own paper trades" on paper_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own live trades" on live_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own backtests" on backtest_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own perf" on performance_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own alert prefs" on alert_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on notification_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own audit" on audit_logs
  for select using (auth.uid() = user_id);

-- Child rows are reachable only through an owned parent signal.
create policy "reasons via own signal" on signal_reasons
  for all using (exists (select 1 from signals s where s.id = signal_id and s.user_id = auth.uid()));
create policy "events via own signal" on signal_events
  for all using (exists (select 1 from signals s where s.id = signal_id and s.user_id = auth.uid()));
create policy "bt trades via own run" on backtest_trades
  for all using (exists (select 1 from backtest_runs r where r.id = run_id and r.user_id = auth.uid()));

-- Reference data: read for authenticated users; writes reserved to service role
-- (service role bypasses RLS, so no write policy is granted to normal users).
create policy "read instruments" on instruments for select using (auth.role() = 'authenticated');
create policy "read families" on instrument_families for select using (auth.role() = 'authenticated');
create policy "read strategy" on strategy_versions for select using (auth.role() = 'authenticated');
create policy "read candles" on candles for select using (auth.role() = 'authenticated');
