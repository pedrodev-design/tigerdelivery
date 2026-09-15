do $$
declare
  test_driver_id uuid;
begin
  select id into test_driver_id
  from auth.users
  where lower(email) = lower('agencyventax+motorista@gmail.com')
  limit 1;

  if test_driver_id is null then
    raise exception 'test_driver_not_found';
  end if;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = test_driver_id;

  update public.profiles
  set full_name = 'Motorista Teste TigreFood',
      cpf = '52998224725',
      updated_at = now()
  where id = test_driver_id;

  insert into public.driver_applications (
    user_id,
    phone,
    vehicle_type,
    vehicle_plate,
    city,
    status,
    review_notes,
    reviewed_at
  )
  values (
    test_driver_id,
    '11999998888',
    'motorcycle',
    'TGR2F26',
    'São Paulo',
    'approved',
    'Conta de demonstração aprovada para teste do despacho.',
    now()
  )
  on conflict (user_id) do update
    set phone = excluded.phone,
        vehicle_type = excluded.vehicle_type,
        vehicle_plate = excluded.vehicle_plate,
        city = excluded.city,
        status = 'approved',
        review_notes = excluded.review_notes,
        reviewed_at = now(),
        updated_at = now();

  insert into public.driver_identity_verifications (
    user_id,
    provider,
    status,
    checks,
    verified_at
  )
  values (
    test_driver_id,
    'manual',
    'verified',
    '{"test_account": true, "document": "approved", "face": "approved"}'::jsonb,
    now()
  )
  on conflict (user_id) do update
    set provider = 'manual',
        status = 'verified',
        failure_reason = null,
        checks = excluded.checks,
        verified_at = now(),
        updated_at = now();

  insert into public.user_roles (user_id, role)
  values (test_driver_id, 'driver')
  on conflict (user_id) do update
    set role = 'driver',
        updated_at = now();
end;
$$;
