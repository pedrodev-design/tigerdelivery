-- The same order conversation is shared by customer, assigned driver, and store managers.
create or replace function private.user_can_access_order_chat(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.store_orders orders
    where orders.id = target_order_id
      and (
        orders.customer_id = (select auth.uid())
        or orders.driver_id = (select auth.uid())
        or (select private.user_can_manage_store(orders.store_id))
      )
  );
$$;

revoke all on function private.user_can_access_order_chat(uuid) from public, anon, authenticated;
grant execute on function private.user_can_access_order_chat(uuid) to authenticated;

create or replace function private.order_display_context(p_order_ids uuid[])
returns table (
  order_id uuid,
  store_name text,
  store_logo_url text,
  customer_id uuid,
  customer_name text,
  customer_avatar_url text,
  driver_id uuid,
  driver_name text,
  driver_avatar_url text,
  item_name text,
  item_image_url text,
  item_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select orders.id, stores.name, stores.logo_url,
    orders.customer_id, customer.full_name, customer.avatar_url,
    orders.driver_id, driver.full_name, driver.avatar_url,
    first_item.product_name, product.image_url, item_total.count
  from public.store_orders orders
  join public.stores stores on stores.id = orders.store_id
  left join public.profiles customer on customer.id = orders.customer_id
  left join public.profiles driver on driver.id = orders.driver_id
  left join lateral (
    select items.product_name, items.product_id
    from public.store_order_items items
    where items.order_id = orders.id
    order by items.id
    limit 1
  ) first_item on true
  left join public.store_products product on product.id = first_item.product_id
  left join lateral (
    select count(*) as count
    from public.store_order_items items
    where items.order_id = orders.id
  ) item_total on true
  where (select auth.uid()) is not null
    and coalesce(array_length(p_order_ids, 1), 0) between 1 and 50
    and orders.id = any(p_order_ids)
    and (select private.user_can_access_order_chat(orders.id));
$$;

revoke all on function private.order_display_context(uuid[]) from public, anon, authenticated;
grant execute on function private.order_display_context(uuid[]) to authenticated;

-- Exposed API wrapper keeps the privileged profile lookup in the private schema.
create or replace function public.order_display_context(p_order_ids uuid[])
returns table (
  order_id uuid,
  store_name text,
  store_logo_url text,
  customer_id uuid,
  customer_name text,
  customer_avatar_url text,
  driver_id uuid,
  driver_name text,
  driver_avatar_url text,
  item_name text,
  item_image_url text,
  item_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.order_display_context(p_order_ids);
$$;

revoke all on function public.order_display_context(uuid[]) from public, anon, authenticated;
grant execute on function public.order_display_context(uuid[]) to authenticated;
