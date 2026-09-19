do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_applications'
  ) then
    alter publication supabase_realtime add table public.driver_applications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stores'
  ) then
    alter publication supabase_realtime add table public.stores;
  end if;
end
$$;
