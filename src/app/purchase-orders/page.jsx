import { supabase } from '@/lib/supabaseClient';
import PurchaseOrdersLandingPage from './components/PurchaseOrdersLandingPage';

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const status      = params.status      ?? '';
  const supplierId  = params.supplier_id ?? '';
  const dateFrom    = params.date_from   ?? '';
  const dateTo      = params.date_to     ?? '';
  const search      = params.search      ?? '';

  // Build PO query
  let query = supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      supplier_id,
      status,
      po_date,
      expected_date,
      suppliers ( supplier_name )
    `)
    .order('po_date', { ascending: false });

  if (status)     query = query.eq('status', status);
  if (supplierId) query = query.eq('supplier_id', supplierId);
  if (dateFrom)   query = query.gte('po_date', dateFrom);
  if (dateTo)     query = query.lte('po_date', dateTo);
  if (search) {
    query = query.or(`po_number.ilike.%${search}%,suppliers.supplier_name.ilike.%${search}%`);
  }

  const { data: posRaw } = await query;

  // Fetch totals for all returned POs
  const poIds = (posRaw ?? []).map((p) => p.id);
  let totalsMap = {};
  if (poIds.length > 0) {
    const { data: lines } = await supabase
      .from('purchase_order_lines')
      .select('purchase_order_id, extended_cost')
      .in('purchase_order_id', poIds);

    (lines ?? []).forEach((l) => {
      totalsMap[l.purchase_order_id] = (totalsMap[l.purchase_order_id] ?? 0) + (parseFloat(l.extended_cost) || 0);
    });
  }

  // Flatten
  const purchaseOrders = (posRaw ?? []).map((po) => ({
    id:            po.id,
    po_number:     po.po_number,
    supplier_name: po.suppliers?.supplier_name ?? '—',
    status:        po.status,
    po_date:       po.po_date,
    expected_date: po.expected_date,
    total_cost:    totalsMap[po.id] ?? null,
  }));

  // Suppliers for filter dropdown
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, supplier_name')
    .order('supplier_name');

  const currentFilters = { status, supplier_id: supplierId, date_from: dateFrom, date_to: dateTo, search };

  return (
    <PurchaseOrdersLandingPage
      purchaseOrders={purchaseOrders}
      suppliers={suppliers ?? []}
      currentFilters={currentFilters}
    />
  );
}
