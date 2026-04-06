import { supabase } from '@/lib/supabaseClient';
import PurchaseOrderCreatePage from '@/app/purchase-orders/create/components/PurchaseOrderCreatePage';

export default async function Page() {
  const [
    { data: suppliers },
    { data: locations },
    { data: variants },
    { data: supplierVariants },
    { data: inventoryLevels },
  ] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, supplier_name, supplier_number')
      .order('supplier_name'),
    supabase
      .from('locations')
      .select('id, name')
      .eq('active', true)
      .order('name'),
    supabase
      .from('variants')
      .select(`
        id,
        sku,
        barcode,
        display_title,
        image_src,
        inventory_quantity,
        cost,
        products (
          id,
          title
        )
      `)
      .order('display_title'),
    supabase
      .from('supplier_variants')
      .select('id, supplier_id, variant_id, supplier_sku, cost, case_pack, inner_pack, order_increment, moq, lead_days'),
    supabase
      .from('inventory_levels')
      .select(`
        available,
        incoming,
        location_id,
        inventory_items ( variant_id )
      `),
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

  // Flatten inventory levels: [{ variant_id, location_id, available, incoming }]
  const flatInventoryLevels = (inventoryLevels ?? [])
    .filter((il) => il.inventory_items?.variant_id)
    .map((il) => ({
      variant_id:  il.inventory_items.variant_id,
      location_id: il.location_id,
      available:   il.available ?? 0,
      incoming:    il.incoming ?? 0,
    }));

  return (
    <PurchaseOrderCreatePage
      suppliers={suppliers ?? []}
      locations={locations ?? []}
      variants={flatVariants}
      supplierVariants={supplierVariants ?? []}
      inventoryLevels={flatInventoryLevels}
    />
  );
}
