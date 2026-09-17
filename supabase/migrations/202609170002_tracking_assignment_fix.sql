-- Link the selected driver only after the order row exists so the FK remains valid.
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
  return new;
end;
$$;

create or replace function private.link_assigned_driver_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.driver_id is not null and new.fulfillment_type = 'delivery' then
    update public.driver_locations
    set current_order_id = new.id, updated_at = now()
    where driver_id = new.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists link_assigned_driver_order_trigger on public.store_orders;
create trigger link_assigned_driver_order_trigger
after insert on public.store_orders
for each row execute function private.link_assigned_driver_order();

notify pgrst, 'reload schema';
