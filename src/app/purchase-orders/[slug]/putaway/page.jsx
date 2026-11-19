// /src/app/purchase-orders/[slug]/putaway/page.jsx
// Placeholder: shows what is Ready for Putaway. The putaway action itself comes next.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import AppLayout from "@/shared/components/layout/AppLayout";
import Card from "@/shared/components/ui/Card";
import PageHeader from "@/shared/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function PutawayPage({ params }) {
  const { slug } = await params;
  const poNumber = decodeURIComponent(slug);
  const tenantId = await getTenantIdFromHeaders(await headers());

  const { data: po } = await supabase.from("purchase_orders").select("id, po_number")
    .eq("tenant_id", tenantId).eq("po_number", poNumber).single();
  if (!po) notFound();

  const { data: lines } = await supabase.from("purchase_order_lines")
    .select("id, line_no, sku, title, received_qty_units, putaway_qty_units")
    .eq("tenant_id", tenantId).eq("purchase_order_id", po.id).order("line_no");
  const ready = (lines ?? [])
    .map((l) => ({ ...l, ready: (l.received_qty_units ?? 0) - (l.putaway_qty_units ?? 0) }))
    .filter((l) => l.ready > 0);

  return (
    <AppLayout title={`Putaway ${po.po_number}`}>
      <div className="space-y-4">
        <PageHeader title={`Putaway — ${po.po_number}`} backHref={`/purchase-orders/${slug}`} />
        <Card title="Ready for Putaway">
          <p className="mb-3 text-sm text-gray-500">Putaway entry is coming soon. These quantities have been received and are waiting.</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-xs text-gray-600">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">SKU</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Ready for Putaway</th>
            </tr></thead>
            <tbody>{ready.map((l) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-400">{l.line_no}</td>
                <td className="px-3 py-2 text-gray-600">{l.sku || "—"}</td>
                <td className="px-3 py-2 text-gray-800">{l.title || "—"}</td>
                <td className="px-3 py-2 text-gray-800">{l.ready.toLocaleString()}</td>
              </tr>))}</tbody>
          </table>
        </Card>
      </div>
    </AppLayout>
  );
}
