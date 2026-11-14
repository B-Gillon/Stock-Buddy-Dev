// /src/app/api/suppliers/[id]/acknowledgement-settings/route.js
// "Acknowledgement required" + reminder options for a supplier (email transmission level).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

async function assertSupplier(supplierId, tenantId) {
  const { data } = await supabase
    .from('suppliers').select('id').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

export async function GET(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const { data } = await supabase
      .from('supplier_transmission_settings')
      .select('ack_required, ack_reminder_days, ack_reminder_cc')
      .eq('supplier_id', id)
      .maybeSingle();
    return NextResponse.json({
      settings: {
        ack_required: !!data?.ack_required,
        ack_reminder_days: data?.ack_reminder_days ?? null,
        ack_reminder_cc: data?.ack_reminder_cc ?? '',
      },
    });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/acknowledgement-settings/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const b = await request.json();
    const required = !!b.ack_required;

    let days = null;
    let cc = null;
    if (required && b.ack_reminder_days != null && b.ack_reminder_days !== '') {
      days = Number(b.ack_reminder_days);
      if (!Number.isInteger(days) || days < 1 || days > 30) {
        return NextResponse.json({ error: 'Reminder time must be a whole number of business days from 1 to 30.' }, { status: 422 });
      }
      const list = String(b.ack_reminder_cc ?? '').split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
      const bad = list.find((e) => !EMAIL.test(e));
      if (bad) return NextResponse.json({ error: `"${bad}" is not a valid email address.` }, { status: 422 });
      cc = list.length ? list.join(', ') : null;
    }

    // Partial upsert: only the ack columns change, the file-name and SFTP settings are untouched.
    const { error } = await supabase
      .from('supplier_transmission_settings')
      .upsert({
        tenant_id: tenantId,
        supplier_id: id,
        ack_required: required,
        ack_reminder_days: days,
        ack_reminder_cc: cc,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'supplier_id' });
    if (error) throw error;

    return NextResponse.json({ success: true, settings: { ack_required: required, ack_reminder_days: days, ack_reminder_cc: cc ?? '' } });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/acknowledgement-settings/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
