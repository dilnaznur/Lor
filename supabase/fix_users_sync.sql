-- Run this once in Supabase SQL Editor if public.users stays empty.

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
