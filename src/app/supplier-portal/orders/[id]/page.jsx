// One purchase order, as the supplier sees it
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier, fmtDate, money } from '@/lib/supplierPortal';
import PortalFrame from '../../components/PortalFrame';
import AckForm from './AckForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Purchase Order – Stock Buddy', robots: { index: false, follow: false } };

const LABEL = { pending_acknowledgement: 'Needs acknowledgement', waiting_to_ship: 'Waiting to ship', partially_received: 'Partially received', received: 'Received', cancelled: 'Cancelled' };

export default async function OrderPage({ params }) {
  const s = await requireSupplier();
  const { id } = await params;
  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`id, po_number, status, po_date, expected_date, expected_ship_date, currency_code, notes_supplier,
      location:locations ( name, address1, address2, city, province, zip, country )`)
    .eq('id', id).eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).neq('status', 'draft')
    .maybeSingle();
  if (!po) notFound();

  const { data: lines } = await supabase
    .from('purchase_order_lines')
    .select('line_no, sku, title, order_qty_units, unit_cost, extended_cost')
    .eq('purchase_order_id', po.id).order('line_no', { ascending: true });
  const loc = Array.isArray(po.location) ? po.location[0] : po.location;
  const cur = po.currency_code || 'USD';
  const total = (lines ?? []).reduce((t, l) => t + Number(l.extended_cost ?? (l.unit_cost ?? 0) * (l.order_qty_units ?? 0)), 0);

  return (
    <PortalFrame active="orders" supplierName={s.supplierName} email={s.email}>
      <Link href="/supplier-portal/orders" className="text-sm text-blue-700 hover:underline">← Back to purchase orders</Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{po.po_number}</h1>
          <span className="text-sm text-gray-600">{LABEL[po.status] ?? po.status}</span>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-gray-500">PO Create Date</dt><dd>{fmtDate(po.po_date)}</dd></div>
          <div><dt className="text-xs text-gray-500">Requested Ship Date</dt><dd>{fmtDate(po.expected_date)}</dd></div>
          <div><dt className="text-xs text-gray-500">Expected Ship Date</dt><dd>{fmtDate(po.expected_ship_date)}</dd></div>
          <div><dt className="text-xs text-gray-500">Ship To</dt>
            <dd>{loc ? [loc.name, loc.address1, loc.address2, [loc.city, loc.province, loc.zip].filter(Boolean).join(', '), loc.country].filter(Boolean).map((t, i) => <span key={i} className="block">{t}</span>) : '—'}</dd></div>
        </dl>
        {po.notes_supplier ? <p className="mt-3 text-sm text-gray-700"><span className="text-xs text-gray-500">Notes: </span>{po.notes_supplier}</p> : null}
      </section>
      {po.status === 'pending_acknowledgement' ? <AckForm poId={po.id} requestedShipDate={po.expected_ship_date || po.expected_date || ''} /> : null}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <table className="w-full table-fixed text-sm">
          <colgroup><col style={{ width: '14%' }} /><col /><col style={{ width: '9%' }} /><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /></colgroup>
          <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400">
            <th className="py-1 font-medium">SKU</th><th className="py-1 font-medium">Description</th>
            <th className="py-1 font-medium">Qty</th><th className="py-1 font-medium">Unit Cost</th><th className="py-1 font-medium">Extended Cost</th>
          </tr></thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.line_no} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5">{l.sku}</td><td className="py-1.5">{l.title}</td><td className="py-1.5">{l.order_qty_units}</td>
                <td className="py-1.5">{money(l.unit_cost, cur)}</td><td className="py-1.5">{money(l.extended_cost, cur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4} className="pt-2 text-right text-xs text-gray-500">Total</td><td className="pt-2 font-semibold">{money(total, cur)}</td></tr></tfoot>
        </table>
      </section>
    </PortalFrame>
  );
}
