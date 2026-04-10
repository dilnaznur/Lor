-- Supabase Storage setup for avatar uploads
-- 1) Create a public bucket `avatars`
-- 2) Allow authenticated users to upload/update/delete their own objects
--
-- Run in Supabase SQL Editor.

-- Bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Policies (drop + create so script is rerunnable)

-- Anyone (anon/auth) can read objects from public bucket
drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

-- Authenticated can upload into avatars bucket
drop policy if exists "authenticated upload avatars" on storage.objects;
create policy "authenticated upload avatars"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars');

-- Authenticated can update own objects in avatars bucket
drop policy if exists "authenticated update own avatars" on storage.objects;
create policy "authenticated update own avatars"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and owner = auth.uid())
with check (bucket_id = 'avatars' and owner = auth.uid());

-- Authenticated can delete own objects in avatars bucket
drop policy if exists "authenticated delete own avatars" on storage.objects;
create policy "authenticated delete own avatars"
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and owner = auth.uid());
