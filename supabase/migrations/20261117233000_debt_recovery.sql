-- Debt Recovery: one "matter" per case taken to a tribunal or court (QLD QCAT minor debt first),
-- plus a register of disputed facts with evidence-linked responses the user approves.
create table if not exists public.recovery_matters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  debtor_id uuid not null references public.debtors(id) on delete cascade,
  jurisdiction text not null default 'QLD' check (jurisdiction in ('QLD','NSW','VIC','WA','SA','TAS','ACT','NT')),
  forum text not null default 'QCAT_MINOR_DEBT' check (char_length(forum) <= 40),
  status text not null default 'preparing' check (status in
    ('preparing','lodged','served','responded','no_response','hearing','decided','enforcing','paid','closed','withdrawn')),
  principal numeric(12,2) not null default 0,
  interest numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  total_claimed numeric(12,2) not null default 0,
  filing_fee numeric(10,2),
  applicant jsonb not null default '{}'::jsonb,
  respondent jsonb not null default '{}'::jsonb,
  claim_snapshot jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  file_number text check (file_number is null or char_length(file_number) <= 60),
  lodged_on date,
  served_on date,
  service_method text check (service_method is null or service_method in ('post','email','hand','process_server','other')),
  response_due date,
  hearing_at timestamptz,
  outcome text check (outcome is null or char_length(outcome) <= 2000),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recovery_matters_case_idx on public.recovery_matters(case_id);
alter table public.recovery_matters enable row level security;
create policy "members read matters"   on public.recovery_matters for select using (app_private.is_org_member(org_id));
create policy "members add matters"    on public.recovery_matters for insert with check (app_private.is_org_member(org_id));
create policy "members edit matters"   on public.recovery_matters for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "members delete matters" on public.recovery_matters for delete using (app_private.is_org_member(org_id));

create table if not exists public.recovery_disputes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid references public.recovery_matters(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  raised_via text not null default 'email' check (raised_via in ('email','phone','letter','portal','tribunal_response','other')),
  raised_on date,
  debtor_says text not null check (char_length(debtor_says) between 1 and 4000),
  our_response text check (our_response is null or char_length(our_response) <= 6000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 40),
  gaps jsonb not null default '[]'::jsonb,
  ai_drafted boolean not null default false,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recovery_disputes_case_idx on public.recovery_disputes(case_id);
alter table public.recovery_disputes enable row level security;
create policy "members read disputes"   on public.recovery_disputes for select using (app_private.is_org_member(org_id));
create policy "members add disputes"    on public.recovery_disputes for insert with check (app_private.is_org_member(org_id));
create policy "members edit disputes"   on public.recovery_disputes for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "members delete disputes" on public.recovery_disputes for delete using (app_private.is_org_member(org_id));

create or replace function app_private.recovery_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cases where id = new.case_id and org_id = new.org_id) then
    raise exception 'Case does not belong to this organisation';
  end if;
  if tg_table_name = 'recovery_matters' then
    if not exists (select 1 from public.debtors where id = new.debtor_id and org_id = new.org_id) then
      raise exception 'Debtor does not belong to this organisation';
    end if;
  else
    if new.matter_id is not null and not exists (select 1 from public.recovery_matters where id = new.matter_id and org_id = new.org_id) then
      raise exception 'Matter does not belong to this organisation';
    end if;
    if new.invoice_id is not null and not exists (select 1 from public.invoices where id = new.invoice_id and org_id = new.org_id) then
      raise exception 'Invoice does not belong to this organisation';
    end if;
    -- Approval is stamped by the server: only the signed-in user can approve, and editing the response clears it.
    if new.approved_at is not null and (tg_op = 'INSERT' or old.approved_at is null) then
      new.approved_by := auth.uid(); new.approved_at := now();
    elsif tg_op = 'UPDATE' and new.our_response is distinct from old.our_response then
      new.approved_by := null; new.approved_at := null;
    end if;
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists recovery_matters_guard on public.recovery_matters;
create trigger recovery_matters_guard before insert or update on public.recovery_matters
  for each row execute function app_private.recovery_guard();
drop trigger if exists recovery_disputes_guard on public.recovery_disputes;
create trigger recovery_disputes_guard before insert or update on public.recovery_disputes
  for each row execute function app_private.recovery_guard();
