-- Account statements: Draft until sent. Records when, how and to whom a statement was sent, and who marked it.
-- Once sent, a statement's contents can't change or be deleted (the history shows exactly what the customer received).

alter table public.statements
  add column if not exists status text not null default 'draft' check (status in ('draft', 'sent')),
  add column if not exists sent_at timestamptz,
  add column if not exists sent_via text check (sent_via is null or sent_via in ('email', 'post', 'pdf', 'hand', 'portal', 'other')),
  add column if not exists sent_to text check (sent_to is null or char_length(sent_to) <= 200),
  add column if not exists sent_by uuid;
create index if not exists statements_debtors_idx on public.statements using gin (debtor_ids);

create or replace function app_private.guard_statement_sent() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'sent' then raise exception 'A sent statement is part of the account history and can''t be deleted.'; end if;
    return old;
  end if;
  if old.status = 'sent' and (new.items is distinct from old.items or new.totals is distinct from old.totals
      or new.debtor_ids is distinct from old.debtor_ids or new.total_amount is distinct from old.total_amount
      or new.recipient_name is distinct from old.recipient_name or new.notes is distinct from old.notes) then
    raise exception 'A sent statement can''t be changed. Create a new statement instead.';
  end if;
  if new.status = 'sent' and (old.status is distinct from 'sent' or new.sent_at is distinct from old.sent_at) then
    new.sent_at := coalesce(new.sent_at, now());
    new.sent_by := auth.uid();
  end if;
  if new.status = 'draft' then
    new.sent_at := null; new.sent_via := null; new.sent_to := null; new.sent_by := null;
  end if;
  return new;
end $$;
drop trigger if exists guard_statement_sent on public.statements;
create trigger guard_statement_sent before update or delete on public.statements for each row execute function app_private.guard_statement_sent();
