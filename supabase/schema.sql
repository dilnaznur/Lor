-- 1) ENUM types
create type public.user_role as enum ('patient', 'doctor', 'admin');
create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled');

-- 2) USERS table (linked with Supabase Auth)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  password text default 'auth_managed',
  role public.user_role not null default 'patient',
  created_at timestamptz not null default now()
);

-- 3) DOCTORS table
create table if not exists public.doctors (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete set null,
  name text not null,
  specialization text not null check (specialization in ('ЛОР')),
  description text,
  avatar text,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_doctors_user_id on public.doctors(user_id);

-- 4) APPOINTMENTS table
create table if not exists public.appointments (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  doctor_id bigint not null references public.doctors(id) on delete cascade,
  date date not null,
  time text not null,
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (doctor_id, date, time)
);

-- 5) REVIEWS table (optional but included)
create table if not exists public.reviews (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  doctor_id bigint not null references public.doctors(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_user_id on public.appointments(user_id);
create index if not exists idx_appointments_doctor_id on public.appointments(doctor_id);
create index if not exists idx_reviews_doctor_id on public.reviews(doctor_id);

-- Trigger: auto insert profile row after auth signup.
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

  -- If the user is a doctor, create (or update) a linked doctor card.
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

-- Enable RLS
alter table public.users enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;

-- Utility function: admin check (SECURITY DEFINER to avoid RLS recursion)
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

-- USERS policies
drop policy if exists "users can read self" on public.users;
create policy "users can read self" on public.users
for select using (id = auth.uid() or public.is_admin());

-- Doctors can read patient profiles only for appointments assigned to them
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

-- DOCTORS policies
drop policy if exists "any authenticated can read doctors" on public.doctors;
create policy "any authenticated can read doctors" on public.doctors
for select to authenticated using (true);

drop policy if exists "admin manages doctors" on public.doctors;
create policy "admin manages doctors" on public.doctors
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- APPOINTMENTS policies
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

-- REVIEWS policies
drop policy if exists "read reviews for all" on public.reviews;
create policy "read reviews for all" on public.reviews
for select to authenticated using (true);

drop policy if exists "patient writes own review" on public.reviews;
create policy "patient writes own review" on public.reviews
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "patient updates own review" on public.reviews;
create policy "patient updates own review" on public.reviews
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Seed doctors (edit links if needed)
insert into public.doctors (name, specialization, description, avatar)
values
  ('Др. Айгерим Садыкова', 'ЛОР', 'Опыт 8 лет, диагностика и лечение заболеваний уха, горла, носа.', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300')
on conflict do nothing;
