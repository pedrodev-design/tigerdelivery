-- Orders can be confirmed while every driver is offline. The next approved
-- driver who goes online receives the oldest nearby waiting delivery.
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

  -- No driver online is a valid state. Keep the order in the dispatch queue.
  new.driver_id := selected_driver;
  return new;
end;
$$;

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
  waiting_order_id uuid;
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
    current_user_id, p_is_online, p_latitude, p_longitude,
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

  if p_is_online and location_row.current_order_id is null then
    select orders.id into waiting_order_id
    from public.store_orders orders
    join public.stores stores on stores.id = orders.store_id
    where orders.driver_id is null
      and orders.fulfillment_type = 'delivery'
      and orders.status in ('new', 'confirmed', 'preparing', 'ready')
      and orders.created_at >= now() - interval '4 hours'
    order by
      case when stores.latitude is null or stores.longitude is null then 999999 else
        6371 * 2 * asin(sqrt(
          power(sin(radians(stores.latitude - p_latitude) / 2), 2)
          + cos(radians(p_latitude)) * cos(radians(stores.latitude))
          * power(sin(radians(stores.longitude - p_longitude) / 2), 2)
        ))
      end,
      orders.created_at
    for update of orders skip locked
    limit 1;

    if waiting_order_id is not null then
      update public.store_orders
      set driver_id = current_user_id, updated_at = now()
      where id = waiting_order_id and driver_id is null;

      update public.driver_locations
      set current_order_id = waiting_order_id, updated_at = now()
      where driver_id = current_user_id;
    end if;
  end if;

  select * into location_row from public.driver_locations where driver_id = current_user_id;
  return location_row;
end;
$$;

-- Remove only obsolete seeded queue entries so they do not mask new tests.
update public.store_orders
set status = 'cancelled', updated_at = now()
where is_demo
  and driver_id is null
  and status in ('new', 'confirmed', 'preparing', 'ready')
  and created_at < now() - interval '1 day';

notify pgrst, 'reload schema';

