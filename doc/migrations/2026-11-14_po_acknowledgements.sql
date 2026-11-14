-- PO acknowledgement: supplier-level settings, one acknowledgement request per PO, and a
-- "reminder_sent" History action.

-- Settings (email transmission level, per supplier)
alter table public.supplier_transmission_settings
  add column if not exists ack_required     boolean not null default false,
  add column if not exists ack_reminder_days integer check (ack_reminder_days between 1 and 30),  -- null = no reminder
  add column if not exists ack_reminder_cc   text;                                                  -- null = retailer not copied

-- One row per acknowledgement request. The emailed link is a signed id (nothing secret is stored).
create table if not exists public.po_acknowledgements (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  po_id             uuid not null references public.purchase_orders(id) on delete cascade,
  supplier_id       uuid not null,
  status            text not null default 'pending' check (status in ('pending','acknowledged','cancelled')),
  requested_at      timestamptz not null default now(),
  recipient_emails  text,                 -- who received the link (the To addresses)
  reminder_due_at   timestamptz,          -- business-day deadline; null = no reminder
  reminder_cc       text,                 -- copy the retailer on the reminder (null = no)
  reminder_sent_at  timestamptz,
  acknowledged_at   timestamptz,
  acknowledged_by   text,
  expected_ship_date date,
  ack_ip            text,
  ack_user_agent    text,
  created_at        timestamptz not null default now()
);
create unique index if not exists po_acknowledgements_one_pending_per_po
  on public.po_acknowledgements (po_id) where status = 'pending';
create index if not exists po_acknowledgements_reminders_due
  on public.po_acknowledgements (reminder_due_at) where status = 'pending' and reminder_sent_at is null;
create index if not exists po_acknowledgements_tenant_status
  on public.po_acknowledgements (tenant_id, status);
alter table public.po_acknowledgements enable row level security;   -- no policies: service role only

-- History
alter table public.po_activity_log drop constraint if exists po_activity_log_action_check;
alter table public.po_activity_log
  add constraint po_activity_log_action_check
  check (action = any (array['created','edited','released','resent','received','acknowledged','cancelled','closed','error',
                             'sftp_uploaded','sftp_retrieved','sftp_deleted','sftp_failed','reminder_sent']::text[]));
