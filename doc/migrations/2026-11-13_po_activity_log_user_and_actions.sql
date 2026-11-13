-- po_activity_log: add user attribution, allow 'received' and 'acknowledged'.
-- Applied to the Stock-Buddy-Dev Supabase project only.
alter table public.po_activity_log
  add column if not exists user_name text,
  add column if not exists user_id text;

alter table public.po_activity_log drop constraint if exists po_activity_log_action_check;
alter table public.po_activity_log
  add constraint po_activity_log_action_check
  check (action = any (array['created','edited','released','resent','received','acknowledged','cancelled','closed','error']::text[]));

create index if not exists po_activity_log_po_id_created_at_idx
  on public.po_activity_log (po_id, created_at desc);
