// /src/lib/secretBox.js
// Encrypts secrets (e.g. supplier SFTP credentials) before they are stored in the database.
// AES-256-GCM. The key comes from SFTP_ENCRYPTION_KEY if set; otherwise it is derived from
// SHOPIFY_API_SECRET. If that secret is ever rotated, stored credentials must be re-entered.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

function getKey() {
  const explicit = process.env.SFTP_ENCRYPTION_KEY;
  if (explicit) return createHash('sha256').update(explicit).digest();

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error('No encryption key available (set SFTP_ENCRYPTION_KEY).');
  return Buffer.from(hkdfSync('sha256', secret, 'stock-buddy', 'sftp-credentials', 32));
}

export function encryptSecret(plain) {
  if (plain == null || plain === '') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored) {
  if (!stored) return null;
  const [version, iv, tag, data] = String(stored).split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Stored credential has an unknown format.');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
