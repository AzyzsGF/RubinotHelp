alter table public.profiles
  add column if not exists avatar_url text not null default '';

create table if not exists public.service_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  categories text[] not null default '{}',
  price_amount numeric(10,2) not null default 0 check (price_amount >= 0),
  price_hours numeric(10,2) not null default 1 check (price_hours > 0),
  package_hours numeric(10,2) not null default 0 check (package_hours >= 0),
  package_hour_price numeric(10,2) not null default 0 check (package_hour_price >= 0),
  description text not null default '',
  provider_bio text not null default '',
  whatsapp text not null default '',
  banner_url text not null default '',
  provider_nick text not null default '',
  provider_avatar_url text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  service_card_id uuid not null references public.service_cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_nick text not null default '',
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) >= 30),
  screenshot_url text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_card_id, user_id)
);

create index if not exists service_cards_status_created_idx
  on public.service_cards (status, created_at desc);

create index if not exists service_cards_categories_idx
  on public.service_cards using gin (categories);

create index if not exists service_reviews_card_status_idx
  on public.service_reviews (service_card_id, status, created_at desc);

drop trigger if exists service_cards_set_updated_at on public.service_cards;
create trigger service_cards_set_updated_at
before update on public.service_cards
for each row execute function public.set_updated_at();

drop trigger if exists service_reviews_set_updated_at on public.service_reviews;
create trigger service_reviews_set_updated_at
before update on public.service_reviews
for each row execute function public.set_updated_at();

alter table public.service_cards enable row level security;
alter table public.service_reviews enable row level security;

create policy "service_cards_select_visible"
on public.service_cards
for select
using (
  status = 'approved'
  or user_id = (select auth.uid())
  or public.current_user_is_admin()
);

create policy "service_cards_owner_insert_pending"
on public.service_cards
for insert
to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

create policy "service_cards_owner_update_pending"
on public.service_cards
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and status = 'pending');

create policy "service_cards_owner_delete"
on public.service_cards
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "service_cards_admin_all"
on public.service_cards
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy "service_reviews_select_visible"
on public.service_reviews
for select
using (
  status = 'approved'
  or user_id = (select auth.uid())
  or public.current_user_is_admin()
);

create policy "service_reviews_user_insert_pending"
on public.service_reviews
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and char_length(comment) >= 30
  and screenshot_url <> ''
  and exists (
    select 1
    from public.service_cards
    where service_cards.id = service_reviews.service_card_id
      and service_cards.status = 'approved'
      and service_cards.user_id <> (select auth.uid())
  )
);

create policy "service_reviews_user_update_pending"
on public.service_reviews
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and status = 'pending');

create policy "service_reviews_user_delete"
on public.service_reviews
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "service_reviews_admin_all"
on public.service_reviews
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.service_cards to anon, authenticated;
grant insert, update, delete on public.service_cards to authenticated;
grant select on public.service_reviews to anon, authenticated;
grant insert, update, delete on public.service_reviews to authenticated;

insert into storage.buckets (id, name, public)
values
  ('profile-avatars', 'profile-avatars', true),
  ('service-banners', 'service-banners', true),
  ('service-review-screens', 'service-review-screens', true)
on conflict (id) do nothing;

create policy "profile_avatars_public_read"
on storage.objects
for select
using (bucket_id = 'profile-avatars');

create policy "profile_avatars_owner_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "profile_avatars_owner_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'profile-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()))
with check (bucket_id = 'profile-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()));

create policy "profile_avatars_owner_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'profile-avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()));

create policy "service_banners_public_read"
on storage.objects
for select
using (bucket_id = 'service-banners');

create policy "service_banners_owner_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'service-banners' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "service_banners_owner_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'service-banners' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()))
with check (bucket_id = 'service-banners' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()));

create policy "service_banners_owner_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'service-banners' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()));

create policy "service_review_screens_public_read"
on storage.objects
for select
using (bucket_id = 'service-review-screens');

create policy "service_review_screens_owner_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'service-review-screens' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "service_review_screens_owner_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'service-review-screens' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()))
with check (bucket_id = 'service-review-screens' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()));

create policy "service_review_screens_owner_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'service-review-screens' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_is_admin()));
