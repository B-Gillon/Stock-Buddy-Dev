// Preview of the SFTP Delivery connection for "Copy from Export": host, port and username only.
// Nothing is saved here and no secret is returned; the secrets are copied server-side when the user clicks Save.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

export async function GET(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const { data: sup } = await supabase.from('suppliers').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!sup) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    const { data: src } = await supabase.from('supplier_transmission_settings').select('sftp_host, sftp_port, sftp_username, sftp_password_enc, sftp_private_key_enc').eq('supplier_id', id).maybeSingle();
    if (!src?.sftp_host || !src?.sftp_username || (!src.sftp_password_enc && !src.sftp_private_key_enc)) {
      return NextResponse.json({ error: 'SFTP Delivery is not set up for this supplier (Print/Export tab), so there is nothing to copy.' }, { status: 422 });
    }
    return NextResponse.json({ host: src.sftp_host, port: src.sftp_port ?? 22, username: src.sftp_username, has_password: !!src.sftp_password_enc, has_private_key: !!src.sftp_private_key_enc });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/copy-from-export/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
