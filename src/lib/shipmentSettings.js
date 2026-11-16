// /src/lib/shipmentSettings.js — the retailer's shipment field settings (server only)
import { supabase } from '@/lib/supabaseClient';
import { normalizeConfig } from '@/lib/shipmentFields';

export async function loadShipmentConfig(tenantId) {
  const { data } = await supabase.from('shipment_field_settings').select('config').eq('tenant_id', tenantId).maybeSingle();
  return normalizeConfig(data?.config);
}

export async function saveShipmentConfig(tenantId, raw) {
  const config = normalizeConfig(raw);
  const { error } = await supabase.from('shipment_field_settings')
    .upsert({ tenant_id: tenantId, config, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
  if (error) throw error;
  return config;
}
