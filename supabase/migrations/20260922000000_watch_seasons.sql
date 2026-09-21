alter table public.watches add column if not exists seasons int[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'watches'
      and column_name = 'season'
  ) then
    execute $migrate$
      update public.watches
      set seasons = array[season]
      where seasons is null
        and season is not null
    $migrate$;
    execute 'alter table public.watches drop column season';
  end if;
end
$$;

alter table public.watches drop constraint if exists watches_seasons_valid;
alter table public.watches add constraint watches_seasons_valid
  check (
    seasons is null
    or (
      coalesce(array_length(seasons, 1), 0) >= 1
      and array_position(seasons, null) is null
    )
  );
