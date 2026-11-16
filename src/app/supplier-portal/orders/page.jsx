// New POs: purchase orders sent to this supplier
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier, fmtDate } from '@/lib/supplierPortal';
import PortalFrame from '../components/PortalFrame';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New POs – Stock Buddy', robots: { index: false, follow: false } };

const LABEL = { pending_acknowledgement: 'Needs acknowledgement', waiting_to_ship: 'Waiting to ship', partially_received: 'Partially received', received: 'Received', cancelled: 'Cancelled' };

export default async function OrdersPage() {
  const s = await requireSupplier();
  const { data } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, po_date, expected_date, expected_ship_date, location:locations ( name )')
    .eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId)
    .neq('status', 'draft')
    .order('po_date', { ascending: false }).limit(300);
  const rows = data ?? [];
  const needs = rows.filter((r) => r.status === 'pending_acknowledgement');
  const rest = rows.filter((r) => r.status !== 'pending_acknowledgement');

  const Table = ({ items }) => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400">
        <th className="py-1 font-medium">PO Number</th><th className="py-1 font-medium">Ship To</th>
        <th className="py-1 font-medium">PO Create Date</th><th className="py-1 font-medium">Requested Ship Date</th>
        <th className="py-1 font-medium">Expected Ship Date</th><th className="py-1 font-medium">Status</th>
      </tr></thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id} className="border-b border-gray-50 last:border-0">
            <td className="py-1.5"><Link className="text-blue-700 hover:underline" href={`/supplier-portal/orders/${p.id}`}>{p.po_number}</Link></td>
            <td className="py-1.5 text-gray-700">{(Array.isArray(p.location) ? p.location[0] : p.location)?.name ?? '—'}</td>
            <td className="py-1.5 text-gray-700">{fmtDate(p.po_date)}</td>
            <td className="py-1.5 text-gray-700">{fmtDate(p.expected_date)}</td>
            <td className="py-1.5 text-gray-700">{fmtDate(p.expected_ship_date)}</td>
            <td className="py-1.5 text-gray-700">{LABEL[p.status] ?? p.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <PortalFrame active="orders" supplierName={s.supplierName} email={s.email}>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Needs acknowledgement ({needs.length})</h2>
        {needs.length === 0 ? <p className="text-sm text-gray-400">Nothing waiting for you.</p> : <Table items={needs} />}
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">All other purchase orders</h2>
        {rest.length === 0 ? <p className="text-sm text-gray-400">No other purchase orders.</p> : <Table items={rest} />}
      </section>
    </PortalFrame>
  );
}
