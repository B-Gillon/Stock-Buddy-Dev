// /src/lib/auth/tokens.js
// One-time links for setting or resetting a password. The link carries a random token; only its
// SHA-256 hash is stored, so a database leak doesn't expose usable links.
import { createHash, randomBytes } from 'node:crypto';
import { supabase } from '@/lib/supabaseClient';

const hash = (raw) => createHash('sha256').update(raw).digest('hex');

export const TOKEN_TTL_HOURS = { set_password: 24 * 7, reset_password: 1 };

/** Creates a token (replacing any unused ones of the same kind) and returns the raw value for the link. */
export async function createAuthToken(userId, purpose) {
  await supabase.from('auth_tokens').delete().eq('user_id', userId).eq('purpose', purpose).is('used_at', null);
  const raw = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS[purpose] * 3600 * 1000).toISOString();
  const { error } = await supabase.from('auth_tokens')
    .insert({ user_id: userId, token_hash: hash(raw), purpose, expires_at: expires });
  if (error) throw error;
  return raw;
}

/** Looks at a token without using it. Returns the row, or null if unknown, used or expired. */
export async function peekAuthToken(raw) {
  if (!raw || typeof raw !== 'string' || raw.length > 200) return null;
  const { data } = await supabase.from('auth_tokens').select('*').eq('token_hash', hash(raw)).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at) < new Date()) return null;
  return data;
}

/** Uses a token exactly once. Returns the row, or null if it can't be used. */
export async function consumeAuthToken(raw) {
  const row = await peekAuthToken(raw);
  if (!row) return null;
  const { data } = await supabase.from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id).is('used_at', null)
    .select('*').maybeSingle();
  return data ?? null;
}
