// Supplier dashboard: the same idea as the retailer dashboard, limited to this supplier
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier, fmtDate } from '@/lib/supplierPortal';
import PortalFrame from './components/PortalFrame';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Supplier – Stock Buddy', robots: { index: false, follow: false } };

function Card({ title, value, href }) {
  const body = (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm hover:border-gray-300">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function SupplierDashboard() {
  const s = await requireSupplier();
  const today = new Date().toISOString().slice(0, 10);

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, po_date, released_at, expected_date, expected_ship_date, location:locations ( name )')
    .eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId)
    .in('status', ['pending_acknowledgement', 'waiting_to_ship', 'partially_received'])
    .order('po_date', { ascending: false }).limit(500);

  // Open = sent and not fully received or cancelled. (Shipping isn't tracked yet, so open means not shipped.)
  const list = pos ?? [];
  const shipDate = (p) => p.expected_ship_date || p.expected_date || null;
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = new Date(monday.getTime() + 6 * 864e5).toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();

  const newPOs = list.filter((p) => (p.released_at || p.po_date || '') >= weekAgo).length;
  const notAck = list.filter((p) => p.status === 'pending_acknowledgement').length;
  const notShipped = list.length;
  const thisWeek = list.filter((p) => shipDate(p) && shipDate(p) >= today && shipDate(p) >= weekStart && shipDate(p) <= weekEnd).length;
  const overdue = list.filter((p) => shipDate(p) && shipDate(p) < today).length;
  const notInvoiced = 0; // invoicing not built yet

  return (
    <PortalFrame supplierName={s.supplierName} email={s.email}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="New POs" value={newPOs} href="/supplier-portal/orders" />
        <Card title="Not Acknowledged" value={notAck} href="/supplier-portal/orders" />
        <Card title="Not Shipped" value={notShipped} href="/supplier-portal/shipping" />
        <Card title="Ship this Week" value={thisWeek} />
        <Card title="Overdue" value={overdue} />
        <Card title="Not Invoiced" value={notInvoiced} href="/supplier-portal/invoicing" />
      </div>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Open purchase orders</h2>
        {list.length === 0 ? <p className="text-sm text-gray-400">No open purchase orders.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="py-1 font-medium">PO Number</th><th className="py-1 font-medium">Ship To</th>
              <th className="py-1 font-medium">PO Date</th><th className="py-1 font-medium">Requested Ship</th><th className="py-1 font-medium">Expected Ship</th><th className="py-1 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 10).map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5"><Link className="text-blue-700 hover:underline" href={`/supplier-portal/orders/${p.id}`}>{p.po_number}</Link></td>
                  <td className="py-1.5 text-gray-700">{(Array.isArray(p.location) ? p.location[0] : p.location)?.name ?? '—'}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.po_date)}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.expected_date)}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.expected_ship_date)}</td>
                  <td className="py-1.5 text-gray-700">{p.status === 'pending_acknowledgement' ? 'Needs acknowledgement' : p.status === 'waiting_to_ship' ? 'Waiting to ship' : 'Partially received'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PortalFrame>
  );
}
