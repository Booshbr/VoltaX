-- ============================================================================
-- VoltaX Web Push subscriptions (spec §28, §29). One row per browser/device the
-- user has opted into native push on. User-owned + RLS; the scheduled cron reads
-- them via the service role to deliver alerts. Endpoints are unique so re-subscribing
-- the same device updates in place.
-- ============================================================================

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_push_subs_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
