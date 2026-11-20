// Temporary manual trigger: picks up this supplier's shipment files from their SFTP site now.
import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { pickupShipFiles } from '@/lib/shipFilePickup';
import { supabase } from '@/lib/supabaseClient';

export const maxDuration = 60;

export async function POST(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    return NextResponse.json(await pickupShipFiles({ tenantId, supplierId: id }));
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/pickup/POST', error: err, tenantId });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Recent pickups for this supplier (newest first)
export async function GET(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const { data } = await supabase.from('ship_file_pickups').select('id, file_name, status, message, po_numbers, shipments_created, picked_up_at')
      .eq('tenant_id', tenantId).eq('supplier_id', id).order('picked_up_at', { ascending: false }).limit(10);
    return NextResponse.json({ pickups: data ?? [] });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/pickup/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
