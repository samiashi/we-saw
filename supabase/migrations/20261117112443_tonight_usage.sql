-- One bounded counter per household. Never stores prompts, responses, or viewing history.
create table if not exists public.tonight_usage (
  household_id uuid primary key references public.households (id) on delete cascade,
  usage_day date not null,
  request_count integer not null check (request_count between 1 and 20),
  last_requested_at timestamptz not null
);
alter table public.tonight_usage enable row level security;
revoke all on public.tonight_usage from public, anon, authenticated;
grant select on public.tonight_usage to authenticated;
drop policy if exists "Households can read their AI usage" on public.tonight_usage;
create policy "Households can read their AI usage" on public.tonight_usage
  for select to authenticated using (household_id = (select public.my_household_id()));

-- The only writer. Derives tenancy from the verified caller, takes no IDs or counts,
-- and serializes concurrent requests with a conditional upsert. Authenticated callers
-- can consume their own quota, but cannot reset it or access another household's quota.
create or replace function public.consume_tonight_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid;
  today date := (now() at time zone 'UTC')::date;
  consumed boolean := false;
begin
  if auth.uid() is null then return false; end if;
  select m.household_id into target_household from public.members m where m.user_id = auth.uid();
  if target_household is null then return false; end if;
  insert into public.tonight_usage as usage (household_id, usage_day, request_count, last_requested_at)
  values (target_household, today, 1, now())
  on conflict (household_id) do update
    set usage_day = excluded.usage_day,
        request_count = case when usage.usage_day < today then 1 else usage.request_count + 1 end,
        last_requested_at = now()
    where (usage.usage_day < today or usage.request_count < 20)
      and usage.last_requested_at <= now() - interval '8 seconds'
  returning true into consumed;
  return coalesce(consumed, false);
end;
$$;
revoke all on function public.consume_tonight_request() from public, anon;
grant execute on function public.consume_tonight_request() to authenticated;
