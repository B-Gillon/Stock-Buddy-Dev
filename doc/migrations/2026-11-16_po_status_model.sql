-- PO status model: "released" is replaced by pending_acknowledgement / waiting_to_ship.
-- Existing released POs become waiting_to_ship (no acknowledgement was requested for them).
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.purchase_orders'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.purchase_orders drop constraint %I', c.conname);
  end loop;
end $$;

update public.purchase_orders set status = 'waiting_to_ship' where status = 'released';

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in ('draft','pending_acknowledgement','waiting_to_ship','partially_received','received','cancelled'));
