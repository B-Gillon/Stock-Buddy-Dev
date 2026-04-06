import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { receivePO } from "@/lib/sync/po/receivePO";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const tenantId = await getTenantId(request);

    const body = await request.json();
    const { receipts } = body;

    if (!receipts || !Array.isArray(receipts) || receipts.length === 0) {
      return Response.json(
        { success: false, error: "receipts array is required." },
        { status: 400 }
      );
    }

    // Validate shape
    for (const r of receipts) {
      if (!r.lineId || typeof r.receivedQty !== "number" || r.receivedQty <= 0) {
        return Response.json(
          { success: false, error: `Invalid receipt entry: ${JSON.stringify(r)}` },
          { status: 400 }
        );
      }
    }

    const result = await receivePO({ supabase, poId: id, tenantId, receipts });

    return Response.json({ success: true, po: result.po, lines: result.lines });
  } catch (err) {
    console.error("Receive PO error:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 400 });
  }
}
