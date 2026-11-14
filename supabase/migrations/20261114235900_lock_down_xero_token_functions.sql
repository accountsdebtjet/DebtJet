-- Xero token functions are server-side only (edge functions use the service role).
revoke execute on function public.get_xero_refresh_token(uuid) from public, anon, authenticated;
revoke execute on function public.store_xero_connection(uuid, text, text, text) from public, anon, authenticated;
grant  execute on function public.get_xero_refresh_token(uuid) to service_role;
grant  execute on function public.store_xero_connection(uuid, text, text, text) to service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
