import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import AppLayout from "@/shared/components/layout/AppLayout";
import ClientReceivePOPage from "../components/ClientReceivePOPage";

export default async function ReceivePOPage({ params }) {
  const { slug } = await params;

  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // Fetch PO by po_number (slug)
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      supplier:suppliers!supplier_id (
        id,
        supplier_name,
        supplier_number
      ),
      location:locations!ship_to_location_id (
        id,
        name,
        shopify_location_id
      )
    `)
    .eq("po_number", slug)
    .single();

  if (poError || !po) notFound();

  // Only released or partially_received POs can be received
  if (!["released", "partially_received"].includes(po.status)) {
    redirect(`/purchase-orders/${slug}`);
  }

  // Fetch lines (no inventory_items join — resolve separately)
  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      *,
      variant:variants!variant_id (
        id,
        sku,
        title,
        display_title,
        image_src,
        option1,
        option2,
        option3
      )
    `)
    .eq("purchase_order_id", po.id)
    .order("line_no", { ascending: true });

  if (linesError) throw new Error(linesError.message);

  // Fetch inventory items separately by variant_id
  const variantIds = (lines ?? []).map((l) => l.variant_id).filter(Boolean);
  let inventoryMap = {};
  if (variantIds.length > 0) {
    const { data: invItems } = await supabase
      .from("inventory_items")
      .select("variant_id, shopify_inventory_item_id")
      .in("variant_id", variantIds);

    (invItems ?? []).forEach((item) => {
      inventoryMap[item.variant_id] = item.shopify_inventory_item_id;
    });
  }

  // Flatten for client component
  const flatLines = (lines ?? []).map((l) => ({
    id: l.id,
    line_no: l.line_no,
    sku: l.sku,
    title: l.title,
    display_title: l.variant?.display_title ?? l.title,
    image_src: l.variant?.image_src ?? null,
    variant_id: l.variant_id,
    order_qty_units: l.order_qty_units,
    received_qty_units: l.received_qty_units ?? 0,
    remaining_qty: l.order_qty_units - (l.received_qty_units ?? 0),
    unit_cost: l.unit_cost,
    shopify_inventory_item_id: inventoryMap[l.variant_id] ?? null,
  }));

  const flatPO = {
    id: po.id,
    po_number: po.po_number,
    status: po.status,
    expected_date: po.expected_date,
    supplier_name: po.supplier?.supplier_name ?? "",
    supplier_number: po.supplier?.supplier_number ?? "",
    location_name: po.location?.name ?? "",
  };

  return (
    <AppLayout showActionBar={false}>
      <ClientReceivePOPage po={flatPO} lines={flatLines} slug={slug} />
    </AppLayout>
  );
}
