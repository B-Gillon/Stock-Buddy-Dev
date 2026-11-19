// /src/app/purchase-orders/page.jsx

import { headers } from "next/headers";
import { supabase } from '@/lib/supabaseClient';
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { NOT_FULLY_SHIPPED_STATUSES } from '@/lib/poStatus';
import PurchaseOrdersLandingPage from './components/PurchaseOrdersLandingPage';

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const params = await searchParams;

  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const status      = params.status      ?? '';
  const supplierId  = params.supplier_id ?? '';
  const locationId  = params.location_id ?? '';
  const dateFrom    = params.date_from   ?? '';
  const dateTo      = params.date_to     ?? '';
  const search      = params.search      ?? '';

  let query = supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      supplier_id,
      ship_to_location_id,
      status,
      po_date,
      expected_date,
      expected_ship_date,
      suppliers ( supplier_name ),
      locations ( name )
    `)
    .eq('tenant_id', tenantId)
    .order('po_date', { ascending: false });

  if (status === 'overdue') {
    const today = new Date().toISOString().split('T')[0];
    query = query
      .lt('expected_date', today)
      .not('status', 'in', '("draft","cancelled","received")');
  } else if (status === 'in_transit') {
    const today = new Date().toISOString().split('T')[0];
    query = query.eq('status', 'shipped').or(`expected_date.is.null,expected_date.gte.${today}`);
  } else if (status === 'ship_this_week' || status === 'ship_later') {
    // same buckets as the dashboard report: not overdue, still something to ship
    const today = new Date().toISOString().split('T')[0];
    query = query
      .in('status', NOT_FULLY_SHIPPED_STATUSES)
      .or(`expected_date.is.null,expected_date.gte.${today}`);
  } else if (status === 'not_put_away') {
    // received (fully or partly) with something not yet put away; a late partly-received PO shows as Overdue instead
    query = query.in('status', ['received', 'partially_received']);
  } else if (status === 'shipped') {
    query = query.in('status', ['shipped', 'partially_shipped']);
  } else if (status === 'received') {
    query = query.in('status', ['received', 'partially_received']);
  } else if (status) {
    query = query.eq('status', status);
  } else {
    query = query.not('status', 'in', '("cancelled","received")');
  }

  if (supplierId) query = query.eq('supplier_id', supplierId);
  if (locationId) query = query.eq('ship_to_location_id', locationId);
  if (dateFrom)   query = query.gte('po_date', dateFrom);
  if (dateTo)     query = query.lte('po_date', dateTo);
  if (search)     query = query.or(`po_number.ilike.%${search}%`);

  let { data: posRaw } = await query;

  if (status === 'not_put_away') {
    const today = new Date().toISOString().split('T')[0];
    const ids = (posRaw ?? []).map((p) => p.id);
    const ready = new Set();
    if (ids.length) {
      const { data: pl } = await supabase.from('purchase_order_lines')
        .select('purchase_order_id, received_qty_units, putaway_qty_units').eq('tenant_id', tenantId).in('purchase_order_id', ids);
      for (const l of pl ?? []) if ((l.received_qty_units ?? 0) > (l.putaway_qty_units ?? 0)) ready.add(l.purchase_order_id);
    }
    posRaw = (posRaw ?? []).filter((po) => ready.has(po.id) && !(po.status !== 'received' && po.expected_date && po.expected_date < today));
  }

  if (status === 'ship_this_week' || status === 'ship_later') {
    const today = new Date().toISOString().split('T')[0];
    const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
    const weekEnd = new Date(new Date(today + 'T00:00:00Z').getTime() + (6 - dow) * 864e5).toISOString().slice(0, 10);
    posRaw = (posRaw ?? []).filter((po) => {
      const ship = po.expected_ship_date || po.expected_date;
      const thisWeek = !!ship && ship <= weekEnd;
      return status === 'ship_this_week' ? thisWeek : !thisWeek;
    });
  }

  const poIds = (posRaw ?? []).map((p) => p.id);
  let totalsMap = {};
  if (poIds.length > 0) {
    const { data: lines } = await supabase
      .from('purchase_order_lines')
      .select('purchase_order_id, extended_cost')
      .eq('tenant_id', tenantId)
      .in('purchase_order_id', poIds);

    (lines ?? []).forEach((l) => {
      totalsMap[l.purchase_order_id] = (totalsMap[l.purchase_order_id] ?? 0) + (parseFloat(l.extended_cost) || 0);
    });
  }

  const purchaseOrders = (posRaw ?? []).map((po) => ({
    id:                  po.id,
    po_number:           po.po_number,
    supplier_name:       po.suppliers?.supplier_name ?? '—',
    location_name:       po.locations?.name ?? '—',
    ship_to_location_id: po.ship_to_location_id,
    status:              po.status,
    po_date:             po.po_date,
    expected_date:       po.expected_date,
    expected_ship_date:  po.expected_ship_date,
    total_cost:          totalsMap[po.id] ?? null,
  }));

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, supplier_name')
    .eq('tenant_id', tenantId)
    .order('supplier_name');

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name');

  const currentFilters = { status, supplier_id: supplierId, location_id: locationId, date_from: dateFrom, date_to: dateTo, search };

  return (
    <PurchaseOrdersLandingPage
      purchaseOrders={purchaseOrders}
      suppliers={suppliers ?? []}
      locations={locations ?? []}
      currentFilters={currentFilters}
    />
  );
}
