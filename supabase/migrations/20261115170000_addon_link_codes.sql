-- One-time codes that connect the Gmail/Outlook add-on to a DebtJet login.
-- Only a SHA-256 hash of the code is stored. Service role only.
create table public.addon_link_codes (
  code_hash   text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  used_at     timestamptz
);
alter table public.addon_link_codes enable row level security;
revoke all on public.addon_link_codes from anon, authenticated;
