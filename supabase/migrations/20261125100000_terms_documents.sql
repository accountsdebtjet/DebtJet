-- Terms of trade / service: uploaded or written documents, the DebtJet AI review of each,
-- and a link from the Interest & Fees rules back to the document (and clauses) they came from.

create table if not exists public.org_terms_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'terms_of_trade'
    check (kind in ('terms_of_trade', 'terms_of_service', 'credit_application', 'other')),
  source text not null check (source in ('upload', 'text')),
  file_name text,
  storage_path text,
  mime text,
  size_bytes integer check (size_bytes is null or size_bytes <= 10485760),
  body_text text check (body_text is null or char_length(body_text) <= 200000),
  effective_date date,
  is_current boolean not null default true,
  review jsonb,
  review_model text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  applied_at timestamptz,
  applied_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((source = 'upload' and storage_path is not null) or (source = 'text' and body_text is not null))
);
create index if not exists org_terms_documents_org_idx on public.org_terms_documents (org_id, created_at desc);

alter table public.org_terms_documents enable row level security;
create policy "members read terms documents" on public.org_terms_documents
  for select using (app_private.is_org_member(org_id));
create policy "members add terms documents" on public.org_terms_documents
  for insert with check (app_private.is_org_member(org_id));
create policy "members update terms documents" on public.org_terms_documents
  for update using (app_private.is_org_member(org_id)) with check (app_private.is_org_member(org_id));
create policy "admins delete terms documents" on public.org_terms_documents
  for delete using (app_private.org_role(org_id) = any (array['owner', 'admin']));

-- Which document (and which clause for each setting) the rules were taken from.
alter table public.org_charge_settings
  add column if not exists terms_document_id uuid references public.org_terms_documents(id) on delete set null,
  add column if not exists terms_sources jsonb not null default '{}'::jsonb;

-- Private bucket for the original files: <org_id>/<uuid>-<file name>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('terms-docs', 'terms-docs', false, 10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'])
on conflict (id) do nothing;

create policy "members read terms files" on storage.objects
  for select using (bucket_id = 'terms-docs' and app_private.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "members upload terms files" on storage.objects
  for insert with check (bucket_id = 'terms-docs' and app_private.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "admins delete terms files" on storage.objects
  for delete using (bucket_id = 'terms-docs' and app_private.org_role(((storage.foldername(name))[1])::uuid) = any (array['owner', 'admin']));
