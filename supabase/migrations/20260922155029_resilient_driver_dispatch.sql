-- Keep driver presence alive independently from GPS freshness and make queued
-- deliveries self-healing when realtime or a location update is interrupted.
alter table public.driver_locations
  add column if not exists last_seen_at timestamptz;

update public.driver_locations
set last_seen_at = coalesce(last_location_update, updated_at)
where last_seen_at is null;

create index if not exists driver_locations_dispatch_presence_idx
  on public.driver_locations (last_seen_at desc)
  where is_online;

create or replace function private.claim_waiting_delivery(target_driver_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_order_id uuid;
begin
  perform 1
  from public.driver_locations
  where driver_id = target_driver_id
  for update;

  select orders.id into selected_order_id
  from public.store_orders orders
  where orders.driver_id = target_driver_id
    and orders.fulfillment_type = 'delivery'
    and orders.status in ('new', 'confirmed', 'preparing', 'ready', 'picked_up')
  order by orders.created_at
  limit 1;

  if selected_order_id is null then
    select orders.id into selected_order_id
    from public.store_orders orders
    where orders.driver_id is null
      and orders.fulfillment_type = 'delivery'
      and orders.status in ('new', 'confirmed', 'preparing', 'ready')
    order by orders.created_at
    for update skip locked
    limit 1;

    if selected_order_id is not null then
      update public.store_orders
      set driver_id = target_driver_id, updated_at = now()
      where id = selected_order_id and driver_id is null;

      if not found then
        selected_order_id := null;
      end if;
    end if;
  end if;

  update public.driver_locations
  set current_order_id = selected_order_id, updated_at = now()
  where driver_id = target_driver_id;

  return selected_order_id;
end;
$$;

revoke all on function private.claim_waiting_delivery(uuid) from public, anon, authenticated;

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
    and locations.last_seen_at >= now() - interval '90 seconds'
    and locations.current_order_id is null
    and not exists (
      select 1 from public.store_orders active_order
      where active_order.driver_id = locations.driver_id
        and active_order.fulfillment_type = 'delivery'
        and active_order.status in ('new', 'confirmed', 'preparing', 'ready', 'picked_up')
    )
  order by
    case
      when customer_lat is null or customer_lng is null
        or locations.latitude is null or locations.longitude is null then 999999
      else 6371 * 2 * asin(sqrt(
        power(sin(radians(locations.latitude - customer_lat) / 2), 2)
        + cos(radians(customer_lat)) * cos(radians(locations.latitude))
        * power(sin(radians(locations.longitude - customer_lng) / 2), 2)
      ))
    end,
    locations.last_seen_at desc
  for update of locations skip locked
  limit 1;

  new.driver_id := selected_driver;
  return new;
end;
$$;

create or replace function public.driver_heartbeat(
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
  if p_latitude is not null and not (p_latitude between -90 and 90)
    or p_longitude is not null and not (p_longitude between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  update public.driver_locations
  set last_seen_at = now(),
      latitude = coalesce(p_latitude, latitude),
      longitude = coalesce(p_longitude, longitude),
      accuracy_m = case when p_accuracy_m is null then accuracy_m else least(greatest(p_accuracy_m, 0), 10000) end,
      last_location_update = case when p_latitude is not null and p_longitude is not null then now() else last_location_update end,
      updated_at = now()
  where driver_id = current_user_id and is_online
  returning * into location_row;

  if location_row.driver_id is null then
    raise exception 'driver_is_offline' using errcode = '55000';
  end if;

  perform private.claim_waiting_delivery(current_user_id);

  select * into location_row
  from public.driver_locations
  where driver_id = current_user_id;
  return location_row;
end;
$$;

revoke all on function public.driver_heartbeat(double precision, double precision, numeric) from public, anon;
grant execute on function public.driver_heartbeat(double precision, double precision, numeric) to authenticated;

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
    driver_id, is_online, latitude, longitude, accuracy_m,
    last_location_update, last_seen_at, updated_at
  ) values (
    current_user_id, p_is_online, p_latitude, p_longitude,
    case when p_accuracy_m is null then null else least(greatest(p_accuracy_m, 0), 10000) end,
    case when p_latitude is not null and p_longitude is not null then now() else null end,
    case when p_is_online then now() else null end,
    now()
  )
  on conflict (driver_id) do update set
    is_online = excluded.is_online,
    latitude = coalesce(excluded.latitude, public.driver_locations.latitude),
    longitude = coalesce(excluded.longitude, public.driver_locations.longitude),
    accuracy_m = coalesce(excluded.accuracy_m, public.driver_locations.accuracy_m),
    last_location_update = coalesce(excluded.last_location_update, public.driver_locations.last_location_update),
    last_seen_at = excluded.last_seen_at,
    updated_at = now()
  returning * into location_row;

  if p_is_online then
    perform private.claim_waiting_delivery(current_user_id);
  end if;

  select * into location_row from public.driver_locations where driver_id = current_user_id;
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
      last_seen_at = now(),
      updated_at = now()
  where driver_id = current_user_id and is_online
  returning * into location_row;

  if location_row.driver_id is null then
    raise exception 'driver_is_offline' using errcode = '55000';
  end if;
  if location_row.current_order_id is null then
    perform private.claim_waiting_delivery(current_user_id);
  end if;

  select * into location_row from public.driver_locations where driver_id = current_user_id;
  return location_row;
end;
$$;

revoke all on function public.update_driver_location(double precision, double precision, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_driver_location(double precision, double precision, numeric, numeric, numeric) to authenticated;

create or replace function private.release_driver_after_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  should_claim_next boolean;
begin
  if new.status in ('delivered', 'cancelled')
    and old.status is distinct from new.status
    and new.driver_id is not null then
    update public.driver_locations
    set current_order_id = null, updated_at = now()
    where driver_id = new.driver_id and current_order_id = new.id
    returning is_online and last_seen_at >= now() - interval '90 seconds'
      into should_claim_next;

    if coalesce(should_claim_next, false) then
      perform private.claim_waiting_delivery(new.driver_id);
    end if;
  end if;
  return new;
end;
$$;

-- Repair the current demo queue once. Future assignments depend on heartbeats.
update public.driver_locations
set last_seen_at = now(), updated_at = now()
where is_online;

do $$
declare
  driver_row record;
begin
  for driver_row in
    select locations.driver_id
    from public.driver_locations locations
    join public.driver_applications applications
      on applications.user_id = locations.driver_id and applications.status = 'approved'
    join public.user_roles roles
      on roles.user_id = locations.driver_id and roles.role = 'driver'
    where locations.is_online
  loop
    perform private.claim_waiting_delivery(driver_row.driver_id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
