// Copies the connection (host, port, username, password / key, pinned host key) from the supplier's
// SFTP Delivery settings into SFTP Shipments. Done server-side so secrets never reach the browser.
// Pickup folder, prefix and the Enabled flag are left as they are.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

export async function POST(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const { data: sup } = await supabase.from('suppliers').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!sup) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const { data: src } = await supabase.from('supplier_transmission_settings').select('*').eq('supplier_id', id).maybeSingle();
    if (!src?.sftp_host || !src?.sftp_username || (!src.sftp_password_enc && !src.sftp_private_key_enc)) {
      return NextResponse.json({ error: 'SFTP Delivery is not set up for this supplier (Print/Export tab), so there is nothing to copy.' }, { status: 422 });
    }

    const { data: cur } = await supabase.from('supplier_shipment_sftp_settings').select('*').eq('supplier_id', id).maybeSingle();
    const row = {
      tenant_id: tenantId, supplier_id: id,
      sftp_enabled: cur?.sftp_enabled ?? false, sftp_folder: cur?.sftp_folder ?? null, sftp_pickup_prefix: cur?.sftp_pickup_prefix ?? null,
      sftp_host: src.sftp_host, sftp_port: src.sftp_port ?? 22, sftp_username: src.sftp_username,
      sftp_password_enc: src.sftp_password_enc ?? null, sftp_private_key_enc: src.sftp_private_key_enc ?? null,
      sftp_host_fingerprint: src.sftp_host_fingerprint ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('supplier_shipment_sftp_settings').upsert(row, { onConflict: 'supplier_id' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/copy-from-export/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
