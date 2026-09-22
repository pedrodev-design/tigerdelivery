-- Keep the demo checkout usable from any real customer address. Catalog stores
-- have illustrative Sao Paulo coordinates, so long-distance addresses use the
-- store delivery radius as a capped simulation instead of rejecting the order.
create or replace function public.quote_delivery_fee(
  p_store_name text,
  p_latitude double precision,
  p_longitude double precision
)
returns table (delivery_fee numeric, distance_km numeric, estimated_minutes integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  store_row public.stores;
  actual_distance numeric;
  billable_distance numeric;
begin
  if not (p_latitude between -90 and 90) or not (p_longitude between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  select * into store_row
  from public.stores
  where lower(name) = lower(trim(p_store_name)) and status = 'approved' and is_open
  order by created_at
  limit 1;

  if store_row.id is null or store_row.latitude is null or store_row.longitude is null then
    raise exception 'store_location_unavailable' using errcode = 'P0002';
  end if;

  actual_distance := 6371 * 2 * asin(sqrt(
    power(sin(radians(store_row.latitude - p_latitude) / 2), 2)
    + cos(radians(p_latitude)) * cos(radians(store_row.latitude))
    * power(sin(radians(store_row.longitude - p_longitude) / 2), 2)
  ));
  billable_distance := least(actual_distance, greatest(store_row.delivery_radius_km, 1));

  return query select
    round(least(24.90, greatest(4.99, 3.90 + billable_distance * 1.15)), 2),
    round(billable_distance, 2),
    greatest(12, ceil(billable_distance / 0.36)::integer + 10);
end;
$$;

revoke all on function public.quote_delivery_fee(text, double precision, double precision) from public;
grant execute on function public.quote_delivery_fee(text, double precision, double precision) to anon, authenticated;

create or replace function private.apply_delivery_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  store_row public.stores;
  customer_lat double precision;
  customer_lng double precision;
  actual_distance numeric;
  billable_distance numeric;
begin
  if new.fulfillment_type = 'pickup' then
    new.delivery_fee := 0;
    new.driver_fee := 0;
    new.route_distance_m := null;
    new.route_duration_s := null;
    new.total := round(greatest(new.subtotal + new.service_fee - new.discount, 0), 2);
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
  select * into store_row from public.stores where id = new.store_id;

  if customer_lat is not null and customer_lng is not null
    and store_row.latitude is not null and store_row.longitude is not null then
    actual_distance := 6371 * 2 * asin(sqrt(
      power(sin(radians(store_row.latitude - customer_lat) / 2), 2)
      + cos(radians(customer_lat)) * cos(radians(store_row.latitude))
      * power(sin(radians(store_row.longitude - customer_lng) / 2), 2)
    ));
    billable_distance := least(actual_distance, greatest(store_row.delivery_radius_km, 1));
    new.delivery_fee := round(least(24.90, greatest(4.99, 3.90 + billable_distance * 1.15)), 2);
    new.route_distance_m := round(billable_distance * 1000);
    new.route_duration_s := greatest(720, ceil(billable_distance / 0.006)::integer + 600);
    new.estimated_arrival_at := now() + make_interval(secs => new.route_duration_s);
  end if;

  new.driver_fee := greatest(6.50, round(new.delivery_fee * 0.82, 2));
  new.total := round(greatest(new.subtotal + new.delivery_fee + new.service_fee - new.discount, 0), 2);
  return new;
end;
$$;

notify pgrst, 'reload schema';
