// /src/lib/transmissionSettings.js
// Per-supplier file naming + SFTP settings. Server-side only.
import { supabase } from '@/lib/supabaseClient';
import { decryptSecret } from '@/lib/secretBox';
import { DEFAULT_FILE_NAME_PATTERN } from '@/lib/poFileName';

/**
 * Returns the supplier's settings row (or defaults when none exists).
 * Secrets stay encrypted unless withSecrets is true.
 */
export async function getTransmissionSettings(supplierId, { withSecrets = false } = {}) {
  const { data } = await supabase
    .from('supplier_transmission_settings')
    .select('*')
    .eq('supplier_id', supplierId)
    .maybeSingle();

  const row = data ?? {
    file_name_pattern: DEFAULT_FILE_NAME_PATTERN,
    sftp_enabled: false, sftp_port: 22,
    sftp_send_pdf: true, sftp_send_csv: true,
  };

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

export function isSftpReady(s) {
  return !!(s?.sftp_enabled && s.sftp_host && s.sftp_username && (s.has_password || s.has_private_key));
}
