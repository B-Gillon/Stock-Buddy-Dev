// /src/app/api/suppliers/[id]/currency/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

export async function GET(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;

    const { data, error } = await supabase.from("suppliers").select("currency").eq("id", id).single();
    if (error) throw error;
    return NextResponse.json({ currency: data?.currency ?? "USD" });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/currency/GET', error: err, tenantId });
    return NextResponse.json({ currency: "USD" });
  }
}
