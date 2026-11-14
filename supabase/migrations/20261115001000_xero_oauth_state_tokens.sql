-- Single-use, short-lived state values for the Xero OAuth flow (prevents
-- an attacker attaching their own Xero to someone else's organisation).
create table if not exists public.xero_oauth_states (
  state       text primary key,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes')
);
alter table public.xero_oauth_states enable row level security;
revoke all on public.xero_oauth_states from anon, authenticated;

create or replace function public.create_xero_oauth_state(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_state text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not app_private.is_org_member(p_org_id) then
    raise exception 'Not a member of this organisation';
  end if;
  delete from public.xero_oauth_states where expires_at < now();
  v_state := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.xero_oauth_states (state, org_id, user_id) values (v_state, p_org_id, auth.uid());
  return v_state;
end;
$function$;
revoke execute on function public.create_xero_oauth_state(uuid) from public, anon;
grant  execute on function public.create_xero_oauth_state(uuid) to authenticated;

create or replace function public.consume_xero_oauth_state(p_state text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org_id uuid;
begin
  delete from public.xero_oauth_states
    where state = p_state and expires_at > now()
    returning org_id into v_org_id;
  return v_org_id;
end;
$function$;
revoke execute on function public.consume_xero_oauth_state(text) from public, anon, authenticated;
grant  execute on function public.consume_xero_oauth_state(text) to service_role;
