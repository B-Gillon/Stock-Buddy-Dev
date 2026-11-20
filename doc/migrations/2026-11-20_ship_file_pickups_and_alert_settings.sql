create table if not exists public.ship_file_pickups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  supplier_id uuid not null,
  file_name text not null,
  file_size bigint,
  file_mtime timestamptz,
  status text not null check (status in ('shipped','failed')),
  message text,
  po_numbers text[] not null default '{}',
  shipments_created int not null default 0,
  picked_up_at timestamptz not null default now(),
  picked_up_by text
);
create index if not exists ship_file_pickups_sig on public.ship_file_pickups (supplier_id, file_name, file_size, file_mtime);
create index if not exists ship_file_pickups_recent on public.ship_file_pickups (tenant_id, picked_up_at desc);
alter table public.ship_file_pickups enable row level security;

create table if not exists public.tenant_alert_settings (
  tenant_id uuid primary key,
  alert_emails text not null default '',
  alert_po_release_failed boolean not null default true,
  alert_ship_file_failed boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.tenant_alert_settings enable row level security;
