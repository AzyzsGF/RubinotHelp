create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nick text not null default '',
  whatsapp text not null default '',
  whatsapp_opt_in boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bosses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'boss' check (type in ('boss', 'mini-boss')),
  image_url text not null default '',
  hp integer not null default 0 check (hp >= 0),
  mana integer not null default 0 check (mana >= 0),
  weaknesses text[] not null default '{}',
  damage_types text[] not null default '{}',
  mechanics text not null default '',
  access_notes text not null default '',
  recommended_equipment text not null default '',
  cooldown_minutes integer not null check (cooldown_minutes > 0),
  youtube_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boss_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  boss_id uuid not null references public.bosses(id) on delete cascade,
  checked_at timestamptz not null default now(),
  cooldown_ends_at timestamptz not null,
  browser_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_id uuid not null references public.boss_checkins(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  scheduled_for timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkin_id, channel)
);

create index if not exists bosses_active_name_idx on public.bosses (is_active, name);
create index if not exists boss_checkins_user_due_idx on public.boss_checkins (user_id, cooldown_ends_at desc);
create index if not exists notification_jobs_pending_idx
  on public.notification_jobs (status, scheduled_for)
  where status = 'pending';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists bosses_set_updated_at on public.bosses;
create trigger bosses_set_updated_at
before update on public.bosses
for each row execute function public.set_updated_at();

drop trigger if exists notification_jobs_set_updated_at on public.notification_jobs;
create trigger notification_jobs_set_updated_at
before update on public.notification_jobs
for each row execute function public.set_updated_at();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

create or replace function public.guard_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_admin is distinct from new.is_admin and not public.current_user_is_admin() then
    raise exception 'Only an admin can change is_admin';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_admin_flag on public.profiles;
create trigger profiles_guard_admin_flag
before update on public.profiles
for each row execute function public.guard_profile_admin_flag();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nick)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nick', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.bosses enable row level security;
alter table public.boss_checkins enable row level security;
alter table public.notification_jobs enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (id = auth.uid() or public.current_user_is_admin());

create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid() and is_admin = false);

create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (id = auth.uid() or public.current_user_is_admin())
with check (id = auth.uid() or public.current_user_is_admin());

create policy "bosses_select_active_or_admin"
on public.bosses
for select
using (is_active = true or public.current_user_is_admin());

create policy "bosses_admin_all"
on public.bosses
for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy "boss_checkins_select_own"
on public.boss_checkins
for select
using (user_id = auth.uid());

create policy "boss_checkins_insert_own"
on public.boss_checkins
for insert
with check (user_id = auth.uid());

create policy "boss_checkins_update_own"
on public.boss_checkins
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "boss_checkins_delete_own"
on public.boss_checkins
for delete
using (user_id = auth.uid());

create policy "notification_jobs_select_own"
on public.notification_jobs
for select
using (user_id = auth.uid());

create policy "notification_jobs_insert_own_pending"
on public.notification_jobs
for insert
with check (user_id = auth.uid() and channel = 'whatsapp' and status = 'pending');

insert into storage.buckets (id, name, public)
values ('boss-images', 'boss-images', true)
on conflict (id) do nothing;

create policy "boss_images_public_read"
on storage.objects
for select
using (bucket_id = 'boss-images');

create policy "boss_images_admin_insert"
on storage.objects
for insert
with check (bucket_id = 'boss-images' and public.current_user_is_admin());

create policy "boss_images_admin_update"
on storage.objects
for update
using (bucket_id = 'boss-images' and public.current_user_is_admin())
with check (bucket_id = 'boss-images' and public.current_user_is_admin());

create policy "boss_images_admin_delete"
on storage.objects
for delete
using (bucket_id = 'boss-images' and public.current_user_is_admin());
