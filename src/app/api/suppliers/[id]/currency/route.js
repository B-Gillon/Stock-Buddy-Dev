// /src/app/api/suppliers/[id]/currency/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  const { data, error } = await supabase
    .from("suppliers")
    .select("currency")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ currency: "USD" });
  }

  return NextResponse.json({ currency: data.currency });
}
