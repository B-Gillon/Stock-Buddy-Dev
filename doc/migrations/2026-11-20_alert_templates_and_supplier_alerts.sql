alter table public.po_activity_log drop constraint po_activity_log_action_check;
alter table public.po_activity_log add constraint po_activity_log_action_check check (action = any (array['created','edited','released','resent','received','acknowledged','cancelled','closed','error','sftp_uploaded','sftp_retrieved','sftp_deleted','sftp_failed','reminder_sent','retrieved','shipped','partially_shipped','putaway','ship_file_retrieved','ship_file_failed','ship_file_upload','ship_file_error']::text[]));

create table if not exists public.alert_templates (
  tenant_id uuid not null,
  alert_type text not null,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, alert_type)
);
alter table public.alert_templates enable row level security;

create table if not exists public.supplier_alert_settings (
  tenant_id uuid not null,
  supplier_id uuid not null,
  alert_type text not null,
  enabled boolean not null default false,
  emails text not null default '',
  updated_at timestamptz not null default now(),
  primary key (supplier_id, alert_type)
);
alter table public.supplier_alert_settings enable row level security;
