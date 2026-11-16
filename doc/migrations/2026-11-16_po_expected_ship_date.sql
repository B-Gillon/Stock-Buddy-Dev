-- Supplier's expected ship date (entered when they acknowledge) kept on the PO itself.
alter table public.purchase_orders add column if not exists expected_ship_date date;

update public.purchase_orders p
set expected_ship_date = a.expected_ship_date
from (
  select distinct on (po_id) po_id, expected_ship_date
  from public.po_acknowledgements
  where status = 'acknowledged' and expected_ship_date is not null
  order by po_id, acknowledged_at desc
) a
where p.id = a.po_id and p.expected_ship_date is null;
