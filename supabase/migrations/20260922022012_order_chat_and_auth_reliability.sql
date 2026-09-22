-- Keep account creation resilient when a CPF is already attached to another profile.
-- The authenticated driver application flow still rejects duplicate CPFs explicitly.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cpf_digits text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g');
begin
  if not private.is_valid_cpf(cpf_digits)
    or exists (select 1 from public.profiles where cpf = cpf_digits and id <> new.id) then
    cpf_digits := null;
  end if;

  insert into public.profiles (id, full_name, avatar_url, cpf)
  values (
    new.id,
    coalesce(
      nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 80), ''),
      nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''),
      'Cliente'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    cpf_digits
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    cpf = coalesce(public.profiles.cpf, excluded.cpf);

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists order_messages_order_created_idx
  on public.order_messages (order_id, created_at);

create index if not exists order_messages_sender_idx
  on public.order_messages (sender_id);

create or replace function private.user_can_access_order_chat(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_orders orders
    where orders.id = target_order_id
      and (
        orders.customer_id = (select auth.uid())
        or orders.driver_id = (select auth.uid())
      )
  );
$$;

revoke all on function private.user_can_access_order_chat(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.user_can_access_order_chat(uuid) to authenticated;

alter table public.order_messages enable row level security;

drop policy if exists order_messages_participant_read on public.order_messages;
create policy order_messages_participant_read
  on public.order_messages for select
  to authenticated
  using ((select private.user_can_access_order_chat(order_id)));

drop policy if exists order_messages_participant_send on public.order_messages;
create policy order_messages_participant_send
  on public.order_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.user_can_access_order_chat(order_id))
    and exists (
      select 1 from public.store_orders orders
      where orders.id = public.order_messages.order_id
        and orders.status not in ('cancelled', 'delivered')
    )
  );

revoke all on table public.order_messages from anon, authenticated;
grant select, insert on table public.order_messages to authenticated;

alter table public.order_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end
$$;

notify pgrst, 'reload schema';
