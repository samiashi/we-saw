-- Run only against a disposable empty Postgres database, never a linked project:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/tonight-usage.sql
begin;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to authenticated, anon;
create table public.households (id uuid primary key);
create table public.members (user_id uuid primary key, household_id uuid references public.households);
create function public.my_household_id() returns uuid language sql stable security definer set search_path = '' as $$
  select household_id from public.members where user_id = auth.uid();
$$;
insert into public.households values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.members values ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000002');
\ir ../supabase/migrations/20261117112443_tonight_usage.sql

-- Anonymous and non-members cannot spend.
do $$ begin
  assert not has_function_privilege('anon', 'public.consume_tonight_request()', 'execute');
  assert not public.consume_tonight_request();
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
do $$ begin assert not public.consume_tonight_request(); end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
do $$ begin
  assert public.consume_tonight_request();
  assert not public.consume_tonight_request(), 'Cooldown must reject immediate second request';
  assert (select request_count = 1 from public.tonight_usage);
  assert not has_table_privilege(current_user, 'public.tonight_usage', 'update');
  assert not has_table_privilege(current_user, 'public.tonight_usage', 'delete');
end $$;
reset role;
update public.tonight_usage set request_count = 19, last_requested_at = now() - interval '9 seconds';
set local role authenticated;
do $$ begin assert public.consume_tonight_request(); end $$;
reset role;
update public.tonight_usage set last_requested_at = now() - interval '9 seconds';
set local role authenticated;
do $$ begin assert not public.consume_tonight_request(), 'Daily cap must reject request 21'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
do $$ begin
  assert (select count(*) = 0 from public.tonight_usage), 'Other household counter must be invisible';
  assert public.consume_tonight_request(), 'Other household quota is independent';
  assert (select count(*) = 1 from public.tonight_usage);
end $$;
reset role;
update public.tonight_usage set usage_day = (now() at time zone 'UTC')::date - 1, request_count = 20, last_requested_at = now() - interval '1 day';
set local role authenticated;
do $$ begin
  assert public.consume_tonight_request(), 'Next UTC day resets quota';
  assert (select request_count = 1 from public.tonight_usage);
end $$;
rollback;
\echo 'PASS: authenticated quota, cooldown, daily cap, RLS, write protection and next-day reset'
