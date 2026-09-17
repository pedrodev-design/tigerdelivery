create index if not exists driver_locations_current_order_idx
  on public.driver_locations (current_order_id)
  where current_order_id is not null;

