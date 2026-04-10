-- Run this once in Supabase SQL Editor if public.users stays empty.

-- RLS recursion fix: avoid calling a function that reads public.users inside public.users policies.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  perform set_config('row_security', 'off', true);
  select role into r from public.users where id = auth.uid();
  return coalesce(r = 'admin', false);
end;
$$;

drop policy if exists "users can read self" on public.users;
create policy "users can read self" on public.users
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "doctors can read patients for own appointments" on public.users;
create policy "doctors can read patients for own appointments" on public.users
for select to authenticated
using (
  exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.user_id = public.users.id
      and d.user_id = auth.uid()
  )
);

drop policy if exists "users can update self" on public.users;
create policy "users can update self" on public.users
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "users insert own profile" on public.users;
create policy "users insert own profile" on public.users
for insert with check (id = auth.uid());

drop policy if exists "any authenticated can read doctors" on public.doctors;
create policy "any authenticated can read doctors" on public.doctors
for select to authenticated using (true);

drop policy if exists "admin manages doctors" on public.doctors;
create policy "admin manages doctors" on public.doctors
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "patient reads own appointments" on public.appointments;
create policy "patient reads own appointments" on public.appointments
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "patient creates own appointments" on public.appointments;
create policy "patient creates own appointments" on public.appointments
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "patient cancels own appointments" on public.appointments;
create policy "patient cancels own appointments" on public.appointments
for update to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or doctor_id in (select id from public.doctors where user_id = auth.uid())
)
with check (
  user_id = auth.uid()
  or public.is_admin()
  or doctor_id in (select id from public.doctors where user_id = auth.uid())
);

drop policy if exists "read reviews for all" on public.reviews;
create policy "read reviews for all" on public.reviews
for select to authenticated using (true);

drop policy if exists "patient writes own review" on public.reviews;
create policy "patient writes own review" on public.reviews
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "patient updates own review" on public.reviews;
create policy "patient updates own review" on public.reviews
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient')
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role;

  if coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient') = 'doctor' then
    insert into public.doctors (user_id, name, specialization, description, avatar)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'specialization', 'ЛОР'),
      nullif(new.raw_user_meta_data ->> 'description', ''),
      nullif(new.raw_user_meta_data ->> 'avatar', '')
    )
    on conflict (user_id) do update set
      name = excluded.name,
      specialization = excluded.specialization,
      description = excluded.description,
      avatar = excluded.avatar;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill users table from existing auth users.
insert into public.users (id, name, email, role)
select
  au.id,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)) as name,
  au.email,
  coalesce((au.raw_user_meta_data ->> 'role')::public.user_role, 'patient') as role
from auth.users au
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role;

-- Ensure unique index exists for upsert by user_id
create unique index if not exists uniq_doctors_user_id on public.doctors(user_id);

-- Backfill doctors cards for existing doctor users
insert into public.doctors (user_id, name, specialization, description, avatar)
select
  au.id as user_id,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)) as name,
  coalesce(au.raw_user_meta_data ->> 'specialization', 'ЛОР') as specialization,
  nullif(au.raw_user_meta_data ->> 'description', '') as description,
  nullif(au.raw_user_meta_data ->> 'avatar', '') as avatar
from auth.users au
where coalesce((au.raw_user_meta_data ->> 'role')::public.user_role, 'patient') = 'doctor'
on conflict (user_id) do update set
  name = excluded.name,
  specialization = excluded.specialization,
  description = excluded.description,
  avatar = excluded.avatar;
