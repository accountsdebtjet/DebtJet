-- Letters of demand v2: block-built templates (clauses, paragraphs, tables), design
-- overrides on top of the shared brand, and an exact snapshot of each letter as sent.

alter table public.letter_templates
  add column if not exists stage text not null default 'reminder'
    check (stage in ('reminder','second_reminder','first_demand','final_demand','pre_legal','plan','dispute','other')),
  add column if not exists description text check (description is null or char_length(description) <= 300),
  add column if not exists blocks jsonb check (blocks is null or (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 60)),
  add column if not exists settings jsonb check (settings is null or pg_column_size(settings) < 400000);

update public.letter_templates set stage = type
  where type in ('reminder','first_demand','final_demand') and stage = 'reminder' and type <> 'reminder';

drop policy if exists "org members can delete letter templates" on public.letter_templates;
create policy "org members can delete letter templates" on public.letter_templates
  for delete using (app_private.is_org_member(org_id));

alter table public.letters
  add column if not exists template_key text check (template_key is null or char_length(template_key) <= 80),
  add column if not exists snapshot jsonb check (snapshot is null or pg_column_size(snapshot) < 800000);
