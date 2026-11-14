-- Email notes pushed in from Gmail by the DebtJet Chrome extension (summary + key facts only).
create table public.case_notes (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  debtor_id          uuid references public.debtors(id) on delete cascade,
  case_id            uuid references public.cases(id) on delete cascade,
  invoice_id         uuid references public.invoices(id) on delete set null,
  category           text not null default 'other'
                     check (category in ('promise_to_pay','dispute','payment_plan_request','payment_made',
                                         'reminder_ack','hardship','contact_change','other')),
  summary            text not null check (length(summary) <= 2000),
  promised_date      date,
  promised_amount    numeric(14,2),
  dispute_reason     text check (length(dispute_reason) <= 1000),
  suggested_action   text check (length(suggested_action) <= 1000),
  email_subject      text check (length(email_subject) <= 500),
  email_from         text check (length(email_from) <= 320),
  email_message_id   text check (length(email_message_id) <= 500),
  email_excerpt      text check (length(email_excerpt) <= 1000),
  source             text not null default 'manual' check (source in ('manual','chrome_extension','gmail','outlook')),
  ai_model           text,
  occurred_at        timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  check (debtor_id is not null or case_id is not null)
);
create index case_notes_case_idx    on public.case_notes (case_id, occurred_at desc);
create index case_notes_invoice_idx on public.case_notes (invoice_id, occurred_at desc);
create index case_notes_debtor_idx  on public.case_notes (debtor_id, occurred_at desc);
create unique index case_notes_email_once
  on public.case_notes (org_id, email_message_id, coalesce(invoice_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where email_message_id is not null;

create or replace function app_private.case_notes_same_org()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.debtor_id is not null and not exists (select 1 from public.debtors where id = new.debtor_id and org_id = new.org_id) then
    raise exception 'Debtor does not belong to this organisation';
  end if;
  if new.case_id is not null and not exists (select 1 from public.cases where id = new.case_id and org_id = new.org_id) then
    raise exception 'Case does not belong to this organisation';
  end if;
  if new.invoice_id is not null and not exists (select 1 from public.invoices where id = new.invoice_id and org_id = new.org_id) then
    raise exception 'Invoice does not belong to this organisation';
  end if;
  return new;
end;
$function$;
revoke execute on function app_private.case_notes_same_org() from public, anon, authenticated;
create trigger case_notes_same_org before insert or update on public.case_notes
  for each row execute function app_private.case_notes_same_org();

alter table public.case_notes enable row level security;
create policy "org members can view case notes"   on public.case_notes for select using (app_private.is_org_member(org_id));
create policy "org members can insert case notes" on public.case_notes for insert with check (app_private.is_org_member(org_id));
create policy "org members can update case notes" on public.case_notes for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "org members can delete case notes" on public.case_notes for delete using (app_private.is_org_member(org_id));
grant select, insert, update, delete on public.case_notes to authenticated;
