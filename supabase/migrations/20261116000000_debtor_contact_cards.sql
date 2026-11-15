-- Debtor contact cards: postal address, extra contacts, and the official ABN register
-- details (legal name, ACN, entity type, ABN/GST status) with a name-match result.

alter table public.debtors
  add column if not exists legal_name text check (legal_name is null or char_length(legal_name) <= 200),
  add column if not exists acn text check (acn is null or acn ~ '^\d{9}$'),
  add column if not exists entity_type text check (entity_type is null or char_length(entity_type) <= 120),
  add column if not exists abn_status text check (abn_status is null or char_length(abn_status) <= 40),
  add column if not exists abn_status_from date,
  add column if not exists gst_from date,
  add column if not exists abr_state text check (abr_state is null or char_length(abr_state) <= 10),
  add column if not exists abr_postcode text check (abr_postcode is null or char_length(abr_postcode) <= 10),
  add column if not exists business_names text[] not null default '{}',
  add column if not exists abr_checked_at timestamptz,
  add column if not exists name_check text check (name_check is null or name_check in ('match','similar','different','not_found','invalid_abn','cancelled')),
  add column if not exists address_line1 text check (address_line1 is null or char_length(address_line1) <= 200),
  add column if not exists address_line2 text check (address_line2 is null or char_length(address_line2) <= 200),
  add column if not exists suburb text check (suburb is null or char_length(suburb) <= 100),
  add column if not exists state text check (state is null or char_length(state) <= 20),
  add column if not exists postcode text check (postcode is null or char_length(postcode) <= 10),
  add column if not exists country text check (country is null or char_length(country) <= 60),
  add column if not exists website text check (website is null or char_length(website) <= 200),
  add column if not exists notes text check (notes is null or char_length(notes) <= 2000);

create table if not exists public.debtor_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  debtor_id uuid not null references public.debtors(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role text check (role is null or char_length(role) <= 80),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  is_primary boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists debtor_contacts_debtor_idx on public.debtor_contacts(debtor_id);
alter table public.debtor_contacts enable row level security;
create policy "members read debtor contacts"   on public.debtor_contacts for select using (app_private.is_org_member(org_id));
create policy "members add debtor contacts"    on public.debtor_contacts for insert with check (app_private.is_org_member(org_id));
create policy "members edit debtor contacts"   on public.debtor_contacts for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "members delete debtor contacts" on public.debtor_contacts for delete using (app_private.is_org_member(org_id));

create or replace function app_private.debtor_contact_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.debtors where id = new.debtor_id and org_id = new.org_id) then
    raise exception 'Debtor does not belong to this organisation';
  end if;
  return new;
end $$;
drop trigger if exists debtor_contacts_guard on public.debtor_contacts;
create trigger debtor_contacts_guard before insert or update on public.debtor_contacts
  for each row execute function app_private.debtor_contact_guard();
