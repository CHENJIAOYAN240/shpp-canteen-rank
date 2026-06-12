begin;

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

commit;
