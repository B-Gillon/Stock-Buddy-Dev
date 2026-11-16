// One purchase order, as the supplier sees it: same layout as the retailer's PO screen
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier } from '@/lib/supplierPortal';
import { shippedByLine } from '@/lib/shipments';
import { loadShipmentConfig } from '@/lib/shipmentSettings';
import { normalizeLineColumns } from '@/lib/supplierColumns';
import { loadLabelSettings } from '@/lib/sscc';
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

export default async function OrderPage({ params, searchParams }) {
  const s = await requireSupplier();
  const { id } = await params;
  const { from } = (await searchParams) ?? {};
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
    .select('id, line_no, sku, title, order_qty_units, received_qty_units, unit_cost, extended_cost, supplier_variant_id, variant:variants!variant_id ( display_title, image_src, barcode )')
    .eq('purchase_order_id', po.id).order('line_no', { ascending: true });
  const shipConfig = await loadShipmentConfig(s.tenantId);
  const labelSettings = await loadLabelSettings(s.tenantId, s.supplierId);
  const { data: shipRows } = await supabase.from('shipments')
    .select('id, shipment_number, ship_date, total_cartons, shipment_cartons ( sscc )')
    .eq('po_id', po.id).eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).order('created_at', { ascending: true });
  const shipped = await shippedByLine((rows ?? []).map((r) => r.id));
  const svIds = [...new Set((rows ?? []).map((r) => r.supplier_variant_id).filter(Boolean))];
  const { data: svs } = svIds.length
    ? await supabase.from('supplier_variants').select('id, supplier_sku, supplier_barcode').in('id', svIds)
    : { data: [] };
  const svById = new Map((svs ?? []).map((v) => [v.id, v]));
  const { data: me } = await supabase.from('app_users').select('ui_prefs').eq('id', s.userId).maybeSingle();
  const lineColumns = normalizeLineColumns(me?.ui_prefs?.lineColumns);
  const lines = (rows ?? []).map((l) => {
    const sv = svById.get(l.supplier_variant_id);
    const v = Array.isArray(l.variant) ? l.variant[0] : l.variant;
    return {
      id: l.id, lineNo: l.line_no, sku: l.sku, supplierSku: sv?.supplier_sku ?? null,
      barcode: v?.barcode || sv?.supplier_barcode || null, title: v?.display_title || l.title, image: v?.image_src ?? null,
      ordered: l.order_qty_units ?? 0, shipped: shipped[l.id] ?? 0, received: l.received_qty_units ?? 0,
      unitCost: l.unit_cost, extended: l.extended_cost,
    };
  });

  const sup = Array.isArray(po.supplier) ? po.supplier[0] : po.supplier;
  const loc = Array.isArray(po.location) ? po.location[0] : po.location;
  const cur = po.currency_code ?? sup?.currency ?? 'USD';
  const totalUnits = lines.reduce((t, l) => t + l.ordered, 0);
  const totalCost = lines.reduce((t, l) => t + (parseFloat(l.extended) || 0), 0);
  // Which menu item to highlight: where the user came from, else by what the PO is doing
  const section = from === 'orders' || from === 'shipping' ? from
    : ['waiting_to_ship', 'partially_shipped', 'shipped', 'partially_received'].includes(po.status) ? 'shipping' : 'orders';
  const canShip = ['waiting_to_ship', 'partially_shipped', 'partially_received'].includes(po.status);
  const btn = 'px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition';

  return (
    <PortalFrame active={section} supplierName={s.supplierName} email={s.email}>
      <ShipmentProvider>
        <div className="space-y-4">
          <PageHeader
            backHref={`/supplier-portal/${section}`}
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
            lineColumns={lineColumns}
            labels={{ enabled: labelSettings.enabled, printMode: labelSettings.printMode }}
            exportLinks={
              <div className="flex items-center gap-2">
                <a href={`/api/supplier-portal/orders/${po.id}/export?format=csv`} className={btn}>Export CSV</a>
                <a href={`/api/supplier-portal/orders/${po.id}/export?format=pdf`} target="_blank" rel="noopener noreferrer" className={btn}>Export PDF</a>
              </div>
            }
          />

          <HideWhileCreating>
            {(shipRows ?? []).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">Shipments</h2>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                    <th className="text-left px-3 py-2 font-medium">Shipment</th><th className="text-left px-3 py-2 font-medium">Ship Date</th>
                    <th className="text-left px-3 py-2 font-medium">Cartons</th><th className="px-3 py-2"></th>
                  </tr></thead>
                  <tbody>
                    {shipRows.map((sh) => (
                      <tr key={sh.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-800">{sh.shipment_number}</td>
                        <td className="px-3 py-2 text-gray-700">{fmtDate(sh.ship_date)}</td>
                        <td className="px-3 py-2 text-gray-700">{sh.total_cartons ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {(sh.shipment_cartons ?? []).some((c) => c.sscc) && (
                            <a className={btn} href={`/supplier-portal/labels?shipment=${sh.id}`} target="_blank" rel="noopener noreferrer">Print labels</a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </HideWhileCreating>
        </div>
      </ShipmentProvider>
    </PortalFrame>
  );
}
