alter table public.driver_identity_verifications
  drop constraint if exists driver_identity_verifications_provider_check;
alter table public.driver_identity_verifications
  add constraint driver_identity_verifications_provider_check check (provider in ('stripe', 'manual'));
alter table public.driver_identity_verifications
  add column if not exists selfie_path text,
  add column if not exists selfie_captured_at timestamptz;

insert into storage.buckets (id, name, public)
values ('driver-selfies', 'driver-selfies', false)
on conflict (id) do update set public = false;

drop policy if exists driver_selfies_insert_own on storage.objects;
create policy driver_selfies_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'driver-selfies' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists driver_selfies_select_own on storage.objects;
create policy driver_selfies_select_own on storage.objects for select to authenticated
using (bucket_id = 'driver-selfies' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists driver_selfies_select_admin on storage.objects;
create policy driver_selfies_select_admin on storage.objects for select to authenticated
using (bucket_id = 'driver-selfies' and (select private.current_user_is_admin()));

create or replace function public.submit_driver_face_scan(p_selfie_path text)
returns public.driver_identity_verifications
language plpgsql security definer set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid()); result public.driver_identity_verifications;
begin
  if current_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.driver_applications where user_id = current_user_id) then raise exception 'driver_application_required' using errcode = '42501'; end if;
  if split_part(coalesce(p_selfie_path, ''), '/', 1) <> current_user_id::text or split_part(p_selfie_path, '/', 2) = '' or p_selfie_path like '%..%' then raise exception 'invalid_selfie_path' using errcode = '22023'; end if;
  insert into public.driver_identity_verifications (user_id, provider, status, selfie_path, selfie_captured_at, failure_reason, verified_at)
  values (current_user_id, 'manual', 'pending', p_selfie_path, now(), null, null)
  on conflict (user_id) do update set provider = 'manual', status = 'pending', selfie_path = excluded.selfie_path, selfie_captured_at = excluded.selfie_captured_at, failure_reason = null, verified_at = null, updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.review_driver_identity(p_user_id uuid, p_status text, p_reason text default null)
returns public.driver_identity_verifications
language plpgsql security definer set search_path = ''
as $$
declare next_status public.driver_identity_status; result public.driver_identity_verifications;
begin
  if not (select private.current_user_is_admin()) then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_status not in ('verified', 'unverified') then raise exception 'invalid_identity_status' using errcode = '22023'; end if;
  next_status := p_status::public.driver_identity_status;
  update public.driver_identity_verifications set status = next_status, failure_reason = nullif(left(trim(coalesce(p_reason, '')), 500), ''), verified_at = case when next_status = 'verified' then now() else null end, updated_at = now() where user_id = p_user_id returning * into result;
  if result.user_id is null then raise exception 'identity_not_found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

revoke all on function public.submit_driver_face_scan(text) from public, anon;
grant execute on function public.submit_driver_face_scan(text) to authenticated;
revoke all on function public.review_driver_identity(uuid, text, text) from public, anon;
grant execute on function public.review_driver_identity(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
