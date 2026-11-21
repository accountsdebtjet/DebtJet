-- Posting interest to Xero as draft invoices: one interest invoice per overdue invoice.
-- Settings: which Xero account and tax rate to use (owners/admins change them).
create table if not exists public.charge_posting_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  account_code text check (account_code is null or length(account_code) <= 20),
  account_name text check (account_name is null or length(account_name) <= 150),
  tax_type text check (tax_type is null or length(tax_type) <= 50),
  tax_name text check (tax_name is null or length(tax_name) <= 150),
  line_amount_types text not null default 'Exclusive' check (line_amount_types in ('Exclusive', 'Inclusive', 'NoTax')),
  due_days integer not null default 7 check (due_days between 0 and 120),
  min_amount numeric(12,2) not null default 1 check (min_amount between 0 and 10000),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.charge_posting_settings enable row level security;

drop policy if exists "members read charge posting settings" on public.charge_posting_settings;
create policy "members read charge posting settings" on public.charge_posting_settings
  for select to authenticated using (app_private.is_org_member(org_id));

drop policy if exists "owners and admins insert charge posting settings" on public.charge_posting_settings;
create policy "owners and admins insert charge posting settings" on public.charge_posting_settings
  for insert to authenticated
  with check (exists (select 1 from public.org_members m where m.org_id = charge_posting_settings.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));

drop policy if exists "owners and admins update charge posting settings" on public.charge_posting_settings;
create policy "owners and admins update charge posting settings" on public.charge_posting_settings
  for update to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = charge_posting_settings.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')))
  with check (exists (select 1 from public.org_members m where m.org_id = charge_posting_settings.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));

-- One row per interest invoice created in Xero. Written only by the xero-charges
-- function (service role) after Xero confirms the draft; members can read.
create table if not exists public.charge_postings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null default 'xero' check (provider in ('xero')),
  source_external_id text not null check (length(source_external_id) <= 100),
  xero_invoice_id text check (xero_invoice_id is null or length(xero_invoice_id) <= 100),
  xero_invoice_number text check (xero_invoice_number is null or length(xero_invoice_number) <= 100),
  period_from date not null,
  period_to date not null,
  interest numeric(12,2) not null check (interest > 0 and interest <= 1000000),
  account_code text,
  tax_type text,
  line_amount_types text,
  status text not null default 'draft' check (status in ('draft', 'authorised', 'paid', 'voided', 'deleted')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint charge_postings_period_check check (period_to >= period_from)
);
create index if not exists charge_postings_org_invoice_idx on public.charge_postings (org_id, invoice_id);
create unique index if not exists charge_postings_xero_uidx on public.charge_postings (org_id, xero_invoice_id) where xero_invoice_id is not null;
-- No two live postings for the same invoice can end on the same day.
create unique index if not exists charge_postings_live_period_uidx on public.charge_postings (invoice_id, period_to) where status not in ('voided', 'deleted');

alter table public.charge_postings enable row level security;
drop policy if exists "members read charge postings" on public.charge_postings;
create policy "members read charge postings" on public.charge_postings
  for select to authenticated using (app_private.is_org_member(org_id));
