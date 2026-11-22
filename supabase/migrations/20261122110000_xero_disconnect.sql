-- Disconnecting Xero: remove the stored refresh token(s) and the connection row.
-- Also: rotating the token now deletes the previous vault secret instead of leaving it behind.
create or replace function public.remove_xero_connection(p_org_id uuid)
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  delete from vault.secrets where name like 'xero_refresh_token_' || p_org_id::text || '_%';
  delete from public.xero_connections where org_id = p_org_id;
  update public.integration_connections set status = 'not_connected', display_name = null, updated_at = now()
   where org_id = p_org_id and provider = 'xero';
end; $$;
revoke execute on function public.remove_xero_connection(uuid) from public, anon, authenticated;
grant execute on function public.remove_xero_connection(uuid) to service_role;

create or replace function public.store_xero_connection(p_org_id uuid, p_refresh_token text, p_tenant_id text, p_tenant_name text)
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
declare
  v_secret_id uuid;
  v_old uuid;
  v_secret_name text;
begin
  v_secret_name := 'xero_refresh_token_' || p_org_id::text || '_' || replace(clock_timestamp()::text, ' ', '_');
  select vault_secret_id into v_old from public.xero_connections where org_id = p_org_id;
  select vault.create_secret(p_refresh_token, v_secret_name, 'Xero refresh token') into v_secret_id;
  insert into public.xero_connections (org_id, tenant_id, tenant_name, vault_secret_id)
  values (p_org_id, p_tenant_id, p_tenant_name, v_secret_id)
  on conflict (org_id) do update set tenant_id = excluded.tenant_id, tenant_name = excluded.tenant_name, vault_secret_id = excluded.vault_secret_id, updated_at = now();
  if v_old is not null and v_old <> v_secret_id then delete from vault.secrets where id = v_old; end if;
  insert into public.integration_connections (org_id, provider, status, display_name)
  values (p_org_id, 'xero', 'connected', p_tenant_name)
  on conflict (org_id, provider) do update set status = 'connected', display_name = excluded.display_name, updated_at = now();
end; $$;
revoke execute on function public.store_xero_connection(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.store_xero_connection(uuid, text, text, text) to service_role;
