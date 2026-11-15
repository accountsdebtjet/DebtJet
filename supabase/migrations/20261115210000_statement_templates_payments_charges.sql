-- Statement templates, the business's payment details, and interest & fee settings.

-- ---------- Statement templates ----------
create table if not exists public.statement_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  settings jsonb not null default '{}'::jsonb check (pg_column_size(settings) < 600000),
  is_default boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists statement_templates_org_idx on public.statement_templates(org_id);
create unique index if not exists statement_templates_one_default on public.statement_templates(org_id) where is_default;
alter table public.statement_templates enable row level security;
create policy "members read statement templates"   on public.statement_templates for select using (app_private.is_org_member(org_id));
create policy "members add statement templates"    on public.statement_templates for insert with check (app_private.is_org_member(org_id));
create policy "members edit statement templates"   on public.statement_templates for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "members delete statement templates" on public.statement_templates for delete using (app_private.is_org_member(org_id));

alter table public.statements add column if not exists template_id uuid references public.statement_templates(id) on delete set null;
alter table public.statements add column if not exists template_settings jsonb;
alter table public.statements add column if not exists totals jsonb;

-- ---------- Payment details (where debtors pay the business) ----------
-- Only owners and admins can change these: a changed account number is the classic
-- payment-redirection scam, so every change is logged and staff are warned for 24 hours.
create table if not exists public.org_payment_details (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  account_name text,
  bsb text check (bsb is null or bsb ~ '^\d{3}-\d{3}$'),
  account_number text check (account_number is null or account_number ~ '^\d{5,10}$'),
  bank_name text,
  payid text,
  payid_type text check (payid_type is null or payid_type in ('email','phone','abn','org_id')),
  bpay_biller_code text check (bpay_biller_code is null or bpay_biller_code ~ '^\d{4,10}$'),
  reference_format text not null default 'invoice' check (reference_format in ('invoice','debtor','statement')),
  show_bank boolean not null default true,
  show_payid boolean not null default false,
  show_bpay boolean not null default false,
  online_provider text not null default 'none' check (online_provider in ('none','xero','quickbooks')),
  instructions text check (instructions is null or char_length(instructions) <= 600),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  bank_changed_at timestamptz
);
alter table public.org_payment_details enable row level security;
create policy "members read payment details" on public.org_payment_details for select using (app_private.is_org_member(org_id));
create policy "owners add payment details"   on public.org_payment_details for insert with check (app_private.org_role(org_id) in ('owner','admin'));
create policy "owners edit payment details"  on public.org_payment_details for update using (app_private.org_role(org_id) in ('owner','admin')) with check (app_private.org_role(org_id) in ('owner','admin'));

create table if not exists public.payment_detail_changes (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  summary text not null
);
alter table public.payment_detail_changes enable row level security;
create policy "members read payment changes" on public.payment_detail_changes for select using (app_private.is_org_member(org_id));
-- No insert/update/delete policies: rows are written only by the trigger below, and can't be edited.

create or replace function app_private.log_payment_detail_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parts text[] := '{}';
  mask text;
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT'
     or new.bsb is distinct from old.bsb
     or new.account_number is distinct from old.account_number
     or new.account_name is distinct from old.account_name
     or new.payid is distinct from old.payid
     or new.bpay_biller_code is distinct from old.bpay_biller_code then
    new.bank_changed_at := now();
  end if;
  mask := case when new.account_number is null then 'none' else '••••' || right(new.account_number, 3) end;
  if tg_op = 'INSERT' then
    parts := array['Payment details set up: BSB ' || coalesce(new.bsb,'none') || ', account ' || mask];
  else
    if new.bsb is distinct from old.bsb or new.account_number is distinct from old.account_number then
      parts := parts || ('Bank account changed to BSB ' || coalesce(new.bsb,'none') || ', account ' || mask);
    end if;
    if new.account_name is distinct from old.account_name then parts := parts || ('Account name changed to ' || coalesce(new.account_name,'none')); end if;
    if new.payid is distinct from old.payid then parts := parts || ('PayID changed to ' || coalesce(new.payid,'none')); end if;
    if new.bpay_biller_code is distinct from old.bpay_biller_code then parts := parts || ('BPAY biller code changed to ' || coalesce(new.bpay_biller_code,'none')); end if;
    if new.online_provider is distinct from old.online_provider then parts := parts || ('Online payment link set to ' || new.online_provider); end if;
  end if;
  if array_length(parts, 1) > 0 then
    insert into public.payment_detail_changes(org_id, changed_by, summary) values (new.org_id, auth.uid(), array_to_string(parts, '; '));
  end if;
  return new;
end $$;
drop trigger if exists org_payment_details_log on public.org_payment_details;
create trigger org_payment_details_log before insert or update on public.org_payment_details
  for each row execute function app_private.log_payment_detail_change();

-- ---------- Interest & fees ----------
create table if not exists public.org_charge_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  terms_allow_charges boolean not null default false,
  interest_enabled boolean not null default false,
  rate_pa numeric(6,4) not null default 0.10 check (rate_pa >= 0 and rate_pa <= 1),
  method text not null default 'simple' check (method in ('simple','compound_monthly')),
  grace_days integer not null default 0 check (grace_days between 0 and 365),
  min_balance numeric(12,2) not null default 0 check (min_balance >= 0),
  cap_pct numeric(6,4) check (cap_pct is null or (cap_pct > 0 and cap_pct <= 5)),
  fees jsonb not null default '[]'::jsonb check (jsonb_typeof(fees) = 'array' and jsonb_array_length(fees) <= 12),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.org_charge_settings enable row level security;
create policy "members read charge settings" on public.org_charge_settings for select using (app_private.is_org_member(org_id));
create policy "owners add charge settings"   on public.org_charge_settings for insert with check (app_private.org_role(org_id) in ('owner','admin'));
create policy "owners edit charge settings"  on public.org_charge_settings for update using (app_private.org_role(org_id) in ('owner','admin')) with check (app_private.org_role(org_id) in ('owner','admin'));

-- ---------- Online payment link cache (Xero online invoice / QuickBooks invoice link) ----------
alter table public.invoices add column if not exists pay_url text check (pay_url is null or pay_url ~ '^https://');
alter table public.invoices add column if not exists pay_url_checked_at timestamptz;
