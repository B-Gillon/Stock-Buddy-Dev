// /src/lib/poFileName.js
// One file-naming convention per supplier. It applies to every PO file we send or export
// (PDF and CSV); the extension is added automatically.

export const DEFAULT_FILE_NAME_PATTERN = '{po_number}';

export const FILE_NAME_TOKENS = {
  po_number:       'PO number, e.g. PO-20261113-0001',
  supplier_number: 'Supplier number',
  po_date:         'PO date as YYYYMMDD',
  date:            'Date sent as YYYYMMDD (UTC)',
  time:            'Time sent as HHMMSS (UTC)',
  datetime:        'Date and time sent as YYYYMMDD-HHMMSS (UTC)',
};

/**
 * Validates a pattern typed by the user.
 * Returns { ok: true } or { ok: false, error }.
 */
export function validateFileNamePattern(pattern) {
  const p = String(pattern ?? '').trim();
  if (!p) return { ok: false, error: 'File name pattern is required.' };
  if (p.length > 100) return { ok: false, error: 'File name pattern must be 100 characters or fewer.' };

  const tokens = [...p.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  const unknown = tokens.filter((t) => !(t in FILE_NAME_TOKENS));
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown placeholder {${unknown[0]}}. Allowed: ${Object.keys(FILE_NAME_TOKENS).map((t) => `{${t}}`).join(', ')}.` };
  }

  const literals = p.replace(/\{[^}]*\}/g, '');
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(literals) || /[{}]/.test(literals)) {
    return { ok: false, error: 'File names cannot contain / \\ : * ? " < > | or stray braces.' };
  }
  return { ok: true };
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Builds the base file name (no extension) for a PO.
 * Never adds a "PO-" prefix: {po_number} is the PO number exactly as stored.
 */
export function buildPOFileBase(pattern, { poNumber, supplierNumber, poDate, now = new Date() }) {
  const p = validateFileNamePattern(pattern).ok ? String(pattern).trim() : DEFAULT_FILE_NAME_PATTERN;

  const ymd = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const hms = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const poYmd = String(poDate ?? '').substring(0, 10).replace(/-/g, '');

  const values = {
    po_number:       poNumber ?? '',
    supplier_number: supplierNumber ?? '',
    po_date:         poYmd,
    date:            ymd,
    time:            hms,
    datetime:        `${ymd}-${hms}`,
  };

  const raw = p.replace(/\{([^}]*)\}/g, (_, token) => values[token] ?? '');
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, 120);
  return safe || String(poNumber ?? 'PO').replace(/[^A-Za-z0-9._-]+/g, '_');
}
