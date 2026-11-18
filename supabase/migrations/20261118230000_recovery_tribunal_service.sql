-- ACAT serves applications itself (by prepaid post) unless the applicant elects to serve.
alter table public.recovery_matters drop constraint if exists recovery_matters_service_method_check;
alter table public.recovery_matters add constraint recovery_matters_service_method_check
  check (service_method is null or service_method in ('tribunal','post','email','hand','process_server','other'));
