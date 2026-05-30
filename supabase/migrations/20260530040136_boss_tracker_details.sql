alter table public.bosses
  add column if not exists requires_access boolean not null default false,
  add column if not exists access_url text not null default '',
  add column if not exists location text not null default '';

create table if not exists public.boss_steps (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references public.bosses(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  image_url text not null default '',
  location text not null default '',
  mechanics text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boss_steps_boss_sort_idx
  on public.boss_steps (boss_id, sort_order, name);

drop trigger if exists boss_steps_set_updated_at on public.boss_steps;
create trigger boss_steps_set_updated_at
before update on public.boss_steps
for each row execute function public.set_updated_at();

alter table public.boss_steps enable row level security;

drop policy if exists "boss_steps_select_active_or_admin" on public.boss_steps;
create policy "boss_steps_select_active_or_admin"
on public.boss_steps
for select
using (
  exists (
    select 1
    from public.bosses
    where bosses.id = boss_steps.boss_id
      and (bosses.is_active = true or public.current_user_is_admin())
  )
);

drop policy if exists "boss_steps_admin_all" on public.boss_steps;
create policy "boss_steps_admin_all"
on public.boss_steps
for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.bosses to anon, authenticated;
grant insert, update, delete on public.bosses to authenticated;
grant select on public.boss_steps to anon, authenticated;
grant insert, update, delete on public.boss_steps to authenticated;
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.boss_checkins to authenticated;
grant select, insert on public.notification_jobs to authenticated;
