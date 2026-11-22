-- The organisation's own business type, used for court and tribunal fees (corporation vs individual rate).
alter table public.organizations add column if not exists entity_kind text;
alter table public.organizations drop constraint if exists organizations_entity_kind_check,
  add constraint organizations_entity_kind_check check (entity_kind is null or entity_kind in ('company','sole_trader','partnership','trust','association','government','individual'));
