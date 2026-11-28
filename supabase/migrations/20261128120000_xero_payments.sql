-- Payments synced from Xero (backlog P4).
-- xero-sync now records each Xero payment, credit note and prepayment/overpayment allocation
-- against the invoice, so part-paid invoices show the balance Xero shows.
-- Rows from Xero are keyed by their Xero id and can only be written by the server (the sync);
-- people change them in Xero. Manual payments are unaffected.

alter table public.payments
  add column if not exists external_id text check (external_id is null or char_length(external_id) <= 200);

-- One row per Xero item. NULL external_ids (manual payments) never clash.
create unique index if not exists payments_org_source_external_uidx
  on public.payments (org_id, source, external_id);

create or replace function app_private.guard_synced_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if app_private.is_server() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.source = 'xero' then raise exception 'Payments from Xero can only be changed in Xero.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.source = 'xero' then
    raise exception 'Payments from Xero can only be changed in Xero.';
  end if;
  if new.source = 'xero' or new.external_id is not null then
    raise exception 'Payments from Xero are added by Xero sync only.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_synced_payments on public.payments;
create trigger guard_synced_payments
  before insert or update or delete on public.payments
  for each row execute function app_private.guard_synced_payments();
