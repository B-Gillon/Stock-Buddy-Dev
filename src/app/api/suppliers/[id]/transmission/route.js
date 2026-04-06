// /src/app/api/suppliers/[id]/transmission/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';

// GET /api/suppliers/[id]/transmission
// Returns all recipients for a supplier ordered by sort_order
export async function GET(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  const { data, error } = await supabase
    .from('supplier_transmission_recipients')
    .select('*')
    .eq('supplier_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('GET supplier_transmission_recipients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipients: data || [] });
}

// POST /api/suppliers/[id]/transmission
// Replaces all recipients for a supplier in one shot
// Body: { recipients: [{ id?, label, email, role, send_pdf, send_csv, sort_order }] }
export async function POST(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id: supplier_id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { recipients } = body;

  if (!Array.isArray(recipients)) {
    return NextResponse.json({ error: 'recipients must be an array' }, { status: 400 });
  }

  // Validate each recipient
  for (const r of recipients) {
    if (!r.email?.trim()) {
      return NextResponse.json({ error: 'All recipients must have an email address' }, { status: 400 });
    }
    if (!['Primary', 'CC', 'BCC'].includes(r.role)) {
      return NextResponse.json({ error: `Invalid role: ${r.role}` }, { status: 400 });
    }
  }

  // Delete all existing recipients for this supplier, then re-insert
  const { error: deleteError } = await supabase
    .from('supplier_transmission_recipients')
    .delete()
    .eq('supplier_id', supplier_id);

  if (deleteError) {
    console.error('DELETE supplier_transmission_recipients error:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (recipients.length > 0) {
    const rows = recipients.map((r, idx) => ({
      tenant_id:   tenantId,
      supplier_id,
      label:       r.label?.trim() || '',
      email:       r.email.trim(),
      role:        r.role,
      send_pdf:    r.send_pdf ?? true,
      send_csv:    r.send_csv ?? true,
      sort_order:  idx,
      updated_at:  new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('supplier_transmission_recipients')
      .insert(rows);

    if (insertError) {
      console.error('INSERT supplier_transmission_recipients error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
