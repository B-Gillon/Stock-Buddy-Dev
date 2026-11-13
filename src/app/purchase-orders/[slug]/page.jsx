// /src/app/purchase-orders/[slug]/page.jsx
// SERVER COMPONENT — no "use client"

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import AppLayout from "@/shared/components/layout/AppLayout";
import Badge from "@/shared/components/ui/Badge";
import Card from "@/shared/components/ui/Card";
import PageHeader from "@/shared/components/ui/PageHeader";
import PODetailActions from "./components/PODetailActions";
import POHistoryTable from "./components/POHistoryTable";
import CollapsibleCards from "./components/CollapsibleCards";

function fmtDate(val) {
  if (!val) return "—";
  const str = String(val).substring(0, 10);
  const [yyyy, mm, dd] = str.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({ params, searchParams }) {
  const { slug } = await params;
  const poNumber = decodeURIComponent(slug);
  const { view: viewParam } = (await searchParams) ?? {};
  const view = viewParam === "history" ? "history" : "details";

  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      supplier:suppliers!supplier_id (
        id, supplier_name, supplier_number, currency
      ),
      location:locations!ship_to_location_id (
        id, name, address1, address2, city, province, country, zip
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("po_number", poNumber)
    .single();

  if (poError || !po) notFound();

  const { data: lines, error: linesError } = await supabase
    .from("purchase_order_lines")
    .select(`
      *,
      variant:variants!variant_id (
        id, sku, display_title, image_src, barcode
      ),
      supplier_variant:supplier_variants!supplier_variant_id (
        supplier_sku, supplier_barcode
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("purchase_order_id", po.id)
    .order("line_no", { ascending: true });

  if (linesError) throw new Error(linesError.message);

  const currencyCode = po.currency_code ?? po.supplier?.currency ?? 'USD';

  const flatLines = (lines ?? []).map((l) => ({
    id:               l.id,
    line_no:          l.line_no,
    sku:              l.sku,
    title:            l.title,
    display_title:    l.variant?.display_title ?? l.title,
    image_src:        l.variant?.image_src ?? null,
    barcode:          l.variant?.barcode ?? null,
    supplier_sku:     l.supplier_variant?.supplier_sku ?? null,
    supplier_barcode: l.supplier_variant?.supplier_barcode ?? null,
    variant_id:         l.variant_id,
    order_qty_units:    l.order_qty_units,
    received_qty_units: l.received_qty_units ?? 0,
    order_qty_cases:    l.order_qty_cases,
    case_pack_qty:      l.case_pack_qty,
    unit_cost:          l.unit_cost,
    extended_cost:      l.extended_cost,
  }));

  const flatPO = {
    id:                 po.id,
    po_number:          po.po_number,
    status:             po.status,
    po_date:            po.po_date,
    expected_date:      po.expected_date,
    notes_internal:     po.notes_internal,
    notes_supplier:     po.notes_supplier,
    currency_code:      currencyCode,
    released_at:        po.released_at,
    cancelled_at:       po.cancelled_at,
    supplier_id:        po.supplier_id,
    supplier_name:      po.supplier?.supplier_name ?? "",
    supplier_number:    po.supplier?.supplier_number ?? "",
    location_name:      po.location?.name ?? "",
    location_address1:  po.location?.address1 ?? "",
    location_address2:  po.location?.address2 ?? "",
    location_city:      po.location?.city ?? "",
    location_province:  po.location?.province ?? "",
    location_country:   po.location?.country ?? "",
    location_zip:       po.location?.zip ?? "",
  };

  let history = [];
  let openSftpCount = 0;
  if (view === "history") {
    const { count } = await supabase
      .from("po_sftp_transmissions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("po_id", po.id)
      .in("status", ["uploaded", "retrieved"]);
    openSftpCount = count ?? 0;

    const { data: historyRows, error: historyError } = await supabase
      .from("po_activity_log")
      .select("id, action, comments, user_name, created_at")
      .eq("tenant_id", tenantId)
      .eq("po_id", po.id)
      .order("created_at", { ascending: false });
    if (historyError) throw new Error(historyError.message);
    history = historyRows ?? [];
  }

  const totalUnits = flatLines.reduce((sum, l) => sum + (l.order_qty_units ?? 0), 0);
  const totalCost  = flatLines.reduce((sum, l) => sum + (parseFloat(l.extended_cost) || 0), 0);

  return (
    <AppLayout title={flatPO.po_number} showActionBar={false}>
      <div className="space-y-4">

        <PageHeader
          backHref="/purchase-orders"
          badge={<Badge status={flatPO.status} />}
          actions={<PODetailActions po={flatPO} slug={slug} view={view} />}
        />

        <CollapsibleCards
          summary={[
            flatPO.supplier_name,
            flatPO.location_name && `Ship to ${flatPO.location_name}`,
            `${flatLines.length} line${flatLines.length === 1 ? "" : "s"}`,
            formatCurrency(totalCost, currencyCode),
          ].filter(Boolean).join(" · ")}
        >
        <div className="grid grid-cols-4 gap-4">
          <Card title="PO Info">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">PO Date</span><span className="font-medium text-gray-800">{fmtDate(flatPO.po_date)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Expected Date</span><span className="font-medium text-gray-800">{fmtDate(flatPO.expected_date)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Currency</span><span className="font-medium text-gray-800">{currencyCode}</span></div>
              {flatPO.released_at && <div className="flex justify-between"><span className="text-gray-500">Released</span><span className="font-medium text-gray-800">{fmtDate(flatPO.released_at)}</span></div>}
            </div>
          </Card>
          <Card title="Supplier">
            <div className="text-sm">
              <p className="font-medium text-gray-800">{flatPO.supplier_name || "—"}</p>
              {flatPO.supplier_number && <p className="text-gray-400 text-xs">#{flatPO.supplier_number}</p>}
            </div>
          </Card>
          <Card title="Ship To">
            <div className="text-sm space-y-0.5">
              <p className="font-medium text-gray-800">{flatPO.location_name || "—"}</p>
              {flatPO.location_address1 && <p className="text-gray-500">{flatPO.location_address1}</p>}
              {flatPO.location_address2 && <p className="text-gray-500">{flatPO.location_address2}</p>}
              {(flatPO.location_city || flatPO.location_province || flatPO.location_zip) && <p className="text-gray-500">{[flatPO.location_city, flatPO.location_province, flatPO.location_zip].filter(Boolean).join(", ")}</p>}
              {flatPO.location_country && <p className="text-gray-500">{flatPO.location_country}</p>}
            </div>
          </Card>
          <Card title="Summary">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Lines</span><span className="font-medium text-gray-800">{flatLines.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Units</span><span className="font-medium text-gray-800">{totalUnits.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Cost</span><span className="font-medium text-gray-800">{formatCurrency(totalCost, currencyCode)}</span></div>
            </div>
          </Card>
        </div>
        </CollapsibleCards>

        {(flatPO.notes_internal || flatPO.notes_supplier) && (
          <div className="grid grid-cols-2 gap-4">
            {flatPO.notes_internal && <Card title="Internal Notes"><p className="text-sm text-gray-700 whitespace-pre-wrap">{flatPO.notes_internal}</p></Card>}
            {flatPO.notes_supplier && <Card title="Supplier Notes"><p className="text-sm text-gray-700 whitespace-pre-wrap">{flatPO.notes_supplier}</p></Card>}
          </div>
        )}

        {view === "history" ? (
          <POHistoryTable rows={history} poId={flatPO.id} openSftpCount={openSftpCount} />
        ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-800">Line Items<span className="ml-2 text-xs font-normal text-gray-400">({flatLines.length})</span></h2>
            <div className="flex items-center gap-2">
              <a href={`/api/purchase-orders/${flatPO.id}/export-csv`} className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition">Export CSV</a>
              <a href={`/api/purchase-orders/${flatPO.id}/export-pdf`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition">Export PDF</a>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium"></th>
                <th className="text-left px-3 py-2 font-medium">SKU</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-left px-3 py-2 font-medium">Ordered</th>
                <th className="text-left px-3 py-2 font-medium">Received</th>
                <th className="text-left px-3 py-2 font-medium">Open</th>
                <th className="text-left px-3 py-2 font-medium">Unit Cost</th>
                <th className="text-left px-3 py-2 font-medium">Extended Cost</th>
              </tr>
            </thead>
            <tbody>
              {flatLines.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No line items on this purchase order.</td></tr>
              ) : flatLines.map((line) => {
                const open = (line.order_qty_units ?? 0) - (line.received_qty_units ?? 0);
                return (
                  <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{line.line_no}</td>
                    <td className="px-3 py-2">
                      <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                        {line.image_src ? <img src={line.image_src} alt={line.title} className="object-cover w-full h-full" /> : <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{line.sku || "—"}</td>
                    <td className="px-3 py-2 text-gray-800 font-medium">{line.display_title || line.title || "—"}</td>
                    <td className="px-3 py-2 text-gray-800">{line.order_qty_units?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-800">{(line.received_qty_units ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-800">{open > 0 ? open.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 text-gray-800">{formatCurrency(line.unit_cost, currencyCode)}</td>
                    <td className="px-3 py-2 text-gray-800">{formatCurrency(line.extended_cost, currencyCode)}</td>
                  </tr>
                );
              })}
            </tbody>
            {flatLines.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 text-sm text-gray-800">
                  <td className="px-3 py-2" colSpan={3}></td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-medium">Totals</td>
                  <td className="px-3 py-2 font-semibold">{totalUnits.toLocaleString()}</td>
                  <td className="px-3 py-2" colSpan={3}></td>
                  <td className="px-3 py-2 font-semibold">{formatCurrency(totalCost, currencyCode)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}

      </div>
    </AppLayout>
  );
}
