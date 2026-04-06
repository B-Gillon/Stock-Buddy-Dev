import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { releasePO } from "@/lib/sync/po/releasePO";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const tenantId = await getTenantId(request);

    const result = await releasePO({ supabase, poId: id, tenantId });

    return Response.json({ success: true, po: result.po, lines: result.lines });
  } catch (err) {
    console.error("Release PO error:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 400 });
  }
}
