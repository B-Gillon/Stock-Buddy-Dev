// A supplier's GS1 info and label-printing choice.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { loadLabelSettings, validPrefix } from '@/lib/sscc';

async function who(request) {
  const supplierId = request.headers.get('x-auth-supplier');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId) return null;
  const { data: sup } = await supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle();
  return sup ? { tenantId: sup.tenant_id, supplierId } : null;
}

export async function GET(request) {
  const w = await who(request);
  if (!w) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await loadLabelSettings(w.tenantId, w.supplierId));
}

export async function POST(request) {
  const w = await who(request);
  if (!w) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let b; try { b = await request.json(); } catch { b = {}; }
  const enabled = !!b.enabled;
  const prefix = String(b.companyPrefix ?? '').replace(/\s+/g, '');
  const ext = Number(b.extensionDigit);
  const printMode = b.printMode === 'end' ? 'end' : 'each_carton';
  if (enabled && !validPrefix(prefix)) return NextResponse.json({ ok: false, error: 'Enter your GS1 company prefix (7 to 10 digits).' }, { status: 400 });
  if (!Number.isInteger(ext) || ext < 0 || ext > 9) return NextResponse.json({ ok: false, error: 'The extension digit must be 0 to 9.' }, { status: 400 });

  const { data: cur } = await supabase.from('supplier_label_settings').select('company_prefix, next_serial')
    .eq('tenant_id', w.tenantId).eq('supplier_id', w.supplierId).maybeSingle();
  const row = {
    tenant_id: w.tenantId, supplier_id: w.supplierId, enabled,
    company_prefix: prefix || null, extension_digit: ext, print_mode: printMode, updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('supplier_label_settings').upsert(row, { onConflict: 'tenant_id,supplier_id' });
  if (error) return NextResponse.json({ ok: false, error: 'Could not save. Please try again.' }, { status: 500 });
  return NextResponse.json({ ok: true, ...(await loadLabelSettings(w.tenantId, w.supplierId)), prefixChanged: !!cur && cur.company_prefix !== (prefix || null) });
}
