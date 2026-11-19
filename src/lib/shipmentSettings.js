// /src/lib/shipmentSettings.js — the retailer's shipment field settings (server only)
import { supabase } from '@/lib/supabaseClient';
import { normalizeConfig, applySupplierOverrides } from '@/lib/shipmentFields';

// With a supplierId, that supplier's visibility overrides (Suppliers -> Shipping tab) are applied.
export async function loadShipmentConfig(tenantId, supplierId = null) {
  const { data } = await supabase.from('shipment_field_settings').select('config').eq('tenant_id', tenantId).maybeSingle();
  const config = normalizeConfig(data?.config);
  if (!supplierId) return config;
  const { data: sup } = await supabase.from('suppliers').select('shipping_field_overrides').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  return applySupplierOverrides(config, sup?.shipping_field_overrides);
}

export async function saveShipmentConfig(tenantId, raw) {
  const config = normalizeConfig(raw);
  const { error } = await supabase.from('shipment_field_settings')
    .upsert({ tenant_id: tenantId, config, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
  if (error) throw error;
  return config;
}
