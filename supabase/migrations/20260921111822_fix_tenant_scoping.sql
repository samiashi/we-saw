-- Scope ratings reads to the household that owns the watch. The previous
-- `is_member()` policy let any signed-in user read every household's ratings.
drop policy if exists "ratings read" on public.ratings;
create policy "ratings read" on public.ratings
  for select using (
    exists (
      select 1
      from public.watches w
      where w.id = ratings.watch_id
        and w.household_id = (select public.my_household_id())
    )
  );

-- Table-level UPDATE grants silently cover every column, so the earlier
-- column-level revokes never protected household_id. Revoke the table grant
-- and re-grant only the column members may change.
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
grant update (display_name) on public.members to authenticated;

-- Friend invites are only visible to the member who generated them.
drop policy if exists "app invites read" on public.app_invites;
create policy "app invites read" on public.app_invites
  for select using (invited_by = auth.uid());

drop policy if exists "app invites delete" on public.app_invites;
create policy "app invites delete" on public.app_invites
  for delete using (invited_by = auth.uid());
