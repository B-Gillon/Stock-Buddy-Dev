// /src/app/api/purchase-orders/[id]/sftp-status/route.js
// Checks the supplier's SFTP site for the files we delivered for this PO and records whether
// they were retrieved / are gone (shown in the PO's History).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { getTransmissionSettings, isSftpReady } from '@/lib/transmissionSettings';
import { refreshSftpStatus } from '@/lib/sftp';

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id: poId } = await params;

    const { data: po } = await supabase
      .from('purchase_orders').select('id, supplier_id').eq('id', poId).eq('tenant_id', tenantId).maybeSingle();
    if (!po) return NextResponse.json({ success: false, error: 'PO not found' }, { status: 404 });

    const settings = await getTransmissionSettings(po.supplier_id, { withSecrets: true });
    if (!isSftpReady({ ...settings, sftp_enabled: true })) {
      return NextResponse.json({ success: true, checked: 0, retrieved: 0, deleted: 0 });
    }

    try {
      const result = await refreshSftpStatus({ poId, tenantId, settings });
      return NextResponse.json({ success: true, ...result });
    } catch (err) {
      // Could not reach the SFTP site right now; nothing changed
      return NextResponse.json({ success: false, error: err.message });
    }
  } catch (err) {
    await logError({ source: 'api/purchase-orders/[id]/sftp-status/POST', error: err, tenantId });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
