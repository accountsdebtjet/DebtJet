alter table public.case_notes
  add column key_points text[] not null default '{}'
    check (cardinality(key_points) <= 12 and coalesce(length(array_to_string(key_points, '')), 0) <= 3000),
  add column email_date timestamptz;
alter table public.statements add column if not exists notes text check (length(notes) <= 4000);
