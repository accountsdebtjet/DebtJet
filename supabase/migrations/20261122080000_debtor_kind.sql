-- What kind of debtor this is: a business entity (with an ABN) or a person who owes money
-- in their own name (no ABN). Drives which details DebtJet asks for and checks.
alter table public.debtors
  add column if not exists debtor_kind text;

alter table public.debtors
  drop constraint if exists debtors_debtor_kind_check,
  add constraint debtors_debtor_kind_check check (
    debtor_kind is null or debtor_kind in ('company', 'sole_trader', 'partnership', 'trust', 'association', 'government', 'individual')
  );

comment on column public.debtors.debtor_kind is
  'company | sole_trader | partnership | trust | association | government | individual (owes money in their own name, no ABN). Null = not set yet.';
