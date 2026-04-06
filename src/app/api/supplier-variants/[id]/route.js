// /src/app/api/supplier-variants/[id]/route.js
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
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const allowed = [
    "item_code", "cost", "moq", "case_pack", "inner_pack",
    "order_increment", "lead_days", "initial_average_cost", "notes",
  ];

  const updates = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = body[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "cost")) {
    updates.last_cost_update = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("supplier_variants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/supplier-variants/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
