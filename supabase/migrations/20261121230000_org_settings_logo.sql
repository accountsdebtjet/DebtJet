-- Organisation settings: business details and a logo used on statements and letters.
alter table public.organizations
  add column if not exists logo text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text;

alter table public.organizations
  drop constraint if exists organizations_logo_check,
  add constraint organizations_logo_check check (
    logo is null or (length(logo) <= 400000 and logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')
  ),
  drop constraint if exists organizations_details_len_check,
  add constraint organizations_details_len_check check (
    length(coalesce(name, '')) between 1 and 160
    and length(coalesce(abn, '')) <= 20
    and length(coalesce(billing_email, '')) <= 200
    and length(coalesce(address, '')) <= 300
    and length(coalesce(phone, '')) <= 40
    and length(coalesce(website, '')) <= 200
  );

-- Only owners and admins can change the organisation's details.
drop policy if exists "org members can update their organization" on public.organizations;
drop policy if exists "org owners and admins can update their organization" on public.organizations;
create policy "org owners and admins can update their organization" on public.organizations
  for update to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')))
  with check (exists (select 1 from public.org_members m where m.org_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));
