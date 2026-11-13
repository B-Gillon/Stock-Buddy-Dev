-- Supplier file naming + SFTP transmission settings, and per-file SFTP tracking.
-- Applied to the Stock-Buddy-Dev Supabase project only.

create table if not exists public.supplier_transmission_settings (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid references public.tenants(id),
  supplier_id           uuid not null unique references public.suppliers(id) on delete cascade,
  file_name_pattern     text not null default '{po_number}',
  sftp_enabled          boolean not null default false,
  sftp_host             text,
  sftp_port             integer not null default 22,
  sftp_username         text,
  sftp_password_enc     text,   -- AES-256-GCM encrypted; never returned to the browser
  sftp_private_key_enc  text,   -- AES-256-GCM encrypted; never returned to the browser
  sftp_host_fingerprint text,   -- SHA-256 host key, pinned on first successful connect
  sftp_send_pdf         boolean not null default true,
  sftp_send_csv         boolean not null default true,
  sftp_pdf_path         text,
  sftp_csv_path         text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
alter table public.supplier_transmission_settings enable row level security;

create table if not exists public.po_sftp_transmissions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id),
  po_id           uuid not null references public.purchase_orders(id) on delete cascade,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  file_type       text not null check (file_type in ('pdf','csv')),
  file_name       text not null,
  remote_dir      text not null,
  size_bytes      integer,
  status          text not null default 'uploaded' check (status in ('uploaded','retrieved','deleted','failed')),
  uploaded_at     timestamptz,
  retrieved_at    timestamptz,
  deleted_at      timestamptz,
  last_checked_at timestamptz,
  error           text,
  created_at      timestamptz default now()
);
alter table public.po_sftp_transmissions enable row level security;
create index if not exists po_sftp_transmissions_po_idx on public.po_sftp_transmissions (po_id);
create index if not exists po_sftp_transmissions_open_idx on public.po_sftp_transmissions (status) where status in ('uploaded','retrieved');

alter table public.po_activity_log drop constraint if exists po_activity_log_action_check;
alter table public.po_activity_log
  add constraint po_activity_log_action_check
  check (action = any (array['created','edited','released','resent','received','acknowledged','cancelled','closed','error',
                             'sftp_uploaded','sftp_retrieved','sftp_deleted','sftp_failed']::text[]));
