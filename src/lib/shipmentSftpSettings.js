// /src/lib/shipmentSftpSettings.js
// Per-supplier SFTP Shipments settings (Suppliers -> Shipping tab). Server-side only.
import { supabase } from '@/lib/supabaseClient';
import { decryptSecret } from '@/lib/secretBox';

/** The supplier's settings row (or defaults). Secrets stay encrypted unless withSecrets is true. */
export async function getShipmentSftpSettings(supplierId, { withSecrets = false } = {}) {
  const { data } = await supabase.from('supplier_shipment_sftp_settings').select('*').eq('supplier_id', supplierId).maybeSingle();
  const row = data ?? { sftp_enabled: false, sftp_port: 22 };
  const out = { ...row };
  if (withSecrets) {
    out.sftp_password    = row.sftp_password_enc    ? decryptSecret(row.sftp_password_enc)    : null;
    out.sftp_private_key = row.sftp_private_key_enc ? decryptSecret(row.sftp_private_key_enc) : null;
  }
  delete out.sftp_password_enc;
  delete out.sftp_private_key_enc;
  out.has_password    = !!row.sftp_password_enc;
  out.has_private_key = !!row.sftp_private_key_enc;
  return out;
}
