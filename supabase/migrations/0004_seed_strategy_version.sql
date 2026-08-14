-- ============================================================================
-- Seed the baseline methodology version so signal inserts satisfy the FK
-- (signals.methodology_version -> strategy_versions.version). The app also
-- self-heals this via the service role, so running this manually is optional.
-- Idempotent.
-- ============================================================================

insert into strategy_versions (version, config, notes)
values ('VOLTAX-METHOD-1.0.0', '{}'::jsonb, 'baseline methodology')
on conflict (version) do nothing;
