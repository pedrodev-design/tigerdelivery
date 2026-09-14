do $$ begin
  create type public.app_role as enum ('customer', 'driver', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.driver_application_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.vehicle_type as enum ('motorcycle', 'bicycle', 'car');
exception when duplicate_object then null;
end $$;

create or replace function private.is_valid_cpf(value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');
  total integer := 0;
  first_digit integer;
  second_digit integer;
  idx integer;
begin
  if digits !~ '^[0-9]{11}$' or digits ~ '^([0-9])\1{10}$' then
    return false;
  end if;

  for idx in 1..9 loop
    total := total + substr(digits, idx, 1)::integer * (11 - idx);
  end loop;
  first_digit := (total * 10) % 11;
  if first_digit = 10 then first_digit := 0; end if;
  if first_digit <> substr(digits, 10, 1)::integer then return false; end if;

  total := 0;
  for idx in 1..10 loop
    total := total + substr(digits, idx, 1)::integer * (12 - idx);
  end loop;
  second_digit := (total * 10) % 11;
  if second_digit = 10 then second_digit := 0; end if;
  return second_digit = substr(digits, 11, 1)::integer;
end;
$$;

revoke all on function private.is_valid_cpf(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_valid_cpf(text) to authenticated;

alter table public.profiles
  add column if not exists cpf text;

alter table public.profiles
  drop constraint if exists profiles_cpf_format;

alter table public.profiles
  add constraint profiles_cpf_format check (
    cpf is null or private.is_valid_cpf(cpf)
  );

create unique index if not exists profiles_cpf_unique
  on public.profiles (cpf)
  where cpf is not null;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  vehicle_type public.vehicle_type not null,
  vehicle_plate text,
  city text not null check (char_length(city) between 2 and 80),
  status public.driver_application_status not null default 'pending',
  review_notes text check (review_notes is null or char_length(review_notes) <= 500),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint driver_vehicle_plate check (
    vehicle_type = 'bicycle' or (vehicle_plate is not null and char_length(vehicle_plate) between 7 and 8)
  )
);

create index if not exists driver_applications_status_submitted_idx
  on public.driver_applications (status, submitted_at desc);

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.current_user_is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cpf_digits text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g');
begin
  if not private.is_valid_cpf(cpf_digits) then
    cpf_digits := null;
  end if;

  insert into public.profiles (id, full_name, avatar_url, cpf)
  values (
    new.id,
    coalesce(
      nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 80), ''),
      nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''),
      'Cliente'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    cpf_digits
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    cpf = coalesce(public.profiles.cpf, excluded.cpf);

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.user_roles (user_id, role)
select id, 'customer'::public.app_role from auth.users
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = 'agencyventax@gmail.com'
on conflict (user_id) do update set role = excluded.role, updated_at = now();

drop trigger if exists user_roles_set_updated_at on public.user_roles;
create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute procedure private.set_updated_at();

drop trigger if exists driver_applications_set_updated_at on public.driver_applications;
create trigger driver_applications_set_updated_at
  before update on public.driver_applications
  for each row execute procedure private.set_updated_at();

alter table public.user_roles enable row level security;
alter table public.driver_applications enable row level security;

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using ((select private.current_user_is_admin()));

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
  on public.user_roles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_roles_select_admin on public.user_roles;
create policy user_roles_select_admin
  on public.user_roles for select
  to authenticated
  using ((select private.current_user_is_admin()));

drop policy if exists driver_applications_select_own on public.driver_applications;
create policy driver_applications_select_own
  on public.driver_applications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists driver_applications_select_admin on public.driver_applications;
create policy driver_applications_select_admin
  on public.driver_applications for select
  to authenticated
  using ((select private.current_user_is_admin()));

revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.driver_applications from anon, authenticated;
grant select on table public.user_roles to authenticated;
grant select on table public.driver_applications to authenticated;
grant all on table public.user_roles to service_role;
grant all on table public.driver_applications to service_role;

revoke update on table public.profiles from authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

create or replace function public.submit_driver_application(
  p_cpf text,
  p_phone text,
  p_vehicle_type text,
  p_vehicle_plate text,
  p_city text
)
returns public.driver_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  cpf_digits text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  phone_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  plate_value text := upper(regexp_replace(coalesce(p_vehicle_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  vehicle_value public.vehicle_type;
  application public.driver_applications;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.is_valid_cpf(cpf_digits) then
    raise exception 'invalid_cpf' using errcode = '22023';
  end if;
  if phone_digits !~ '^[0-9]{10,11}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if trim(coalesce(p_city, '')) = '' then
    raise exception 'invalid_city' using errcode = '22023';
  end if;

  begin
    vehicle_value := p_vehicle_type::public.vehicle_type;
  exception when invalid_text_representation then
    raise exception 'invalid_vehicle' using errcode = '22023';
  end;

  if vehicle_value <> 'bicycle' and char_length(plate_value) not between 7 and 8 then
    raise exception 'invalid_plate' using errcode = '22023';
  end if;

  update public.profiles
  set cpf = cpf_digits
  where id = current_user_id;

  insert into public.driver_applications (user_id, phone, vehicle_type, vehicle_plate, city, status)
  values (
    current_user_id,
    phone_digits,
    vehicle_value,
    nullif(plate_value, ''),
    left(trim(p_city), 80),
    'pending'
  )
  on conflict (user_id) do update set
    phone = excluded.phone,
    vehicle_type = excluded.vehicle_type,
    vehicle_plate = excluded.vehicle_plate,
    city = excluded.city,
    status = 'pending',
    review_notes = null,
    reviewed_at = null,
    reviewed_by = null,
    submitted_at = now()
  where public.driver_applications.status <> 'approved'
  returning * into application;

  if application.id is null then
    raise exception 'driver_already_approved' using errcode = '22023';
  end if;

  return application;
exception when unique_violation then
  raise exception 'cpf_already_registered' using errcode = '23505';
end;
$$;

revoke all on function public.submit_driver_application(text, text, text, text, text) from public, anon;
grant execute on function public.submit_driver_application(text, text, text, text, text) to authenticated;

create or replace function public.review_driver_application(
  p_application_id uuid,
  p_status text,
  p_notes text default null
)
returns public.driver_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.driver_application_status;
  application public.driver_applications;
begin
  if not (select private.current_user_is_admin()) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'invalid_review_status' using errcode = '22023';
  end if;
  next_status := p_status::public.driver_application_status;

  update public.driver_applications
  set status = next_status,
      review_notes = nullif(left(trim(coalesce(p_notes, '')), 500), ''),
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = p_application_id
  returning * into application;

  if application.id is null then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if next_status = 'approved' then
    insert into public.user_roles (user_id, role)
    values (application.user_id, 'driver')
    on conflict (user_id) do update
      set role = case
        when public.user_roles.role = 'admin' then 'admin'::public.app_role
        else 'driver'::public.app_role
      end;
  else
    update public.user_roles
    set role = 'customer'
    where user_id = application.user_id and role <> 'admin';
  end if;

  return application;
end;
$$;

revoke all on function public.review_driver_application(uuid, text, text) from public, anon;
grant execute on function public.review_driver_application(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
