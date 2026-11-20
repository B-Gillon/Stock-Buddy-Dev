// Supplier dashboard: the same idea as the retailer dashboard, limited to this supplier
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier, fmtDate } from '@/lib/supplierPortal';
import { NOT_FULLY_SHIPPED_STATUSES } from '@/lib/poStatus';
import { businessHoursBetween } from '@/lib/businessDays';
import PortalFrame from './components/PortalFrame';
import ClickRow from './components/ClickRow';
import { POReportCard } from '@/app/dashboard/components/ClientDashboard';
import { buildPOReport } from '@/lib/poReport';
import { shippedByLine } from '@/lib/shipments';

const STATUS_LABEL = { pending_acknowledgement: 'Needs acknowledgement', waiting_to_ship: 'Waiting to ship', partially_shipped: 'Partially shipped' };
// Lookup results can be in any status, including completed ones
const ALL_STATUS_LABEL = { ...STATUS_LABEL, shipped: 'Shipped', partially_received: 'Partially received', received: 'Received', cancelled: 'Cancelled' };

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Supplier – Stock Buddy', robots: { index: false, follow: false } };

function Card({ title, value, href, red }) {
  const body = (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-2 py-4 text-center shadow-sm hover:border-gray-300">
      <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-gray-500">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${red ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export default async function SupplierDashboard({ searchParams }) {
  const s = await requireSupplier();
  const q = String((await searchParams)?.po ?? '').trim().slice(0, 40);
  const today = new Date().toISOString().slice(0, 10);

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, po_date, released_at, supplier_retrieved_at, expected_date, expected_ship_date, location:locations ( name )')
    .eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId)
    .in('status', NOT_FULLY_SHIPPED_STATUSES)
    .order('po_date', { ascending: false }).limit(500);

  // Open = sent with something still to ship (not fully shipped, received or cancelled)
  const allPos = pos ?? [];
  const poIds = allPos.map((p) => p.id);
  const [{ data: lineData }, { data: shipData }] = poIds.length ? await Promise.all([
    supabase.from('purchase_order_lines').select('id, purchase_order_id, order_qty_units').in('purchase_order_id', poIds),
    supabase.from('shipments').select('po_id').in('po_id', poIds),
  ]) : [{ data: [] }, { data: [] }];
  const shippedQty = await shippedByLine((lineData ?? []).map((l) => l.id));
  const unshippedByPo = new Map();
  for (const l of lineData ?? []) unshippedByPo.set(l.purchase_order_id, (unshippedByPo.get(l.purchase_order_id) ?? 0) + Math.max(0, (l.order_qty_units ?? 0) - (shippedQty[l.id] ?? 0)));
  const shippedPoIds = new Set((shipData ?? []).map((x) => x.po_id));
  const list = allPos.filter((p) => (unshippedByPo.get(p.id) ?? 0) > 0);
  const shipDate = (p) => p.expected_ship_date || p.expected_date || null;
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = new Date(monday.getTime() + 6 * 864e5).toISOString().slice(0, 10);

  const nowMs = Date.now();
  const OVER = 24; // business hours (weekends and major holidays excluded)

  // Not Printed = not yet retrieved (downloaded, emailed, or picked up by the supplier's system), same as the New POs tab
  const unretrieved = allPos.filter((p) => !p.supplier_retrieved_at && !shippedPoIds.has(p.id));
  const notPrinted = unretrieved.length;
  const notPrintedRed = unretrieved.some((p) => businessHoursBetween(p.released_at || p.po_date, nowMs) > OVER);

  const pendingIds = list.filter((p) => p.status === 'pending_acknowledgement').map((p) => p.id);
  const { data: acks } = pendingIds.length
    ? await supabase.from('po_acknowledgements').select('po_id, requested_at').in('po_id', pendingIds).eq('status', 'pending')
    : { data: [] };
  const askedAt = new Map((acks ?? []).map((a) => [a.po_id, a.requested_at]));
  const notAck = pendingIds.length;
  const notAckRed = list.some((p) => p.status === 'pending_acknowledgement'
    && businessHoursBetween(askedAt.get(p.id) || p.released_at || p.po_date, nowMs) > OVER);

  const waitingToShip = list.length;
  const thisWeek = list.filter((p) => shipDate(p) && shipDate(p) >= today && shipDate(p) >= weekStart && shipDate(p) <= weekEnd).length;
  const overdue = list.filter((p) => shipDate(p) && shipDate(p) < today).length;
  const poReport = await buildPOReport({ tenantId: s.tenantId, supplierId: s.supplierId, today }); // same report as the retailer's, for this supplier
  const notInvoiced = 0; // invoicing not built yet

  // Purchase Order Lookup: any of this supplier's sent POs (drafts excluded), whatever its status
  let found = null;
  if (q) {
    const like = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data } = await supabase.from('purchase_orders')
      .select('id, po_number, status, po_date, location:locations ( name )')
      .eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).neq('status', 'draft')
      .ilike('po_number', `%${like}%`)
      .order('po_date', { ascending: false }).limit(25);
    found = data ?? [];
  }

  return (
    <PortalFrame supplierName={s.supplierName} email={s.email}>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="grid grid-cols-4 gap-3">
          <Card title="Not Printed" value={notPrinted} href="/supplier-portal/orders" red={notPrintedRed} />
          <Card title="Not Acknowledged" value={notAck} href="/supplier-portal/orders" red={notAckRed} />
          <Card title="Waiting to Ship" value={waitingToShip} href="/supplier-portal/shipping" red={overdue > 0} />
          <Card title="Ship this Week" value={thisWeek} />
          <Card title="Overdue" value={overdue} />
          <Card title="Not Invoiced" value={notInvoiced} href="/supplier-portal/invoicing" />
      <section id="po-lookup" className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Purchase Order Lookup</h2>
        <form method="get" action="/supplier-portal#po-lookup" className="flex items-center gap-2">
          <input name="po" defaultValue={q} placeholder="Enter a PO number" autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded border border-gray-300 px-3 text-sm" />
          <button type="submit" className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">Search</button>
          {q && <Link href="/supplier-portal" className="text-sm text-blue-700 hover:underline">Clear</Link>}
        </form>
        {found && (found.length === 0 ? <p className="mt-3 text-sm text-gray-400">No purchase orders found for “{q}”.</p> : (
          <div className="mt-2 max-h-40 overflow-auto"><table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="py-1 font-medium">PO Number</th><th className="py-1 font-medium">Ship To</th>
              <th className="py-1 font-medium">PO Date</th><th className="py-1 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {found.map((p) => (
                <ClickRow key={p.id} href={`/supplier-portal/orders/${p.id}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5"><Link className="text-blue-700 hover:underline" href={`/supplier-portal/orders/${p.id}`}>{p.po_number}</Link></td>
                  <td className="py-1.5 text-gray-700">{(Array.isArray(p.location) ? p.location[0] : p.location)?.name ?? '—'}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.po_date)}</td>
                  <td className="py-1.5 text-gray-700">{ALL_STATUS_LABEL[p.status] ?? p.status}</td>
                </ClickRow>
              ))}
            </tbody>
          </table></div>
        ))}
      </section>
        </div>
        <POReportCard poReport={poReport} hide={["drafts"]} labels={{ putaway: "Received" }} />
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
                <ClickRow key={p.id} href={`/supplier-portal/orders/${p.id}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5"><Link className="text-blue-700 hover:underline" href={`/supplier-portal/orders/${p.id}`}>{p.po_number}</Link></td>
                  <td className="py-1.5 text-gray-700">{(Array.isArray(p.location) ? p.location[0] : p.location)?.name ?? '—'}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.po_date)}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.expected_date)}</td>
                  <td className="py-1.5 text-gray-700">{fmtDate(p.expected_ship_date)}</td>
                  <td className="py-1.5 text-gray-700">{STATUS_LABEL[p.status] ?? p.status}</td>
                </ClickRow>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PortalFrame>
  );
}
