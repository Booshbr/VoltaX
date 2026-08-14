-- ============================================================================
-- Grant the Supabase API roles table-level privileges on the public schema.
-- RLS policies decide WHICH ROWS a user can touch, but PostgREST still needs a
-- base GRANT to touch the table at all. Tables created via raw SQL migrations
-- don't get these automatically, which caused "permission denied for table ..."
-- on session-client writes (e.g. user_settings, signals). Row access stays
-- governed by the existing RLS policies. Idempotent.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;

-- Ensure any future tables/sequences created by the owner inherit the same grants.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
