-- Debtor portal may only log known actions; title is fixed server-side,
-- debtor note is plain text capped at 500 chars.
create or replace function public.log_debtor_portal_action(p_token uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tok record;
  v_title text;
begin
  v_title := case p_action
    when 'portal_pay_clicked'  then 'Debtor clicked Pay in full'
    when 'portal_plan_clicked' then 'Debtor clicked Propose a payment plan'
    else null
  end;
  if v_title is null then
    return;
  end if;

  select * into v_tok from public.debtor_portal_tokens
    where token = p_token and revoked_at is null and expires_at > now()
    limit 1;
  if not found then
    return;
  end if;

  insert into public.case_events (org_id, case_id, event_type, title, body)
    select c.org_id, c.id, p_action, v_title,
           nullif(left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]', ' ', 'g'), 500), '')
    from public.cases c where c.id = v_tok.case_id;
end;
$function$;
