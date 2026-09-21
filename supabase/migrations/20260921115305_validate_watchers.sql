-- Every watcher on a watch must be a member of the watch's household, and a
-- watch must have at least one watcher. Guards against orphaned watcher ids
-- (the client falls back to "all members" when watchers is empty).
create or replace function public.validate_watchers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.watchers is null or cardinality(new.watchers) = 0 then
    raise exception 'A watch needs at least one watcher.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(new.watchers) as watcher(user_id)
    where not exists (
      select 1
      from public.members m
      where m.user_id = watcher.user_id
        and m.household_id = new.household_id
    )
  ) then
    raise exception 'Every watcher must be a member of the household.' using errcode = '23514';
  end if;

  return new;
end;
$$;

grant execute on function public.validate_watchers() to authenticated;

drop trigger if exists watches_validate_watchers on public.watches;
create trigger watches_validate_watchers
  before insert or update of watchers, household_id on public.watches
  for each row execute function public.validate_watchers();
