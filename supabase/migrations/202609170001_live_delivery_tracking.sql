-- Real availability, location and safe live-delivery access.
alter table public.stores
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists delivery_radius_km numeric(6, 2) not null default 8.00;

alter table public.stores
  drop constraint if exists stores_latitude_check,
  add constraint stores_latitude_check check (latitude is null or latitude between -90 and 90),
  drop constraint if exists stores_longitude_check,
  add constraint stores_longitude_check check (longitude is null or longitude between -180 and 180),
  drop constraint if exists stores_delivery_radius_check,
  add constraint stores_delivery_radius_check check (delivery_radius_km between 0.5 and 50);

alter table public.store_orders
  add column if not exists route_distance_m integer,
  add column if not exists route_duration_s integer,
  add column if not exists estimated_arrival_at timestamptz;

create table if not exists public.driver_locations (
  driver_id uuid primary key references auth.users (id) on delete cascade,
  is_online boolean not null default false,
  latitude double precision,
  longitude double precision,
  accuracy_m numeric(8, 2),
  heading numeric(6, 2),
  speed_mps numeric(8, 2),
  current_order_id uuid references public.store_orders (id) on delete set null,
  last_location_update timestamptz,
  updated_at timestamptz not null default now(),
  constraint driver_locations_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint driver_locations_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint driver_locations_accuracy_check check (accuracy_m is null or accuracy_m between 0 and 10000),
  constraint driver_locations_heading_check check (heading is null or heading between 0 and 360),
  constraint driver_locations_speed_check check (speed_mps is null or speed_mps between 0 and 100)
);

create index if not exists driver_locations_available_idx
  on public.driver_locations (last_location_update desc)
  where is_online and current_order_id is null;

create unique index if not exists store_orders_one_active_delivery_per_driver
  on public.store_orders (driver_id)
  where driver_id is not null
    and fulfillment_type = 'delivery'
    and status in ('new', 'confirmed', 'preparing', 'ready', 'picked_up');

create or replace function private.user_can_view_driver_location(target_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_driver_id = (select auth.uid())
    or (select private.current_user_is_admin())
    or exists (
      select 1
      from public.store_orders orders
      where orders.driver_id = target_driver_id
        and orders.status in ('new', 'confirmed', 'preparing', 'ready', 'picked_up')
        and (
          orders.customer_id = (select auth.uid())
          or (select private.user_can_manage_store(orders.store_id))
        )
    );
$$;

revoke all on function private.user_can_view_driver_location(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.user_can_view_driver_location(uuid) to authenticated;

alter table public.driver_locations enable row level security;

drop policy if exists driver_locations_safe_read on public.driver_locations;
create policy driver_locations_safe_read
  on public.driver_locations for select
  to authenticated
  using ((select private.user_can_view_driver_location(driver_id)));

revoke all on table public.driver_locations from anon, authenticated;
grant select on table public.driver_locations to authenticated;

create or replace function public.set_driver_availability(
  p_is_online boolean,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m numeric default null
)
returns public.driver_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  location_row public.driver_locations;
begin
  if current_user_id is null or not (select private.current_user_is_approved_driver()) then
    raise exception 'approved_driver_required' using errcode = '42501';
  end if;

  if p_is_online and (p_latitude is null or p_longitude is null) then
    raise exception 'location_required' using errcode = '22023';
  end if;

  if p_latitude is not null and not (p_latitude between -90 and 90)
    or p_longitude is not null and not (p_longitude between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  if not p_is_online and exists (
    select 1 from public.store_orders
    where driver_id = current_user_id
      and status in ('new', 'confirmed', 'preparing', 'ready', 'picked_up')
  ) then
    raise exception 'active_delivery_in_progress' using errcode = '55000';
  end if;

  insert into public.driver_locations (
    driver_id, is_online, latitude, longitude, accuracy_m, last_location_update, updated_at
  ) values (
    current_user_id,
    p_is_online,
    p_latitude,
    p_longitude,
    case when p_accuracy_m is null then null else least(greatest(p_accuracy_m, 0), 10000) end,
    case when p_latitude is not null and p_longitude is not null then now() else null end,
    now()
  )
  on conflict (driver_id) do update set
    is_online = excluded.is_online,
    latitude = coalesce(excluded.latitude, public.driver_locations.latitude),
    longitude = coalesce(excluded.longitude, public.driver_locations.longitude),
    accuracy_m = coalesce(excluded.accuracy_m, public.driver_locations.accuracy_m),
    last_location_update = coalesce(excluded.last_location_update, public.driver_locations.last_location_update),
    updated_at = now()
  returning * into location_row;

  return location_row;
end;
$$;

revoke all on function public.set_driver_availability(boolean, double precision, double precision, numeric) from public, anon;
grant execute on function public.set_driver_availability(boolean, double precision, double precision, numeric) to authenticated;

create or replace function public.update_driver_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m numeric default null,
  p_heading numeric default null,
  p_speed_mps numeric default null
)
returns public.driver_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  location_row public.driver_locations;
begin
  if current_user_id is null or not (select private.current_user_is_approved_driver()) then
    raise exception 'approved_driver_required' using errcode = '42501';
  end if;
  if not (p_latitude between -90 and 90) or not (p_longitude between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  update public.driver_locations
  set latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = case when p_accuracy_m is null then accuracy_m else least(greatest(p_accuracy_m, 0), 10000) end,
      heading = case when p_heading is null or p_heading < 0 then heading else least(p_heading, 360) end,
      speed_mps = case when p_speed_mps is null or p_speed_mps < 0 then speed_mps else least(p_speed_mps, 100) end,
      last_location_update = now(),
      updated_at = now()
  where driver_id = current_user_id
    and is_online
  returning * into location_row;

  if location_row.driver_id is null then
    raise exception 'driver_is_offline' using errcode = '55000';
  end if;
  return location_row;
end;
$$;

revoke all on function public.update_driver_location(double precision, double precision, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_driver_location(double precision, double precision, numeric, numeric, numeric) to authenticated;

create or replace function public.set_store_coordinates(
  p_store_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare store_row public.stores;
begin
  if not (select private.user_can_manage_store(p_store_id)) then
    raise exception 'store_manager_required' using errcode = '42501';
  end if;
  if not (p_latitude between -90 and 90) or not (p_longitude between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;
  update public.stores
  set latitude = p_latitude, longitude = p_longitude, updated_at = now()
  where id = p_store_id
  returning * into store_row;
  if store_row.id is null then raise exception 'store_not_found' using errcode = 'P0002'; end if;
  return store_row;
end;
$$;

revoke all on function public.set_store_coordinates(uuid, double precision, double precision) from public, anon;
grant execute on function public.set_store_coordinates(uuid, double precision, double precision) to authenticated;

create or replace function private.assign_nearest_online_driver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_lat double precision;
  customer_lng double precision;
  selected_driver uuid;
begin
  if new.fulfillment_type <> 'delivery' or new.status in ('delivered', 'cancelled') then
    new.driver_id := null;
    return new;
  end if;

  customer_lat := coalesce(
    nullif(new.delivery_address ->> 'latitude', '')::double precision,
    nullif(new.delivery_address -> 'point' ->> 0, '')::double precision
  );
  customer_lng := coalesce(
    nullif(new.delivery_address ->> 'longitude', '')::double precision,
    nullif(new.delivery_address -> 'point' ->> 1, '')::double precision
  );

  select locations.driver_id into selected_driver
  from public.driver_locations locations
  join public.driver_applications applications
    on applications.user_id = locations.driver_id and applications.status = 'approved'
  join public.user_roles roles
    on roles.user_id = locations.driver_id and roles.role = 'driver'
  where locations.is_online
    and locations.latitude is not null
    and locations.longitude is not null
    and locations.last_location_update >= now() - interval '2 minutes'
    and locations.current_order_id is null
    and not exists (
      select 1 from public.store_orders active_order
      where active_order.driver_id = locations.driver_id
        and active_order.fulfillment_type = 'delivery'
        and active_order.status in ('new', 'confirmed', 'preparing', 'ready', 'picked_up')
    )
  order by
    case when customer_lat is null or customer_lng is null then 0 else
      6371 * 2 * asin(sqrt(
        power(sin(radians(locations.latitude - customer_lat) / 2), 2)
        + cos(radians(customer_lat)) * cos(radians(locations.latitude))
        * power(sin(radians(locations.longitude - customer_lng) / 2), 2)
      ))
    end,
    locations.last_location_update desc
  for update of locations skip locked
  limit 1;

  if selected_driver is null then
    raise exception 'no_driver_online' using errcode = 'P0002';
  end if;

  new.driver_id := selected_driver;
  update public.driver_locations
  set current_order_id = new.id, updated_at = now()
  where driver_id = selected_driver;
  return new;
end;
$$;

drop trigger if exists assign_nearest_online_driver_trigger on public.store_orders;
create trigger assign_nearest_online_driver_trigger
before insert on public.store_orders
for each row execute function private.assign_nearest_online_driver();

create or replace function private.release_driver_after_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('delivered', 'cancelled') and old.status is distinct from new.status and new.driver_id is not null then
    update public.driver_locations
    set current_order_id = null, updated_at = now()
    where driver_id = new.driver_id and current_order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists release_driver_after_order_trigger on public.store_orders;
create trigger release_driver_after_order_trigger
after update of status on public.store_orders
for each row execute function private.release_driver_after_order();

-- Coordinates for the bundled São Paulo demo restaurants.
update public.stores set latitude = -23.5547, longitude = -46.6580 where cnpj = '90000000000001';
update public.stores set latitude = -23.5534, longitude = -46.6523 where cnpj = '90000000000002';
update public.stores set latitude = -23.5612, longitude = -46.6346 where cnpj = '90000000000003';
update public.stores set latitude = -23.5659, longitude = -46.6389 where cnpj = '90000000000004';
update public.stores set latitude = -23.5686, longitude = -46.6568 where cnpj = '90000000000005';

alter table public.driver_locations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_locations'
  ) then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
end;
$$;

notify pgrst, 'reload schema';
