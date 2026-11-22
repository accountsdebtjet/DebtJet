-- Contact groups: contacts that belong to the same business (or that a user wants to handle together).
-- Statements only merge contacts from the same group. Groups can come from Xero contact groups (xero_group_id).
create table if not exists public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  xero_group_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, xero_group_id)
);
create table if not exists public.contact_group_members (
  group_id uuid not null references public.contact_groups(id) on delete cascade,
  debtor_id uuid not null references public.debtors(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, debtor_id)
);
create index if not exists contact_group_members_debtor on public.contact_group_members (debtor_id);
alter table public.contact_groups enable row level security;
alter table public.contact_group_members enable row level security;
drop policy if exists "members manage groups" on public.contact_groups;
create policy "members manage groups" on public.contact_groups for all to authenticated using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
drop policy if exists "members manage group members" on public.contact_group_members;
create policy "members manage group members" on public.contact_group_members for all to authenticated using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
