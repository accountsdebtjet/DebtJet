-- Correspondence logged by hand (calls, letters received, SMS, meetings...), shown with
-- email notes, letters, statements and case events in the History panel.
create table if not exists public.correspondence_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  debtor_id uuid not null references public.debtors(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  direction text not null check (direction in ('in','out','internal')),
  channel text not null check (channel in ('email','phone','sms','letter','meeting','portal','other')),
  occurred_at timestamptz not null default now(),
  subject text check (subject is null or char_length(subject) <= 200),
  summary text not null check (char_length(summary) between 1 and 2000),
  counts_as_contact boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists correspondence_log_debtor_idx on public.correspondence_log(debtor_id, occurred_at desc);
alter table public.correspondence_log enable row level security;
create policy "members read correspondence"   on public.correspondence_log for select using (app_private.is_org_member(org_id));
create policy "members add correspondence"    on public.correspondence_log for insert with check (app_private.is_org_member(org_id));
create policy "members edit correspondence"   on public.correspondence_log for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "members delete correspondence" on public.correspondence_log for delete using (app_private.is_org_member(org_id));

create or replace function app_private.correspondence_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.debtors where id = new.debtor_id and org_id = new.org_id) then
    raise exception 'Debtor does not belong to this organisation';
  end if;
  if new.case_id is not null and not exists (select 1 from public.cases where id = new.case_id and org_id = new.org_id) then
    raise exception 'Case does not belong to this organisation';
  end if;
  if new.invoice_id is not null and not exists (select 1 from public.invoices where id = new.invoice_id and org_id = new.org_id) then
    raise exception 'Invoice does not belong to this organisation';
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists correspondence_log_guard on public.correspondence_log;
create trigger correspondence_log_guard before insert or update on public.correspondence_log
  for each row execute function app_private.correspondence_guard();
