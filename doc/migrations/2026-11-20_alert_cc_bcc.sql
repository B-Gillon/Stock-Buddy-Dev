alter table public.alert_templates add column if not exists cc_emails text not null default '', add column if not exists bcc_emails text not null default '';
alter table public.supplier_alert_settings add column if not exists cc_emails text not null default '', add column if not exists bcc_emails text not null default '';
