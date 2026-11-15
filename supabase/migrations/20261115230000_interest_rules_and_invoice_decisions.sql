-- Interest & Fees portal: when interest starts, auto vs manual application,
-- and a per-invoice decision (apply / waive) with who decided and why.

alter table public.org_charge_settings
  add column if not exists apply_mode text not null default 'auto'
    check (apply_mode in ('auto','manual')),
  add column if not exists interest_start text not null default 'after_grace'
    check (interest_start in ('due_date','after_grace','grace_backdated','first_demand','final_demand'));

create table if not exists public.invoice_charge_decisions (
  invoice_id uuid primary key references public.invoices(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  decision text not null check (decision in ('apply','waive')),
  reason text check (reason is null or char_length(reason) <= 300),
  decided_by uuid references auth.users(id),
  decided_at timestamptz not null default now()
);
create index if not exists invoice_charge_decisions_org_idx on public.invoice_charge_decisions(org_id);
alter table public.invoice_charge_decisions enable row level security;
create policy "members read charge decisions"   on public.invoice_charge_decisions for select using (app_private.is_org_member(org_id));
create policy "members add charge decisions"    on public.invoice_charge_decisions for insert with check (app_private.is_org_member(org_id));
create policy "members change charge decisions" on public.invoice_charge_decisions for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "members clear charge decisions"  on public.invoice_charge_decisions for delete using (app_private.is_org_member(org_id));

-- The invoice must belong to the same organisation, and the decider is always the caller.
create or replace function app_private.charge_decision_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.invoices where id = new.invoice_id and org_id = new.org_id) then
    raise exception 'Invoice does not belong to this organisation';
  end if;
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end $$;
drop trigger if exists invoice_charge_decisions_guard on public.invoice_charge_decisions;
create trigger invoice_charge_decisions_guard before insert or update on public.invoice_charge_decisions
  for each row execute function app_private.charge_decision_guard();
