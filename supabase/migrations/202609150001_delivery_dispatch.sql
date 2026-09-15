alter table public.store_orders
  add column if not exists driver_id uuid references auth.users (id) on delete set null,
  add column if not exists fulfillment_type text not null default 'delivery',
  add column if not exists payment_method text,
  add column if not exists service_fee numeric(10, 2) not null default 0,
  add column if not exists discount numeric(10, 2) not null default 0,
  add column if not exists driver_fee numeric(10, 2) not null default 0,
  add column if not exists driver_accepted_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists is_demo boolean not null default false;

alter table public.store_orders
  drop constraint if exists store_orders_fulfillment_type_check,
  add constraint store_orders_fulfillment_type_check check (fulfillment_type in ('delivery', 'pickup')),
  drop constraint if exists store_orders_payment_method_check,
  add constraint store_orders_payment_method_check check (payment_method is null or payment_method in ('pix', 'card', 'cash')),
  drop constraint if exists store_orders_service_fee_check,
  add constraint store_orders_service_fee_check check (service_fee >= 0),
  drop constraint if exists store_orders_discount_check,
  add constraint store_orders_discount_check check (discount >= 0),
  drop constraint if exists store_orders_driver_fee_check,
  add constraint store_orders_driver_fee_check check (driver_fee >= 0);

create index if not exists store_orders_driver_status_idx
  on public.store_orders (driver_id, status, created_at desc)
  where driver_id is not null;

create or replace function private.current_user_is_approved_driver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles roles
    join public.driver_applications applications on applications.user_id = roles.user_id
    where roles.user_id = (select auth.uid())
      and roles.role = 'driver'
      and applications.status = 'approved'
  );
$$;

revoke all on function private.current_user_is_approved_driver() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_user_is_approved_driver() to authenticated;

drop policy if exists store_orders_store_access on public.store_orders;
drop policy if exists store_orders_customer_store_driver_access on public.store_orders;
create policy store_orders_customer_store_driver_access
  on public.store_orders for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or (driver_id = (select auth.uid()) and (select private.current_user_is_approved_driver()))
    or (select private.user_can_manage_store(store_id))
  );

drop policy if exists store_order_items_access on public.store_order_items;
create policy store_order_items_access
  on public.store_order_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.store_orders orders
      where orders.id = store_order_items.order_id
        and (
          orders.customer_id = (select auth.uid())
          or (orders.driver_id = (select auth.uid()) and (select private.current_user_is_approved_driver()))
          or (select private.user_can_manage_store(orders.store_id))
        )
    )
  );

create or replace function public.place_demo_order(
  p_store_name text,
  p_items jsonb,
  p_delivery_address jsonb,
  p_fulfillment text,
  p_payment_method text,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_service_fee numeric,
  p_discount numeric,
  p_total numeric
)
returns public.store_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  store_row public.stores;
  order_row public.store_orders;
  assigned_driver_id uuid;
  item jsonb;
  item_name text;
  item_quantity integer;
  item_unit_price numeric(10, 2);
  computed_subtotal numeric(10, 2) := 0;
  computed_total numeric(10, 2);
  safe_delivery_fee numeric(10, 2);
  safe_service_fee numeric(10, 2);
  safe_discount numeric(10, 2);
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_fulfillment not in ('delivery', 'pickup') then
    raise exception 'invalid_fulfillment' using errcode = '22023';
  end if;

  if p_payment_method not in ('pix', 'card', 'cash') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  if p_fulfillment = 'delivery'
    and (jsonb_typeof(p_delivery_address) is distinct from 'object'
      or nullif(trim(coalesce(p_delivery_address ->> 'street', p_delivery_address ->> 'label', '')), '') is null) then
    raise exception 'delivery_address_required' using errcode = '22023';
  end if;

  select * into store_row
  from public.stores
  where lower(name) = lower(trim(p_store_name))
    and status = 'approved'
    and is_open
  order by created_at
  limit 1;

  if store_row.id is null then
    raise exception 'demo_store_unavailable' using errcode = 'P0002';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_name := nullif(left(trim(coalesce(item ->> 'name', '')), 100), '');
    if item_name is null
      or coalesce(item ->> 'quantity', '') !~ '^[0-9]{1,2}$'
      or coalesce(item ->> 'unit_price', '') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'invalid_item' using errcode = '22023';
    end if;

    item_quantity := (item ->> 'quantity')::integer;
    item_unit_price := (item ->> 'unit_price')::numeric(10, 2);
    if item_quantity not between 1 and 99 or item_unit_price < 0 or item_unit_price > 1000 then
      raise exception 'invalid_item' using errcode = '22023';
    end if;
    computed_subtotal := computed_subtotal + item_quantity * item_unit_price;
  end loop;

  safe_delivery_fee := case when p_fulfillment = 'pickup' then 0 else round(greatest(coalesce(p_delivery_fee, 0), 0), 2) end;
  safe_service_fee := round(greatest(coalesce(p_service_fee, 0), 0), 2);
  safe_discount := round(greatest(coalesce(p_discount, 0), 0), 2);
  computed_total := round(greatest(computed_subtotal + safe_delivery_fee + safe_service_fee - safe_discount, 0), 2);

  if abs(computed_subtotal - round(coalesce(p_subtotal, -1), 2)) > 0.02
    or abs(computed_total - round(coalesce(p_total, -1), 2)) > 0.02
    or computed_total > 5000 then
    raise exception 'invalid_order_total' using errcode = '22023';
  end if;

  if p_fulfillment = 'delivery' then
    select applications.user_id into assigned_driver_id
    from public.driver_applications applications
    join public.user_roles roles on roles.user_id = applications.user_id and roles.role = 'driver'
    where applications.status = 'approved'
    order by applications.reviewed_at asc nulls last, applications.submitted_at asc
    limit 1;

    if assigned_driver_id is null then
      raise exception 'no_driver_available' using errcode = 'P0002';
    end if;
  end if;

  insert into public.store_orders (
    store_id,
    customer_id,
    driver_id,
    status,
    subtotal,
    delivery_fee,
    service_fee,
    discount,
    driver_fee,
    total,
    delivery_address,
    fulfillment_type,
    payment_method,
    accepted_at,
    is_demo
  )
  values (
    store_row.id,
    current_user_id,
    assigned_driver_id,
    'confirmed',
    computed_subtotal,
    safe_delivery_fee,
    safe_service_fee,
    safe_discount,
    case when p_fulfillment = 'delivery' then greatest(6.50, safe_delivery_fee) else 0 end,
    computed_total,
    case when p_fulfillment = 'delivery' then p_delivery_address else null end,
    p_fulfillment,
    p_payment_method,
    now(),
    true
  )
  returning * into order_row;

  insert into public.store_order_items (order_id, product_name, quantity, unit_price, options)
  select
    order_row.id,
    left(trim(value ->> 'name'), 100),
    (value ->> 'quantity')::integer,
    (value ->> 'unit_price')::numeric(10, 2),
    case when jsonb_typeof(value -> 'options') = 'array' then value -> 'options' else '[]'::jsonb end
  from jsonb_array_elements(p_items);

  return order_row;
end;
$$;

revoke all on function public.place_demo_order(text, jsonb, jsonb, text, text, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.place_demo_order(text, jsonb, jsonb, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

create or replace function public.driver_update_demo_order(
  p_order_id uuid,
  p_action text
)
returns public.store_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  order_row public.store_orders;
begin
  if current_user_id is null or not (select private.current_user_is_approved_driver()) then
    raise exception 'approved_driver_required' using errcode = '42501';
  end if;

  select * into order_row
  from public.store_orders
  where id = p_order_id
    and driver_id = current_user_id
    and fulfillment_type = 'delivery'
  for update;

  if order_row.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'accept' then
    if order_row.status not in ('confirmed', 'preparing', 'ready') then
      raise exception 'order_not_available' using errcode = '22023';
    end if;
    update public.store_orders
    set driver_accepted_at = coalesce(driver_accepted_at, now())
    where id = order_row.id
    returning * into order_row;
  elsif p_action = 'pickup' then
    if order_row.driver_accepted_at is null or order_row.status not in ('confirmed', 'preparing', 'ready') then
      raise exception 'order_not_ready_for_pickup' using errcode = '22023';
    end if;
    update public.store_orders
    set status = 'picked_up', picked_up_at = now()
    where id = order_row.id
    returning * into order_row;
  elsif p_action = 'deliver' then
    if order_row.status <> 'picked_up' then
      raise exception 'order_not_picked_up' using errcode = '22023';
    end if;
    update public.store_orders
    set status = 'delivered', delivered_at = now()
    where id = order_row.id
    returning * into order_row;
  else
    raise exception 'invalid_driver_action' using errcode = '22023';
  end if;

  return order_row;
end;
$$;

revoke all on function public.driver_update_demo_order(uuid, text) from public, anon;
grant execute on function public.driver_update_demo_order(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'store_orders'
  ) then
    alter publication supabase_realtime add table public.store_orders;
  end if;
end;
$$;

do $$
declare
  demo_owner_id uuid;
  demo_store record;
begin
  select id into demo_owner_id
  from auth.users
  where lower(email) = lower('agencyventax@gmail.com')
  limit 1;

  if demo_owner_id is null then
    return;
  end if;

  for demo_store in
    select * from (values
      ('Brasa Burger', 'Hambúrgueres', '90000000000001', 'Rua Augusta, 1500 - Consolação'),
      ('Forno & Fatia', 'Pizzas', '90000000000002', 'Rua Frei Caneca, 640 - Consolação'),
      ('Nori Sushi', 'Japonesa', '90000000000003', 'Rua da Glória, 290 - Liberdade'),
      ('Croc Chicken', 'Frango', '90000000000004', 'Rua Vergueiro, 830 - Liberdade'),
      ('Verde Cozinha', 'Saudáveis', '90000000000005', 'Rua Pamplona, 780 - Jardim Paulista'),
      ('Casa da Massa', 'Refeições', '90000000000006', 'Rua Treze de Maio, 520 - Bela Vista'),
      ('Doce Pedaço', 'Doces', '90000000000007', 'Rua Harmonia, 310 - Vila Madalena'),
      ('Café do Bairro', 'Cafés', '90000000000008', 'Rua dos Pinheiros, 980 - Pinheiros'),
      ('Ponto do Smash', 'Hambúrgueres', '90000000000009', 'Rua Rego Freitas, 410 - República'),
      ('Cantina do Bairro', 'Refeições', '90000000000010', 'Rua Martiniano de Carvalho, 260 - Bela Vista'),
      ('Sato Sushi', 'Japonesa', '90000000000011', 'Rua Thomaz Gonzaga, 95 - Liberdade'),
      ('Leve Cozinha', 'Saudáveis', '90000000000012', 'Alameda Santos, 1240 - Jardim Paulista'),
      ('Doce de Casa', 'Doces', '90000000000013', 'Rua Fradique Coutinho, 455 - Pinheiros'),
      ('Padoca Central', 'Cafés', '90000000000014', 'Avenida Ipiranga, 780 - República')
    ) as seeded(name, category, cnpj, address)
  loop
    insert into public.stores (owner_id, name, category, cnpj, phone, city, address, description, status, is_open)
    values (demo_owner_id, demo_store.name, demo_store.category, demo_store.cnpj, '11999990000', 'São Paulo', demo_store.address, 'Loja de demonstração do fluxo completo TigreFood.', 'approved', true)
    on conflict (cnpj) do update
      set name = excluded.name,
          category = excluded.category,
          city = excluded.city,
          address = excluded.address,
          description = excluded.description,
          status = 'approved',
          is_open = true,
          updated_at = now();
  end loop;
end;
$$;

notify pgrst, 'reload schema';
