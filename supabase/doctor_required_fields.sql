-- Optional hardening: require description + avatar URL for linked doctors.
-- Safe for existing rows: NOT VALID means existing rows aren't checked,
-- but new/updated rows must satisfy the constraint.

alter table public.doctors
add constraint if not exists doctors_description_required
check (
  user_id is null
  or length(trim(coalesce(description, ''))) > 0
)
not valid;

alter table public.doctors
add constraint if not exists doctors_avatar_required
check (
  user_id is null
  or (coalesce(avatar, '') ~* '^https?://')
)
not valid;

-- When you are ready (and after cleaning old rows), you can validate:
-- alter table public.doctors validate constraint doctors_description_required;
-- alter table public.doctors validate constraint doctors_avatar_required;
