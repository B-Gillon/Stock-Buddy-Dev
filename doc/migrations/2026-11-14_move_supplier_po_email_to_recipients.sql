-- The "PO Email" field was removed from the supplier record; all PO delivery settings now live on
-- the supplier's Transmission tab. Keep any existing address by turning it into an email recipient
-- (only for suppliers that have no recipients yet). suppliers.po_email is left in place, unused.
insert into public.supplier_transmission_recipients
  (tenant_id, supplier_id, label, to_emails, send_pdf, send_csv, sort_order)
select s.tenant_id, s.id, 'PO Email', trim(s.po_email), true, true, 0
from public.suppliers s
where nullif(trim(s.po_email), '') is not null
  and not exists (
    select 1 from public.supplier_transmission_recipients r where r.supplier_id = s.id
  );
