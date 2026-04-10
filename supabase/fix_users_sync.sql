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
