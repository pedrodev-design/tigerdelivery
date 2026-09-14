create index if not exists driver_applications_reviewed_by_idx
  on public.driver_applications (reviewed_by)
  where reviewed_by is not null;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles for select
  to authenticated
  using (
    (select auth.uid()) = id
    or (select private.current_user_is_admin())
  );

drop policy if exists user_roles_select_own on public.user_roles;
drop policy if exists user_roles_select_admin on public.user_roles;
create policy user_roles_select_self_or_admin
  on public.user_roles for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.current_user_is_admin())
  );

drop policy if exists driver_applications_select_own on public.driver_applications;
drop policy if exists driver_applications_select_admin on public.driver_applications;
create policy driver_applications_select_self_or_admin
  on public.driver_applications for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.current_user_is_admin())
  );

notify pgrst, 'reload schema';
