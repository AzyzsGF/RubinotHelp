alter table public.bosses
  add column if not exists location_url text not null default '';
