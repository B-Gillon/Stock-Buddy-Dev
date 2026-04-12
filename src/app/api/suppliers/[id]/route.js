// /src/app/api/suppliers/[id]/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

export async function PATCH(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;
    const body = await request.json();

    const { id: _id, supplier_number: _sn, created_at: _ca, updated_at: _ua, supplier_addresses: _addr, ...updateData } = body;

    const { error } = await supabase
      .from("suppliers")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/PATCH', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
