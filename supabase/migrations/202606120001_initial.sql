begin;

create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  nickname varchar(20) not null check (char_length(trim(nickname)) between 1 and 20),
  floor smallint not null check (floor between 1 and 3),
  stall varchar(40) not null check (char_length(trim(stall)) between 1 and 40),
  dish_name varchar(60) not null check (char_length(trim(dish_name)) between 1 and 60),
  price numeric(6, 2) not null check (price between 0 and 999.99),
  rating smallint not null check (rating between 1 and 5),
  review_text varchar(200) not null check (char_length(trim(review_text)) between 1 and 200),
  image_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  nickname varchar(20) not null check (char_length(trim(nickname)) between 1 and 20),
  body varchar(120) not null check (char_length(trim(body)) between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists reviews_status_created_idx
  on public.reviews (status, created_at desc);
create index if not exists reviews_floor_rating_idx
  on public.reviews (floor, rating);
create index if not exists comments_review_status_idx
  on public.comments (review_id, status, created_at);
create index if not exists likes_review_idx
  on public.likes (review_id);

alter table public.reviews enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

drop policy if exists "approved reviews are readable" on public.reviews;
create policy "approved reviews are readable"
on public.reviews
for select
to anon, authenticated
using (status = 'approved' or author_id = (select auth.uid()));

drop policy if exists "users submit their own pending reviews" on public.reviews;
create policy "users submit their own pending reviews"
on public.reviews
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
);

drop policy if exists "approved comments are readable" on public.comments;
create policy "approved comments are readable"
on public.comments
for select
to anon, authenticated
using (status = 'approved' or author_id = (select auth.uid()));

drop policy if exists "users submit comments to approved reviews" on public.comments;
create policy "users submit comments to approved reviews"
on public.comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.reviews
    where reviews.id = comments.review_id
      and reviews.status = 'approved'
  )
);

drop policy if exists "likes on approved reviews are readable" on public.likes;
create policy "likes on approved reviews are readable"
on public.likes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.reviews
    where reviews.id = likes.review_id
      and reviews.status = 'approved'
  )
);

drop policy if exists "users like approved reviews as themselves" on public.likes;
create policy "users like approved reviews as themselves"
on public.likes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.reviews
    where reviews.id = likes.review_id
      and reviews.status = 'approved'
  )
);

drop policy if exists "users remove their own likes" on public.likes;
create policy "users remove their own likes"
on public.likes
for delete
to authenticated
using (user_id = (select auth.uid()));

drop view if exists public.review_feed;
create view public.review_feed
with (security_invoker = true, security_barrier = true)
as
select
  r.id,
  r.nickname,
  r.floor,
  r.stall,
  r.dish_name,
  r.price,
  r.rating,
  r.review_text,
  r.image_path,
  r.created_at,
  (
    select count(*)::integer
    from public.likes l
    where l.review_id = r.id
  ) as like_count,
  (
    select count(*)::integer
    from public.comments c
    where c.review_id = r.id
      and c.status = 'approved'
  ) as comment_count
from public.reviews r
where r.status = 'approved';

grant usage on schema public to anon, authenticated;
grant select on public.review_feed to anon, authenticated;
grant select on public.reviews, public.comments, public.likes to anon, authenticated;
grant insert on public.reviews, public.comments, public.likes to authenticated;
grant delete on public.likes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-photos',
  'food-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload to their own food photo folder" on storage.objects;
create policy "users upload to their own food photo folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'food-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "approved food photos and own uploads are readable" on storage.objects;
create policy "approved food photos and own uploads are readable"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'food-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.reviews
      where reviews.image_path = storage.objects.name
        and reviews.status = 'approved'
    )
  )
);

drop policy if exists "users can remove their own rejected uploads" on storage.objects;
create policy "users can remove their own rejected uploads"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'food-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
