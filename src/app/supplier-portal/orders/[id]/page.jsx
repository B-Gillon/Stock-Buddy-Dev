// One purchase order, as the supplier sees it: same layout as the retailer's PO screen
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier } from '@/lib/supplierPortal';
import { shippedByLine } from '@/lib/shipments';
import { loadShipmentConfig } from '@/lib/shipmentSettings';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import Badge from '@/shared/components/ui/Badge';
import Card from '@/shared/components/ui/Card';
import PageHeader from '@/shared/components/ui/PageHeader';
import CollapsibleCards from '@/app/purchase-orders/[slug]/components/CollapsibleCards';
import PortalFrame from '../../components/PortalFrame';
import AckForm from './AckForm';
import { ShipmentProvider, CreateShipmentButton, HideWhileCreating, LinesTable } from './ShipmentProvider';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Purchase Order – Stock Buddy', robots: { index: false, follow: false } };

function fmtDate(val) {
  if (!val) return '—';
  const [yyyy, mm, dd] = String(val).substring(0, 10).split('-');
  return `${mm}/${dd}/${yyyy}`;
}

export default async function OrderPage({ params }) {
  const s = await requireSupplier();
  const { id } = await params;
  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`id, po_number, status, po_date, expected_date, expected_ship_date, currency_code, notes_supplier, released_at,
      supplier:suppliers!supplier_id ( supplier_name, supplier_number, currency ),
      location:locations!ship_to_location_id ( name, address1, address2, city, province, zip, country )`)
    .eq('id', id).eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).neq('status', 'draft')
    .maybeSingle();
  if (!po) notFound();

  const { data: rows } = await supabase
    .from('purchase_order_lines')
    .select('id, line_no, sku, title, order_qty_units, received_qty_units, unit_cost, extended_cost, variant:variants!variant_id ( display_title, image_src )')
    .eq('purchase_order_id', po.id).order('line_no', { ascending: true });
  const shipConfig = await loadShipmentConfig(s.tenantId);
  const shipped = await shippedByLine((rows ?? []).map((r) => r.id));
  const lines = (rows ?? []).map((l) => {
    const v = Array.isArray(l.variant) ? l.variant[0] : l.variant;
    return {
      id: l.id, lineNo: l.line_no, sku: l.sku, title: v?.display_title || l.title, image: v?.image_src ?? null,
      ordered: l.order_qty_units ?? 0, shipped: shipped[l.id] ?? 0, received: l.received_qty_units ?? 0,
      unitCost: l.unit_cost, extended: l.extended_cost,
    };
  });

  const sup = Array.isArray(po.supplier) ? po.supplier[0] : po.supplier;
  const loc = Array.isArray(po.location) ? po.location[0] : po.location;
  const cur = po.currency_code ?? sup?.currency ?? 'USD';
  const totalUnits = lines.reduce((t, l) => t + l.ordered, 0);
  const totalCost = lines.reduce((t, l) => t + (parseFloat(l.extended) || 0), 0);
  const canShip = ['waiting_to_ship', 'partially_shipped', 'partially_received'].includes(po.status);
  const btn = 'px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition';

  return (
    <PortalFrame supplierName={s.supplierName} email={s.email}>
      <ShipmentProvider>
        <div className="space-y-4">
          <PageHeader
            backHref="/supplier-portal/orders"
            title={po.po_number}
            badge={<Badge status={po.status} />}
            actions={<CreateShipmentButton enabled={canShip} hint="Acknowledge this purchase order first" />}
          />

          <HideWhileCreating>
          <CollapsibleCards
            summary={[sup?.supplier_name, loc?.name && `Ship to ${loc.name}`, `${lines.length} line${lines.length === 1 ? '' : 's'}`, formatCurrency(totalCost, cur)].filter(Boolean).join(' · ')}
          >
            <div className="grid grid-cols-4 gap-4">
              <Card title="PO Info">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">PO Create Date</span><span className="font-medium text-gray-800">{fmtDate(po.po_date)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Requested Ship Date</span><span className="font-medium text-gray-800">{fmtDate(po.expected_date)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Expected Ship Date</span><span className="font-medium text-gray-800">{fmtDate(po.expected_ship_date)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Currency</span><span className="font-medium text-gray-800">{cur}</span></div>
                  {po.released_at && <div className="flex justify-between"><span className="text-gray-500">Released</span><span className="font-medium text-gray-800">{fmtDate(po.released_at)}</span></div>}
                </div>
              </Card>
              <Card title="Supplier">
                <div className="text-sm">
                  <p className="font-medium text-gray-800">{sup?.supplier_name || '—'}</p>
                  {sup?.supplier_number && <p className="text-gray-400 text-xs">#{sup.supplier_number}</p>}
                </div>
              </Card>
              <Card title="Ship To">
                <div className="text-sm space-y-0.5">
                  <p className="font-medium text-gray-800">{loc?.name || '—'}</p>
                  {loc?.address1 && <p className="text-gray-500">{loc.address1}</p>}
                  {loc?.address2 && <p className="text-gray-500">{loc.address2}</p>}
                  {(loc?.city || loc?.province || loc?.zip) && <p className="text-gray-500">{[loc.city, loc.province, loc.zip].filter(Boolean).join(', ')}</p>}
                  {loc?.country && <p className="text-gray-500">{loc.country}</p>}
                </div>
              </Card>
              <Card title="Summary">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Lines</span><span className="font-medium text-gray-800">{lines.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Units</span><span className="font-medium text-gray-800">{totalUnits.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Cost</span><span className="font-medium text-gray-800">{formatCurrency(totalCost, cur)}</span></div>
                </div>
              </Card>
            </div>
          </CollapsibleCards>
          </HideWhileCreating>

          {po.notes_supplier && (
            <Card title="Supplier Notes"><p className="text-sm text-gray-700 whitespace-pre-wrap">{po.notes_supplier}</p></Card>
          )}

          {po.status === 'pending_acknowledgement' ? <AckForm poId={po.id} requestedShipDate={po.expected_ship_date || po.expected_date || ''} /> : null}

          <LinesTable
            poId={po.id}
            lines={lines}
            currency={cur}
            config={shipConfig}
            exportLinks={
              <div className="flex items-center gap-2">
                <a href={`/api/supplier-portal/orders/${po.id}/export?format=csv`} className={btn}>Export CSV</a>
                <a href={`/api/supplier-portal/orders/${po.id}/export?format=pdf`} target="_blank" rel="noopener noreferrer" className={btn}>Export PDF</a>
              </div>
            }
          />
        </div>
      </ShipmentProvider>
    </PortalFrame>
  );
}
