// /src/app/api/sync-status/route.js
import { NextResponse } from "next/server";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";

export async function GET(request) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { data, error } = await supabase
    .from("sync_status")
    .select("sync_type, last_synced_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Object.fromEntries(
    (data || []).map((r) => [r.sync_type, r.last_synced_at])
  );

  return NextResponse.json(result);
}
