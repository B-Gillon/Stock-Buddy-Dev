// /src/app/api/suppliers/[id]/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

export async function PATCH(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    id: _id,
    supplier_number: _supplier_number,
    created_at: _created_at,
    updated_at: _updated_at,
    supplier_addresses: _addresses,
    ...updateData
  } = body;

  const { error } = await supabase
    .from("suppliers")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Supplier PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
