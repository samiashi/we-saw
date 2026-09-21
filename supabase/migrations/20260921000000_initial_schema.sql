create extension if not exists "pgcrypto";

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our household',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Member',
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.titles (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  title_id text not null references public.titles (id) on delete cascade,
  season int,
  watched_on date not null default current_date,
  note text not null default '',
  watchers uuid[] not null default '{}',
  picked_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  watch_id uuid not null references public.watches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score int not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (watch_id, user_id)
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  title_id text not null references public.titles (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'watching', 'dropped', 'done')),
  added_by uuid references auth.users (id) on delete set null,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, title_id)
);

create table if not exists public.invite_codes (
  code text primary key,
  created_by uuid references auth.users (id) on delete set null,
  household_id uuid references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  consumed_by uuid references auth.users (id) on delete set null,
  consumed_at timestamptz
);

create table if not exists public.app_invites (
  code text primary key,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_by uuid references auth.users (id) on delete set null,
  consumed_at timestamptz
);

create index if not exists members_household_idx on public.members (household_id);
create index if not exists watches_household_idx on public.watches (household_id);
create index if not exists invite_codes_household_idx on public.invite_codes (household_id);

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.members where user_id = auth.uid();
$$;

create or replace function public.is_watcher(target_watch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.watches where id = target_watch and auth.uid() = any (watchers));
$$;

create or replace function public.create_app_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.is_member() then
    raise exception 'Only members can invite other households.';
  end if;

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.app_invites (code, invited_by) values (new_code, auth.uid());
  return new_code;
end;
$$;

create or replace function public.create_household(
  household_name text,
  display_name text,
  invite_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  existing uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select household_id into existing from public.members where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;

  if exists (select 1 from public.households) then
    update public.app_invites
    set consumed_by = auth.uid(), consumed_at = now()
    where code = upper(trim(coalesce(invite_code, ''))) and consumed_at is null;

    if not found then
      raise exception 'A valid We Saw invite code is required to start a household.';
    end if;
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Our household'), auth.uid())
  returning id into new_id;

  insert into public.members (user_id, display_name, household_id)
  values (auth.uid(), coalesce(nullif(trim(display_name), ''), 'Member'), new_id);

  return new_id;
end;
$$;

create or replace function public.redeem_invite(invite_code text, display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if exists (select 1 from public.members where user_id = auth.uid()) then
    return;
  end if;

  update public.invite_codes
  set consumed_by = auth.uid(), consumed_at = now()
  where code = upper(trim(invite_code)) and consumed_at is null
  returning household_id into target;

  if not found then
    raise exception 'That invite code is not valid.';
  end if;

  insert into public.members (user_id, display_name, household_id)
  values (auth.uid(), coalesce(nullif(trim(display_name), ''), 'Member'), target);
end;
$$;

revoke all on function public.is_member() from public;
revoke all on function public.my_household_id() from public;
revoke all on function public.is_watcher(uuid) from public;
revoke all on function public.create_app_invite() from public;
revoke all on function public.create_household(text, text, text) from public;
revoke all on function public.redeem_invite(text, text) from public;
grant execute on function public.is_member() to authenticated;
grant execute on function public.my_household_id() to authenticated;
grant execute on function public.is_watcher(uuid) to authenticated;
grant execute on function public.create_app_invite() to authenticated;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.redeem_invite(text, text) to authenticated;

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.titles enable row level security;
alter table public.watches enable row level security;
alter table public.ratings enable row level security;
alter table public.list_items enable row level security;
alter table public.invite_codes enable row level security;
alter table public.app_invites enable row level security;

drop policy if exists "households read" on public.households;
create policy "households read" on public.households
  for select using (id = (select public.my_household_id()));

drop policy if exists "households update" on public.households;
create policy "households update" on public.households
  for update using (id = (select public.my_household_id()))
  with check (id = (select public.my_household_id()));

drop policy if exists "members read" on public.members;
create policy "members read" on public.members
  for select using (household_id = (select public.my_household_id()));

drop policy if exists "members update self" on public.members;
create policy "members update self" on public.members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update (household_id) on public.members from authenticated;
revoke update (user_id) on public.members from authenticated;

drop policy if exists "titles read" on public.titles;
create policy "titles read" on public.titles for select using (public.is_member());

drop policy if exists "titles insert" on public.titles;
create policy "titles insert" on public.titles for insert with check (public.is_member());

drop policy if exists "titles update" on public.titles;
create policy "titles update" on public.titles
  for update using (public.is_member()) with check (public.is_member());

drop policy if exists "watches read" on public.watches;
create policy "watches read" on public.watches
  for select using (household_id = (select public.my_household_id()));

drop policy if exists "watches insert" on public.watches;
create policy "watches insert" on public.watches
  for insert with check (
    public.is_member()
    and created_by = auth.uid()
    and auth.uid() = any (watchers)
    and household_id = (select public.my_household_id())
  );

drop policy if exists "watches update" on public.watches;
create policy "watches update" on public.watches
  for update using (household_id = (select public.my_household_id()))
  with check (household_id = (select public.my_household_id()));

drop policy if exists "watches delete" on public.watches;
create policy "watches delete" on public.watches
  for delete using (household_id = (select public.my_household_id()));

drop policy if exists "ratings read" on public.ratings;
create policy "ratings read" on public.ratings for select using (public.is_member());

drop policy if exists "ratings insert own" on public.ratings;
create policy "ratings insert own" on public.ratings
  for insert with check (public.is_member() and user_id = auth.uid() and public.is_watcher(watch_id));

drop policy if exists "ratings update own" on public.ratings;
create policy "ratings update own" on public.ratings
  for update using (public.is_member() and user_id = auth.uid() and public.is_watcher(watch_id))
  with check (public.is_member() and user_id = auth.uid() and public.is_watcher(watch_id));

drop policy if exists "ratings delete own" on public.ratings;
create policy "ratings delete own" on public.ratings
  for delete using (public.is_member() and user_id = auth.uid() and public.is_watcher(watch_id));

drop policy if exists "list read" on public.list_items;
create policy "list read" on public.list_items
  for select using (household_id = (select public.my_household_id()));

drop policy if exists "list insert" on public.list_items;
create policy "list insert" on public.list_items
  for insert with check (
    public.is_member()
    and added_by = auth.uid()
    and household_id = (select public.my_household_id())
  );

drop policy if exists "list update" on public.list_items;
create policy "list update" on public.list_items
  for update using (household_id = (select public.my_household_id()))
  with check (household_id = (select public.my_household_id()));

drop policy if exists "list delete" on public.list_items;
create policy "list delete" on public.list_items
  for delete using (household_id = (select public.my_household_id()));

drop policy if exists "invites read" on public.invite_codes;
create policy "invites read" on public.invite_codes
  for select using (household_id = (select public.my_household_id()));

drop policy if exists "invites insert" on public.invite_codes;
create policy "invites insert" on public.invite_codes
  for insert with check (
    public.is_member()
    and created_by = auth.uid()
    and household_id = (select public.my_household_id())
  );

drop policy if exists "invites delete" on public.invite_codes;
create policy "invites delete" on public.invite_codes
  for delete using (household_id = (select public.my_household_id()));

drop policy if exists "app invites read" on public.app_invites;
create policy "app invites read" on public.app_invites
  for select using (public.is_member());

drop policy if exists "app invites delete" on public.app_invites;
create policy "app invites delete" on public.app_invites
  for delete using (public.is_member());

do $$
begin
  alter publication supabase_realtime add table public.titles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.watches;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ratings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.list_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.invite_codes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.households;
exception when duplicate_object then null;
end $$;
