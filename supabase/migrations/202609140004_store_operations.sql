do $$ begin
  alter type public.app_role add value if not exists 'merchant';
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.store_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.store_member_role as enum ('owner', 'manager', 'staff');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.store_order_status as enum ('new', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  category text not null check (char_length(trim(category)) between 2 and 50),
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  city text not null check (char_length(trim(city)) between 2 and 80),
  address text,
  description text check (description is null or char_length(description) <= 500),
  logo_url text,
  cover_url text,
  status public.store_status not null default 'pending',
  review_notes text check (review_notes is null or char_length(review_notes) <= 500),
  is_open boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stores_cnpj_unique on public.stores (cnpj);
create index if not exists stores_status_created_idx on public.stores (status, created_at desc);
create index if not exists stores_owner_idx on public.stores (owner_id);

create table if not exists public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role public.store_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index if not exists store_members_user_idx on public.store_members (user_id);

create table if not exists public.store_hours (
  store_id uuid not null references public.stores (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  primary key (store_id, weekday),
  constraint store_hours_range check (is_closed or (opens_at is not null and closes_at is not null))
);

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_categories_name_unique on public.store_categories (store_id, lower(name));
create index if not exists store_categories_store_position_idx on public.store_categories (store_id, position);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.store_categories (id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text check (description is null or char_length(description) <= 500),
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  prep_minutes smallint not null default 25 check (prep_minutes between 1 and 240),
  available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_products_store_idx on public.store_products (store_id, available, position);
create index if not exists store_products_category_idx on public.store_products (category_id, available);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  customer_id uuid references auth.users (id) on delete set null,
  status public.store_order_status not null default 'new',
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  total numeric(10, 2) not null default 0 check (total >= 0),
  delivery_address jsonb,
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  accepted_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_store_status_idx on public.store_orders (store_id, status, created_at desc);
create index if not exists store_orders_customer_idx on public.store_orders (customer_id, created_at desc);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  options jsonb not null default '[]'::jsonb
);

create index if not exists store_order_items_order_idx on public.store_order_items (order_id);

create or replace function private.user_can_manage_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.current_user_is_admin())
    or exists (
      select 1 from public.store_members
      where store_id = target_store_id
        and user_id = (select auth.uid())
        and member_role in ('owner', 'manager')
    );
$$;

revoke all on function private.user_can_manage_store(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.user_can_manage_store(uuid) to authenticated;

create or replace function public.submit_store_application(
  p_name text,
  p_category text,
  p_cnpj text,
  p_phone text,
  p_city text,
  p_address text default null,
  p_description text default null
)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  cnpj_digits text := regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g');
  phone_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  store_row public.stores;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 100 then
    raise exception 'invalid_store_name' using errcode = '22023';
  end if;
  if cnpj_digits !~ '^[0-9]{14}$' then
    raise exception 'invalid_cnpj' using errcode = '22023';
  end if;
  if phone_digits !~ '^[0-9]{10,11}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_city, ''))) < 2 then
    raise exception 'invalid_city' using errcode = '22023';
  end if;
  if exists (select 1 from public.stores where owner_id = current_user_id and status in ('pending', 'approved')) then
    raise exception 'store_already_registered' using errcode = '23505';
  end if;

  insert into public.stores (owner_id, name, category, cnpj, phone, city, address, description)
  values (current_user_id, trim(p_name), trim(p_category), cnpj_digits, phone_digits, trim(p_city), nullif(trim(p_address), ''), nullif(trim(p_description), ''))
  returning * into store_row;

  insert into public.store_members (store_id, user_id, member_role)
  values (store_row.id, current_user_id, 'owner')
  on conflict (store_id, user_id) do nothing;

  return store_row;
exception when unique_violation then
  raise exception 'cnpj_already_registered' using errcode = '23505';
end;
$$;

revoke all on function public.submit_store_application(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_store_application(text, text, text, text, text, text, text) to authenticated;

create or replace function public.review_store_application(
  p_store_id uuid,
  p_status public.store_status,
  p_notes text default null
)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  store_row public.stores;
begin
  if not (select private.current_user_is_admin()) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'invalid_review_status' using errcode = '22023';
  end if;
  update public.stores
  set status = p_status,
      review_notes = nullif(left(trim(coalesce(p_notes, '')), 500), ''),
      is_open = p_status = 'approved',
      updated_at = now()
  where id = p_store_id
  returning * into store_row;
  if store_row.id is null then raise exception 'store_not_found' using errcode = 'P0002'; end if;
  return store_row;
end;
$$;

revoke all on function public.review_store_application(uuid, public.store_status, text) from public, anon;
grant execute on function public.review_store_application(uuid, public.store_status, text) to authenticated;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at before update on public.stores for each row execute procedure private.set_updated_at();
drop trigger if exists store_categories_set_updated_at on public.store_categories;
create trigger store_categories_set_updated_at before update on public.store_categories for each row execute procedure private.set_updated_at();
drop trigger if exists store_products_set_updated_at on public.store_products;
create trigger store_products_set_updated_at before update on public.store_products for each row execute procedure private.set_updated_at();
drop trigger if exists store_orders_set_updated_at on public.store_orders;
create trigger store_orders_set_updated_at before update on public.store_orders for each row execute procedure private.set_updated_at();

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_hours enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;

drop policy if exists stores_select_public_or_member on public.stores;
create policy stores_select_public_or_member on public.stores for select to authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or exists (select 1 from public.store_members where store_id = stores.id and user_id = (select auth.uid())) or (select private.current_user_is_admin()));
drop policy if exists stores_update_manager on public.stores;
create policy stores_update_manager on public.stores for update to authenticated
  using ((select private.user_can_manage_store(id))) with check ((select private.user_can_manage_store(id)));

drop policy if exists store_members_select_own on public.store_members;
create policy store_members_select_own on public.store_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists store_hours_select on public.store_hours;
create policy store_hours_select on public.store_hours for select to authenticated
  using (exists (select 1 from public.stores where id = store_hours.store_id and (status = 'approved' or (select private.user_can_manage_store(store_hours.store_id)))));
drop policy if exists store_hours_manage on public.store_hours;
create policy store_hours_manage on public.store_hours for all to authenticated
  using ((select private.user_can_manage_store(store_id))) with check ((select private.user_can_manage_store(store_id)));

drop policy if exists store_categories_select on public.store_categories;
create policy store_categories_select on public.store_categories for select to authenticated
  using (exists (select 1 from public.stores where id = store_categories.store_id and (status = 'approved' or (select private.user_can_manage_store(store_categories.store_id)))));
drop policy if exists store_categories_manage on public.store_categories;
create policy store_categories_manage on public.store_categories for all to authenticated
  using ((select private.user_can_manage_store(store_id))) with check ((select private.user_can_manage_store(store_id)));

drop policy if exists store_products_select on public.store_products;
create policy store_products_select on public.store_products for select to authenticated
  using (exists (select 1 from public.stores where id = store_products.store_id and (status = 'approved' or (select private.user_can_manage_store(store_products.store_id)))));
drop policy if exists store_products_manage on public.store_products;
create policy store_products_manage on public.store_products for all to authenticated
  using ((select private.user_can_manage_store(store_id))) with check ((select private.user_can_manage_store(store_id)));

drop policy if exists store_orders_store_access on public.store_orders;
create policy store_orders_store_access on public.store_orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.user_can_manage_store(store_id)));
drop policy if exists store_orders_manage on public.store_orders;
create policy store_orders_manage on public.store_orders for update to authenticated
  using ((select private.user_can_manage_store(store_id))) with check ((select private.user_can_manage_store(store_id)));

drop policy if exists store_order_items_access on public.store_order_items;
create policy store_order_items_access on public.store_order_items for select to authenticated
  using (exists (select 1 from public.store_orders where id = store_order_items.order_id and (customer_id = (select auth.uid()) or (select private.user_can_manage_store(store_id)))));

revoke all on table public.stores, public.store_members, public.store_hours, public.store_categories, public.store_products, public.store_orders, public.store_order_items from anon;
grant select on table public.stores, public.store_members, public.store_hours, public.store_categories, public.store_products, public.store_orders, public.store_order_items to authenticated;
grant update (name, category, phone, city, address, description, logo_url, cover_url, is_open) on table public.stores to authenticated;
grant insert, update, delete on table public.store_hours, public.store_categories, public.store_products to authenticated;
grant update (status, accepted_at, ready_at, delivered_at, customer_note) on table public.store_orders to authenticated;
