alter table public.error_log add column if not exists user_name text;
create index if not exists error_log_tenant_created on public.error_log (tenant_id, created_at desc);
