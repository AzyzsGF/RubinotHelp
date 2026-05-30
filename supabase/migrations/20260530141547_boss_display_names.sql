alter table public.bosses
  add column if not exists full_name text not null default '',
  add column if not exists popular_name text not null default '',
  add column if not exists display_name_mode text not null default 'full';

update public.bosses
set full_name = name
where full_name = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bosses_display_name_mode_check'
      and conrelid = 'public.bosses'::regclass
  ) then
    alter table public.bosses
      add constraint bosses_display_name_mode_check
      check (display_name_mode in ('full', 'popular'));
  end if;
end $$;
