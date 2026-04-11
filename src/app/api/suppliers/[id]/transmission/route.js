import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";

export async function GET(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id } = await params;

    const { data, error } = await supabase
      .from("supplier_transmission_recipients")
      .select("id, label, to_emails, cc_emails, bcc_emails, send_pdf, send_csv, sort_order")
      .eq("tenant_id", tenantId)
      .eq("supplier_id", id)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ recipients: data ?? [] });
  } catch (err) {
    console.error("GET /api/suppliers/[id]/transmission error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const tenantId  = await getTenantId(request);
    const { id: supplierId } = await params;
    const { recipients } = await request.json();

    if (!Array.isArray(recipients)) {
      return NextResponse.json({ error: "recipients must be an array" }, { status: 400 });
    }

    // Validate: at least one record with a non-empty to_emails
    const hasTo = recipients.some((r) => r.to_emails?.trim());
    if (!hasTo) {
      return NextResponse.json(
        { error: "At least one record with a To email address is required." },
        { status: 422 }
      );
    }

    // Delete all existing rows for this supplier
    const { error: deleteError } = await supabase
      .from("supplier_transmission_recipients")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("supplier_id", supplierId);

    if (deleteError) throw deleteError;

    // Re-insert
    if (recipients.length > 0) {
      const rows = recipients.map((r, index) => ({
        tenant_id:  tenantId,
        supplier_id: supplierId,
        label:      r.label      ?? "",
        to_emails:  r.to_emails  ?? "",
        cc_emails:  r.cc_emails  || null,
        bcc_emails: r.bcc_emails || null,
        send_pdf:   r.send_pdf   ?? true,
        send_csv:   r.send_csv   ?? true,
        sort_order: index,
      }));

      const { error: insertError } = await supabase
        .from("supplier_transmission_recipients")
        .insert(rows);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/suppliers/[id]/transmission error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
