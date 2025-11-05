--
-- Auto-assign newly created auth users to default company as Viewer
-- Company: The Nextperience Group -> 00000000-0000-0000-0000-000000000001
-- Role: Viewer -> 10000000-0000-0000-0000-000000000004
--

begin;

do $$
declare
  v_company_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_viewer_role_id constant uuid := '10000000-0000-0000-0000-000000000004';
begin
  -- Ensure the assign function exists
  perform 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'assign_user_to_company_role';
  -- if not found, the following trigger will fail at runtime, but we keep going
end $$;

-- Create a trigger function in the auth schema to call the public assigner
create or replace function auth.handle_new_user_default_assignment()
returns trigger
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  v_company_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_viewer_role_id constant uuid := '10000000-0000-0000-0000-000000000004';
begin
  -- Call the SECURITY DEFINER assignment function; it is idempotent
  perform assign_user_to_company_role(NEW.id, v_company_id, v_viewer_role_id);
  return NEW;
end;
$$;

-- Create trigger on auth.users after insert
drop trigger if exists trg_auto_assign_default_company on auth.users;
create trigger trg_auto_assign_default_company
after insert on auth.users
for each row
execute function auth.handle_new_user_default_assignment();

commit;


