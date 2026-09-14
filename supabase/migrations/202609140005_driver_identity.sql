do $$ begin
  create type public.driver_identity_status as enum ('not_started', 'pending', 'verified', 'unverified', 'canceled');
exception when duplicate_object then null;
end $$;

create table if not exists public.driver_identity_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_session_id text unique,
  status public.driver_identity_status not null default 'not_started',
  failure_reason text,
  checks jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_identity_status_idx
  on public.driver_identity_verifications (status, updated_at desc);

drop trigger if exists driver_identity_verifications_set_updated_at on public.driver_identity_verifications;
create trigger driver_identity_verifications_set_updated_at
  before update on public.driver_identity_verifications
  for each row execute procedure private.set_updated_at();

alter table public.driver_identity_verifications enable row level security;
drop policy if exists driver_identity_select_own on public.driver_identity_verifications;
create policy driver_identity_select_own
  on public.driver_identity_verifications for select
  to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists driver_identity_select_admin on public.driver_identity_verifications;
create policy driver_identity_select_admin
  on public.driver_identity_verifications for select
  to authenticated
  using ((select private.current_user_is_admin()));

revoke all on table public.driver_identity_verifications from anon, authenticated;
grant select on table public.driver_identity_verifications to authenticated;
grant all on table public.driver_identity_verifications to service_role;

create or replace function public.review_driver_application(
  p_application_id uuid,
  p_status text,
  p_notes text default null
)
returns public.driver_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.driver_application_status;
  application public.driver_applications;
  identity_status public.driver_identity_status;
begin
  if not (select private.current_user_is_admin()) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'invalid_review_status' using errcode = '22023';
  end if;
  next_status := p_status::public.driver_application_status;

  select * into application
  from public.driver_applications
  where id = p_application_id;
  if application.id is null then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if next_status = 'approved' then
    select status into identity_status
    from public.driver_identity_verifications
    where user_id = application.user_id;
    if identity_status is distinct from 'verified' then
      raise exception 'identity_verification_required' using errcode = '42501';
    end if;
  end if;

  update public.driver_applications
  set status = next_status,
      review_notes = nullif(left(trim(coalesce(p_notes, '')), 500), ''),
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = p_application_id
  returning * into application;

  if next_status = 'approved' then
    insert into public.user_roles (user_id, role)
    values (application.user_id, 'driver')
    on conflict (user_id) do update
      set role = case
        when public.user_roles.role = 'admin' then 'admin'::public.app_role
        else 'driver'::public.app_role
      end,
      updated_at = now();
  else
    update public.user_roles
    set role = 'customer', updated_at = now()
    where user_id = application.user_id and role <> 'admin';
  end if;

  return application;
end;
$$;

revoke all on function public.review_driver_application(uuid, text, text) from public, anon;
grant execute on function public.review_driver_application(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
