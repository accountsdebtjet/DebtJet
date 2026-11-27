-- Evidence that a customer accepted terms. Only "evidence" or "verified" acceptances allow interest and fees.
--   evidence: a file the user uploaded, or an email in their own Gmail/Outlook (referenced, not copied)
--   verified: pulled by DebtJet from a connected app (Xero, QuickBooks, ServiceM8, e-signature); server only
-- terms_acceptances.evidence_grade is worked out from its evidence by trigger: declared / evidence / verified.

create table if not exists public.terms_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  acceptance_id uuid not null references public.terms_acceptances(id) on delete cascade,
  source text not null check (source in ('upload', 'gmail', 'outlook', 'xero', 'quickbooks', 'servicem8', 'esign')),
  grade text not null default 'evidence' check (grade in ('evidence', 'verified')),
  description text check (description is null or char_length(description) <= 300),
  storage_path text, file_name text, mime text, size_bytes integer check (size_bytes is null or size_bytes <= 10485760), sha256 text,
  external_id text check (external_id is null or char_length(external_id) <= 500),
  external_url text check (external_url is null or char_length(external_url) <= 1000),
  case_note_id uuid references public.case_notes(id) on delete set null,
  occurred_at timestamptz,
  party text check (party is null or char_length(party) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_id is not null or external_url is not null)
);
create index if not exists terms_evidence_acc_idx on public.terms_evidence (acceptance_id);

alter table public.terms_evidence enable row level security;
create policy "members read terms evidence" on public.terms_evidence for select using (app_private.is_org_member(org_id));
create policy "admins add terms evidence" on public.terms_evidence for insert with check (app_private.org_role(org_id) = any (array['owner', 'admin']));
create policy "admins delete terms evidence" on public.terms_evidence for delete using (app_private.org_role(org_id) = any (array['owner', 'admin']));

alter table public.terms_acceptances
  add column if not exists evidence_grade text not null default 'declared' check (evidence_grade in ('declared', 'evidence', 'verified'));

create or replace function app_private.is_server() returns boolean language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin');
$$;

-- People can attach files and emails; "verified" evidence and evidence from connected apps come from DebtJet's server only.
create or replace function app_private.guard_terms_evidence() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not app_private.is_server() then
    if new.grade = 'verified' or new.source in ('xero', 'quickbooks', 'servicem8', 'esign') then
      raise exception 'Verified evidence can only come from a connected app.';
    end if;
    if not exists (select 1 from public.terms_acceptances a where a.id = new.acceptance_id and a.org_id = new.org_id) then
      raise exception 'Evidence must belong to an acceptance record in the same organisation.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_terms_evidence on public.terms_evidence;
create trigger guard_terms_evidence before insert or update on public.terms_evidence for each row execute function app_private.guard_terms_evidence();

create or replace function app_private.recompute_evidence_grade() returns trigger language plpgsql security definer set search_path = public as $$
declare acc uuid := coalesce(new.acceptance_id, old.acceptance_id);
begin
  update public.terms_acceptances a set evidence_grade = coalesce((
    select case when bool_or(e.grade = 'verified') then 'verified' else 'evidence' end from public.terms_evidence e where e.acceptance_id = acc
  ), 'declared') where a.id = acc;
  return null;
end $$;
drop trigger if exists recompute_evidence_grade on public.terms_evidence;
create trigger recompute_evidence_grade after insert or update or delete on public.terms_evidence for each row execute function app_private.recompute_evidence_grade();

-- The grade can't be set by hand: new records start as declared; changes come only from the trigger above.
create or replace function app_private.guard_acceptance_grade() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if app_private.is_server() or pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then new.evidence_grade := 'declared';
  elsif new.evidence_grade is distinct from old.evidence_grade then raise exception 'The evidence grade comes from the attached evidence.';
  end if;
  return new;
end $$;
drop trigger if exists guard_acceptance_grade on public.terms_acceptances;
create trigger guard_acceptance_grade before insert or update on public.terms_acceptances for each row execute function app_private.guard_acceptance_grade();

-- Photos or scans of signed documents are evidence too.
update storage.buckets set allowed_mime_types = array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png']
where id = 'terms-docs';
