// GS1 SSCC-18: extension digit + GS1 company prefix + serial reference (17 digits) + mod-10 check digit.
import { supabase } from '@/lib/supabaseClient';

export function checkDigit(data17) {
  let sum = 0;
  for (let i = 0; i < data17.length; i++) {
    sum += Number(data17[data17.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export const validPrefix = (p) => /^\d{7,10}$/.test(String(p ?? ''));

export function buildSscc(extension, prefix, serial) {
  const width = 16 - prefix.length;
  const s = String(serial);
  if (s.length > width) throw new Error('This GS1 company prefix has run out of serial numbers.');
  const data = `${extension}${prefix}${s.padStart(width, '0')}`;
  return data + checkDigit(data);
}

export const validSscc = (v) => /^\d{18}$/.test(v) && checkDigit(v.slice(0, 17)) === Number(v[17]);

export async function loadLabelSettings(tenantId, supplierId) {
  const { data: sup } = await supabase.from('suppliers').select('allow_carton_labels').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  const allowed = !!sup?.allow_carton_labels;
  const { data } = await supabase.from('supplier_label_settings')
    .select('enabled, company_prefix, extension_digit, print_mode, next_serial')
    .eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  return {
    allowed,
    enabled: allowed && !!data?.enabled && validPrefix(data?.company_prefix),
    companyPrefix: data?.company_prefix ?? '',
    extensionDigit: data?.extension_digit ?? 0,
    printMode: data?.print_mode ?? 'each_carton',
    wantsEnabled: !!data?.enabled,
    nextSerial: Number(data?.next_serial ?? 0),
  };
}

/** Reserves the next SSCC for a carton on one of this supplier's POs. */
export async function reserveSscc({ tenantId, supplierId, poId, cartonNo }) {
  const settings = await loadLabelSettings(tenantId, supplierId);
  if (!settings.enabled) throw new Error('Label generation is not turned on.');
  const { data: serial, error } = await supabase.rpc('next_sscc_serial', { p_tenant: tenantId, p_supplier: supplierId });
  if (error || serial == null) throw new Error('Could not reserve a serial number.');
  const sscc = buildSscc(settings.extensionDigit, settings.companyPrefix, serial);
  const { error: insErr } = await supabase.from('supplier_ssccs')
    .insert({ tenant_id: tenantId, supplier_id: supplierId, sscc, po_id: poId, carton_no: cartonNo });
  if (insErr) throw new Error('Could not save the SSCC. Please try again.');
  return sscc;
}
