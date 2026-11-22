-- Paragraphs a business saves for reuse in letters ('letter') and tribunal/court claim details ('claim').
create table if not exists public.clause_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null default 'letter' check (scope in ('letter', 'claim')),
  category text not null default 'Your clauses' check (length(category) between 1 and 60),
  label text not null check (length(label) between 1 and 80),
  body text not null check (length(body) between 1 and 4000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clause_library_org_scope on public.clause_library (org_id, scope);
alter table public.clause_library enable row level security;

drop policy if exists "members read clauses" on public.clause_library;
create policy "members read clauses" on public.clause_library for select to authenticated using (app_private.is_org_member(org_id));
drop policy if exists "members add clauses" on public.clause_library;
create policy "members add clauses" on public.clause_library for insert to authenticated with check (app_private.is_org_member(org_id));
drop policy if exists "members edit clauses" on public.clause_library;
create policy "members edit clauses" on public.clause_library for update to authenticated using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
drop policy if exists "members remove clauses" on public.clause_library;
create policy "members remove clauses" on public.clause_library for delete to authenticated using (app_private.is_org_member(org_id));
