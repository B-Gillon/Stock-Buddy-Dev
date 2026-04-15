// /src/app/purchase-orders/[slug]/edit/page.jsx
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabaseClient';
import { getTenantIdFromHeaders } from '@/lib/tenants';
import PurchaseOrderCreatePage from '../../create/components/PurchaseOrderCreatePage';

export default async function Page({ params }) {
  const { slug } = await params;
  const poNumber = decodeURIComponent(slug);

  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // Load the existing PO
  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`*, suppliers ( supplier_name, supplier_number ), locations ( name )`)
    .eq('tenant_id', tenantId)
    .eq('po_number', poNumber)
    .single();

  if (!po) {
    return <div className="p-8 text-gray-500">Purchase order not found.</div>;
  }

  // Load existing line items
  const { data: existingLines } = await supabase
    .from('purchase_order_lines')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('purchase_order_id', po.id)
    .order('created_at');

  // Load supporting data
  const [
    { data: suppliers },
    { data: locations },
    { data: variants },
    { data: supplierVariants },
    { data: inventoryLevels },
  ] = await Promise.all([
    supabase.from('suppliers').select('id, supplier_name, supplier_number, lead_days').eq('tenant_id', tenantId).order('supplier_name'),
    supabase.from('locations').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('name'),
    supabase.from('variants').select(`
      id, sku, barcode, display_title, image_src, inventory_quantity, cost,
      products ( id, title )
    `).eq('tenant_id', tenantId).order('display_title'),
    supabase.from('supplier_variants').select('id, supplier_id, variant_id, supplier_sku, cost, case_pack, inner_pack, order_increment, moq, lead_days').eq('tenant_id', tenantId),
    supabase.from('inventory_levels').select(`available, incoming, location_id, inventory_items ( variant_id )`).eq('tenant_id', tenantId),
  ]);

  const flatVariants = (variants ?? []).map((v) => ({
    id:                 v.id,
    sku:                v.sku,
    barcode:            v.barcode,
    display_title:      v.display_title,
    image_src:          v.image_src,
    inventory_quantity: v.inventory_quantity,
    cost:               v.cost ?? null,
    product_title:      v.products?.title ?? null,
    product_id:         v.products?.id ?? null,
  }));

  const flatInventoryLevels = (inventoryLevels ?? [])
    .filter((il) => il.inventory_items?.variant_id)
    .map((il) => ({
      variant_id:  il.inventory_items.variant_id,
      location_id: il.location_id,
      available:   il.available ?? 0,
      incoming:    il.incoming ?? 0,
    }));

  // Build initialHeader from existing PO
  const initialHeader = {
    supplier_id:         po.supplier_id,
    ship_to_location_id: po.ship_to_location_id ?? '',
    po_date:             po.po_date ? po.po_date.split('T')[0] : '',
    expected_date:       po.expected_date ?? '',
    notes_internal:      po.notes_internal ?? '',
    notes_supplier:      po.notes_supplier ?? '',
    status:              po.status,
  };

  // Build initialRows from existing line items
  const initialRows = (existingLines ?? []).map((line) => {
    const variant = flatVariants.find((v) => v.id === line.variant_id);
    const sv      = (supplierVariants ?? []).find((sv) => sv.variant_id === line.variant_id && sv.supplier_id === po.supplier_id);
    return {
      variant_id:           line.variant_id,
      supplier_variant_id:  line.supplier_variant_id ?? null,
      display_title:        line.title ?? '',
      sku:                  line.sku ?? '',
      barcode:              variant?.barcode ?? '',
      supplier_sku:         sv?.supplier_sku ?? '',
      current_available:    null,
      on_order:             null,
      order_qty:            String(line.order_qty_units ?? ''),
      unit_cost:            line.unit_cost != null ? String(line.unit_cost) : '',
      unit_cost_overridden: false,
      case_pack:            line.case_pack_qty ?? null,
      order_increment:      sv?.order_increment ?? null,
      moq:                  sv?.moq ?? null,
      lead_days:            sv?.lead_days ?? null,
      extended_cost:        line.extended_cost != null ? parseFloat(line.extended_cost) : null,
      esd:                  null,
      error:                null,
    };
  });

  return (
    <PurchaseOrderCreatePage
      suppliers={suppliers ?? []}
      locations={locations ?? []}
      variants={flatVariants}
      supplierVariants={supplierVariants ?? []}
      inventoryLevels={flatInventoryLevels}
      editMode={true}
      existingPO={{ id: po.id, po_number: po.po_number }}
      initialHeader={initialHeader}
      initialRows={initialRows}
    />
  );
}
