-- Charges only where the customer accepted written terms that allow them.
-- Each terms document is a "terms set" with:
--   limits: what the document allows (confirmed by a person from DebtJet AI's reading)
--   rules:  what the business actually charges (never above the limits)
-- terms_acceptances records which customers accepted which terms, when and how:
--   one row for all customers (debtor_id and group_id both null), a contact group, or a customer.

alter table public.org_terms_documents drop constraint if exists org_terms_documents_kind_check;
alter table public.org_terms_documents add constraint org_terms_documents_kind_check
  check (kind in ('terms_of_trade', 'terms_of_service', 'credit_application', 'quote_or_contract', 'other'));
alter table public.org_terms_documents
  add column if not exists limits jsonb,
  add column if not exists rules jsonb,
  add column if not exists rules_confirmed_at timestamptz,
  add column if not exists rules_confirmed_by uuid,
  add column if not exists archived boolean not null default false;

create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.org_terms_documents(id) on delete cascade,
  debtor_id uuid references public.debtors(id) on delete cascade,
  group_id uuid references public.contact_groups(id) on delete cascade,
  accepted_on date not null,
  accepted_how text not null check (accepted_how in ('signed_credit_application', 'signed_terms', 'signed_quote_or_contract', 'accepted_in_writing', 'other')),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (debtor_id is null or group_id is null)
);
create unique index if not exists terms_acceptances_debtor_uq on public.terms_acceptances (debtor_id) where debtor_id is not null;
create unique index if not exists terms_acceptances_group_uq on public.terms_acceptances (group_id) where group_id is not null;
create unique index if not exists terms_acceptances_all_uq on public.terms_acceptances (org_id) where debtor_id is null and group_id is null;

alter table public.terms_acceptances enable row level security;
create policy "members read terms acceptances" on public.terms_acceptances
  for select using (app_private.is_org_member(org_id));
create policy "admins add terms acceptances" on public.terms_acceptances
  for insert with check (app_private.org_role(org_id) = any (array['owner', 'admin']));
create policy "admins edit terms acceptances" on public.terms_acceptances
  for update using (app_private.org_role(org_id) = any (array['owner', 'admin'])) with check (app_private.org_role(org_id) = any (array['owner', 'admin']));
create policy "admins delete terms acceptances" on public.terms_acceptances
  for delete using (app_private.org_role(org_id) = any (array['owner', 'admin']));

-- Only owners and admins may change what a document allows or charges.
create or replace function app_private.guard_terms_rules() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.limits is distinct from old.limits or new.rules is distinct from old.rules or new.rules_confirmed_at is distinct from old.rules_confirmed_at)
     and coalesce(app_private.org_role(new.org_id), '') not in ('owner', 'admin') then
    raise exception 'Only owners and admins can change the charging rules for terms.';
  end if;
  -- A document whose wording changes must be confirmed again before it can be used for charges.
  if new.body_text is distinct from old.body_text or new.storage_path is distinct from old.storage_path then
    new.rules_confirmed_at := null; new.rules_confirmed_by := null;
  end if;
  return new;
end $$;
drop trigger if exists guard_terms_rules on public.org_terms_documents;
create trigger guard_terms_rules before update on public.org_terms_documents
  for each row execute function app_private.guard_terms_rules();
