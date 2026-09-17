create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 3 and 180),
  street text not null check (char_length(trim(street)) between 2 and 120),
  number text not null check (char_length(trim(number)) between 1 and 20),
  complement text check (complement is null or char_length(complement) <= 80),
  neighborhood text,
  city text not null check (char_length(trim(city)) between 2 and 80),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_idx on public.customer_addresses (user_id, updated_at desc);
create unique index if not exists customer_addresses_one_default_idx on public.customer_addresses (user_id) where is_default;

alter table public.customer_addresses enable row level security;

drop policy if exists customer_addresses_read_own on public.customer_addresses;
create policy customer_addresses_read_own
  on public.customer_addresses for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.customer_addresses from anon, authenticated;
grant select on table public.customer_addresses to authenticated;

create or replace function public.save_customer_address(
  p_label text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision
)
returns public.customer_addresses
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  address_row public.customer_addresses;
  clean_postal_code text := regexp_replace(coalesce(p_postal_code, ''), '[^0-9]', '', 'g');
begin
  if current_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_street, ''))) < 2
    or char_length(trim(coalesce(p_number, ''))) < 1
    or char_length(trim(coalesce(p_city, ''))) < 2 then
    raise exception 'invalid_address' using errcode = '22023';
  end if;
  if not (p_latitude between -90 and 90) or not (p_longitude between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  select * into address_row
  from public.customer_addresses
  where user_id = current_user_id and is_default
  for update;

  if address_row.id is null then
    insert into public.customer_addresses (
      user_id, label, street, number, complement, neighborhood, city, state,
      postal_code, latitude, longitude, is_default
    ) values (
      current_user_id,
      left(trim(p_label), 180), left(trim(p_street), 120), left(trim(p_number), 20),
      nullif(left(trim(coalesce(p_complement, '')), 80), ''),
      nullif(left(trim(coalesce(p_neighborhood, '')), 80), ''),
      left(trim(p_city), 80), nullif(upper(left(trim(coalesce(p_state, '')), 2)), ''),
      case when clean_postal_code ~ '^[0-9]{8}$' then clean_postal_code else null end,
      p_latitude, p_longitude, true
    ) returning * into address_row;
  else
    update public.customer_addresses
    set label = left(trim(p_label), 180),
        street = left(trim(p_street), 120),
        number = left(trim(p_number), 20),
        complement = nullif(left(trim(coalesce(p_complement, '')), 80), ''),
        neighborhood = nullif(left(trim(coalesce(p_neighborhood, '')), 80), ''),
        city = left(trim(p_city), 80),
        state = nullif(upper(left(trim(coalesce(p_state, '')), 2)), ''),
        postal_code = case when clean_postal_code ~ '^[0-9]{8}$' then clean_postal_code else null end,
        latitude = p_latitude,
        longitude = p_longitude,
        updated_at = now()
    where id = address_row.id
    returning * into address_row;
  end if;
  return address_row;
end;
$$;

revoke all on function public.save_customer_address(text, text, text, text, text, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.save_customer_address(text, text, text, text, text, text, text, text, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';

