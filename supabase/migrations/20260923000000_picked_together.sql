alter table public.watches add column if not exists picked_together boolean not null default false;

update public.watches
set picked_together = true
where picked_by is null;
