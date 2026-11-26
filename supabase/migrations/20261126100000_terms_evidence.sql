-- "What these terms allow" must be backed by the document.
-- doc_text: the document's text (from the PDF, Word file or written text), used to check quoted wording.
-- limits, their confirmation, the AI review and doc_text can only be written by DebtJet's server functions
-- (review-terms, terms-limits), which check the evidence first. Owners/admins still edit "rules" (what they charge),
-- which the app and server always hold within the limits.

alter table public.org_terms_documents
  add column if not exists doc_text text check (doc_text is null or char_length(doc_text) <= 400000),
  add column if not exists limits_log jsonb not null default '[]'::jsonb;

create or replace function app_private.guard_terms_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_server boolean := coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin');
begin
  if not is_server and (
       new.limits is distinct from old.limits or new.limits_log is distinct from old.limits_log
    or new.rules_confirmed_at is distinct from old.rules_confirmed_at or new.rules_confirmed_by is distinct from old.rules_confirmed_by
    or new.kind is distinct from old.kind or new.review is distinct from old.review or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by or new.review_model is distinct from old.review_model or new.doc_text is distinct from old.doc_text) then
    raise exception 'What these terms allow can only be changed through DebtJet''s document check.';
  end if;
  if not is_server and new.rules is distinct from old.rules
     and coalesce(app_private.org_role(new.org_id), '') not in ('owner', 'admin') then
    raise exception 'Only owners and admins can change the charging rules for terms.';
  end if;
  -- New wording: the review, the text and the confirmation no longer apply.
  if new.body_text is distinct from old.body_text or new.storage_path is distinct from old.storage_path then
    new.review := null; new.reviewed_at := null; new.doc_text := null;
    new.rules_confirmed_at := null; new.rules_confirmed_by := null;
  end if;
  return new;
end $$;
