alter table public.bosses
  add column if not exists content_mode text not null default 'single';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bosses_content_mode_check'
      and conrelid = 'public.bosses'::regclass
  ) then
    alter table public.bosses
      add constraint bosses_content_mode_check
      check (content_mode in ('single', 'group'));
  end if;
end $$;

alter table public.boss_steps
  add column if not exists weaknesses text[] not null default '{}',
  add column if not exists damage_types text[] not null default '{}';

update public.bosses
set content_mode = 'group'
where exists (
  select 1
  from public.boss_steps
  where boss_steps.boss_id = bosses.id
);
