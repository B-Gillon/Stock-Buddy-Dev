// Shipping: purchase orders that still have something left to ship
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier, fmtDate } from '@/lib/supplierPortal';
import { shippedByLine } from '@/lib/shipments';
import ClickRow from '../components/ClickRow';
import PortalFrame from '../components/PortalFrame';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shipping – Stock Buddy', robots: { index: false, follow: false } };

const LABEL = { waiting_to_ship: 'Waiting to ship', partially_shipped: 'Partially shipped', partially_received: 'Partially received' };

export default async function ShippingPage() {
  const s = await requireSupplier();
  const { data } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, po_date, expected_date, expected_ship_date, location:locations!ship_to_location_id ( name ), lines:purchase_order_lines ( id, order_qty_units )')
    .eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId)
    .in('status', ['waiting_to_ship', 'partially_shipped', 'partially_received'])
    .order('po_date', { ascending: false }).limit(300);

  const allLineIds = (data ?? []).flatMap((p) => (p.lines ?? []).map((l) => l.id));
  const shipped = await shippedByLine(allLineIds);
  const rows = (data ?? [])
    .map((p) => {
      const ordered = (p.lines ?? []).reduce((t, l) => t + (l.order_qty_units ?? 0), 0);
      const done = (p.lines ?? []).reduce((t, l) => t + Math.min(l.order_qty_units ?? 0, shipped[l.id] ?? 0), 0);
      return { ...p, unshipped: ordered - done };
    })
    .filter((p) => p.unshipped > 0);

  const today = new Date().toISOString().slice(0, 10);
  return (
    <PortalFrame supplierName={s.supplierName} email={s.email}>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Waiting to ship ({rows.length})</h2>
        {rows.length === 0 ? <p className="text-sm text-gray-400">Nothing left to ship.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="py-1 font-medium">PO Number</th><th className="py-1 font-medium">Ship To</th>
              <th className="py-1 font-medium">PO Create Date</th><th className="py-1 font-medium">Requested Ship Date</th>
              <th className="py-1 font-medium">Expected Ship Date</th><th className="py-1 font-medium">Unshipped Units</th><th className="py-1 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((p) => {
                const due = p.expected_ship_date || p.expected_date;
                return (
                  <ClickRow key={p.id} href={`/supplier-portal/orders/${p.id}?from=shipping`} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 text-blue-700">{p.po_number}</td>
                    <td className="py-1.5 text-gray-700">{(Array.isArray(p.location) ? p.location[0] : p.location)?.name ?? '—'}</td>
                    <td className="py-1.5 text-gray-700">{fmtDate(p.po_date)}</td>
                    <td className="py-1.5 text-gray-700">{fmtDate(p.expected_date)}</td>
                    <td className={`py-1.5 ${due && due < today ? 'font-medium text-red-600' : 'text-gray-700'}`}>{fmtDate(p.expected_ship_date)}</td>
                    <td className="py-1.5 text-gray-700">{p.unshipped.toLocaleString()}</td>
                    <td className="py-1.5 text-gray-700">{LABEL[p.status] ?? p.status}</td>
                  </ClickRow>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </PortalFrame>
  );
}
