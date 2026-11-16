// Retailer-side API for the Shipment Settings (which shipment/carton fields suppliers see and must fill in)
import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenants';
import { loadShipmentConfig, saveShipmentConfig } from '@/lib/shipmentSettings';
import { logError } from '@/lib/logError';

const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

export async function GET(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    return NextResponse.json({ config: await loadShipmentConfig(tenantId) });
  } catch (err) {
    await logError({ source: 'api/shipment-settings/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const body = await request.json();
    return NextResponse.json({ config: await saveShipmentConfig(tenantId, body?.config) });
  } catch (err) {
    await logError({ source: 'api/shipment-settings/PUT', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
