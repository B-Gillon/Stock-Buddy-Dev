// /src/lib/shipmentImport.js
// Reads a supplier's shipment file using their saved mapping, checks every row, and works out the
// shipments that would be created. Used by the manual upload (recap screen) and, later, SFTP pickup.
// Server-side only.
import { supabase } from '@/lib/supabaseClient';
import { loadShipmentConfig } from '@/lib/shipmentSettings';
import { validateShipment, resolveToday } from '@/lib/shipmentFields';
import { shippedByLine } from '@/lib/shipments';
import { createShipment } from '@/lib/createShipment';
import { findUsedLots } from '@/lib/lotCheck';
import { MAP_FIELDS, DELIMITERS, parseDelimited, autoMatch } from '@/lib/shipmentMapFields';

const MAX_ROWS = 5000;
const SHIPPABLE = ['waiting_to_ship', 'partially_shipped', 'partially_received'];
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const low = (s) => String(s ?? '').trim().toLowerCase();

/** Accepts 2026-11-18, 2026/11/18, 11/18/2026 and 11-18-2026. Returns an ISO date or null. */
export function normalizeDate(v) {
  const t = String(v ?? '').trim();
  let y, m, d, hit;
  if ((hit = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t))) [, y, m, d] = hit;
  else if ((hit = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t))) [, m, d, y] = hit;
  else return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso;
}

// Labels used in validateShipment messages -> the file field they come from
const LABEL_TO_FIELD = {
  'SSCC Case Number': 'supplier_carton_id', 'Lot Number': 'lot_number', 'Expire Date': 'expiration_date', 'Expiration Date': 'expiration_date',
  'Carton Tracking Number': 'carton_tracking', 'PRO/Tracking#': 'tracking_number', 'Packing Slip Number': 'packing_slip_number',
  'Supplier Shipment Reference': 'supplier_reference', 'Ship Date': 'ship_date',
};

/**
 * @returns {Promise<object>} { ok, fatal?, columns, rows, errors, groups, totals, payloads }
 *  - rows: [{ n, v:{field:value}, e:{field:message} }]  (n = row number in the file)
 *  - payloads: what createShipment needs per shipment (server use only)
 */
export async function buildImportPlan({ tenantId, supplierId, fileText, clientDate, maxErrors = 300 }) {
  const fatal = (message) => ({ ok: false, fatal: message, columns: [], rows: [], errors: [], groups: [], totals: { shipments: 0, cartons: 0, units: 0 }, payloads: [] });

  const { data: mapRow } = await supabase.from('supplier_shipment_maps').select('config')
    .eq('tenant_id', tenantId).eq('supplier_id', supplierId).maybeSingle();
  const cfg = mapRow?.config;
  const map = cfg?.map ?? {};
  const mappedCol = (id) => (Number.isInteger(map[id]?.col) ? map[id].col : null);
  const hasIdentifier = ['sku', 'supplier_sku', 'barcode'].some((id) => mappedCol(id) != null);
  if (!cfg || mappedCol('po_number') == null || mappedCol('ship_date') == null || mappedCol('ship_qty') == null || !hasIdentifier) {
    return fatal('The shipment file mapping for your account is not set up yet. Please contact the retailer.');
  }

  const delim = (DELIMITERS.find((d) => d.id === cfg.delimiter) ?? DELIMITERS[0]).char;
  const all = parseDelimited(fileText, delim, MAX_ROWS + 2);
  if (all.length === 0) return fatal('The file is empty.');
  if (all.length > MAX_ROWS + 1) return fatal(`The file has more than ${MAX_ROWS.toLocaleString()} rows. Please split it into smaller files.`);

  // The header setting is the rule for the file: a file that disagrees is rejected, never guessed at
  let dataRows = all;
  if (cfg.hasHeader !== false) {
    const sample = parseDelimited(cfg.sampleText ?? '', delim, 1)[0] ?? [];
    for (const f of MAP_FIELDS) {
      const c = mappedCol(f.id);
      if (c == null || sample[c] == null) continue;
      if (norm(all[0][c]) !== norm(sample[c])) {
        return fatal(`The first row of the file doesn't match the saved mapping: expected the column "${String(sample[c]).trim()}" in position ${c + 1} but found "${String(all[0][c] ?? '').trim()}". Check that this is the right file and that it still has its header row.`);
      }
    }
    dataRows = all.slice(1);
  } else if (Object.keys(autoMatch(all[0])).length >= 2) {
    return fatal('The first row of this file looks like a header record, but the saved mapping says there is none. Please contact the retailer.');
  }
  if (dataRows.length === 0) return fatal('The file has no shipment rows.');

  const columns = MAP_FIELDS.filter((f) => mappedCol(f.id) != null).map((f) => ({ id: f.id, label: f.label }));
  const firstRowNo = cfg.hasHeader !== false ? 2 : 1;
  const rows = dataRows.map((r, i) => {
    const v = {};
    for (const f of MAP_FIELDS) { const c = mappedCol(f.id); if (c != null) v[f.id] = String(r[c] ?? '').trim(); }
    return { n: i + firstRowNo, v, e: {} };
  });
  const errors = [];
  const err = (row, field, message) => { if (!row.e[field]) { row.e[field] = message; errors.push({ n: row.n, field, message }); } };

  // ── Row-level checks ────────────────────────────────────────────────────────
  for (const row of rows) {
    const { v } = row;
    if (!v.po_number) err(row, 'po_number', 'PO Number is required.');
    if (!v.ship_date) err(row, 'ship_date', 'Ship Date is required.');
    else if (!(row.date = normalizeDate(v.ship_date))) err(row, 'ship_date', 'Not a valid date. Use YYYY-MM-DD or MM/DD/YYYY.');
    if (!/^\d+$/.test(v.ship_qty ?? '') || Number(v.ship_qty) <= 0) err(row, 'ship_qty', 'Ship Qty must be a whole number above 0.');
    else row.qty = Number(v.ship_qty);
    if (!['sku', 'supplier_sku', 'barcode'].some((id) => v[id])) {
      err(row, ['sku', 'supplier_sku', 'barcode'].find((id) => mappedCol(id) != null), 'Item is blank. Include a SKU, Supplier SKU or Barcode.');
    }
    if (v.expiration_date) {
      if (!(row.exp = normalizeDate(v.expiration_date))) err(row, 'expiration_date', 'Not a valid date. Use YYYY-MM-DD or MM/DD/YYYY.');
    }
  }

  // ── POs and their lines ─────────────────────────────────────────────────────
  const poNums = [...new Set(rows.map((r) => r.v.po_number).filter(Boolean))];
  const { data: pos } = poNums.length
    ? await supabase.from('purchase_orders').select('id, po_number, status').eq('tenant_id', tenantId).eq('supplier_id', supplierId).in('po_number', poNums)
    : { data: [] };
  const poByNum = new Map((pos ?? []).map((p) => [low(p.po_number), p]));
  const { data: lineRows } = (pos ?? []).length
    ? await supabase.from('purchase_order_lines').select('id, purchase_order_id, sku, title, variant_id, supplier_variant_id, order_qty_units').in('purchase_order_id', pos.map((p) => p.id))
    : { data: [] };
  const variantIds = [...new Set((lineRows ?? []).map((l) => l.variant_id).filter(Boolean))];
  const svIds = [...new Set((lineRows ?? []).map((l) => l.supplier_variant_id).filter(Boolean))];
  const [{ data: variants }, { data: svs }] = await Promise.all([
    variantIds.length ? supabase.from('variants').select('id, barcode').in('id', variantIds) : { data: [] },
    svIds.length ? supabase.from('supplier_variants').select('id, supplier_sku, supplier_barcode').in('id', svIds) : { data: [] },
  ]);
  const vById = new Map((variants ?? []).map((x) => [x.id, x]));
  const svById = new Map((svs ?? []).map((x) => [x.id, x]));
  const linesByPo = new Map();
  for (const l of lineRows ?? []) {
    const sv = svById.get(l.supplier_variant_id); const va = vById.get(l.variant_id);
    const rec = { ...l, keys: { sku: [low(l.sku)], supplier_sku: [low(sv?.supplier_sku)], barcode: [low(va?.barcode), low(sv?.supplier_barcode)] } };
    if (!linesByPo.has(l.purchase_order_id)) linesByPo.set(l.purchase_order_id, []);
    linesByPo.get(l.purchase_order_id).push(rec);
  }
  const lineById = new Map((lineRows ?? []).map((l) => [l.id, l]));
  const shipped = await shippedByLine([...lineById.keys()]);

  for (const row of rows) {
    if (!row.v.po_number) continue;
    const po = poByNum.get(low(row.v.po_number));
    if (!po) { err(row, 'po_number', 'No purchase order with this number was found for your account.'); continue; }
    if (!SHIPPABLE.includes(po.status)) {
      err(row, 'po_number', po.status === 'pending_acknowledgement' ? 'Acknowledge this purchase order before shipping.' : 'This purchase order can’t be shipped.');
      continue;
    }
    row.po = po;
    // Every identifier in the row must find the same line on this PO
    let lineId = null;
    for (const id of ['sku', 'supplier_sku', 'barcode']) {
      const val = low(row.v[id]);
      if (!val) continue;
      const hits = (linesByPo.get(po.id) ?? []).filter((l) => l.keys[id].includes(val));
      const label = MAP_FIELDS.find((f) => f.id === id).label;
      if (hits.length === 0) { err(row, id, `${label} "${row.v[id]}" is not on ${po.po_number}.`); lineId = null; row.badItem = true; break; }
      if (hits.length > 1) { err(row, id, `${label} "${row.v[id]}" matches more than one line on ${po.po_number}.`); lineId = null; row.badItem = true; break; }
      if (lineId && lineId !== hits[0].id) { err(row, id, `${label} "${row.v[id]}" is a different item than the other identifiers in this row.`); lineId = null; row.badItem = true; break; }
      lineId = hits[0].id;
    }
    if (lineId) row.lineId = lineId;
  }

  // ── Group into shipments (PO + ship date) and cartons (carton ID) ───────────
  const groups = new Map();
  for (const row of rows) {
    if (!row.po || !row.date) continue;
    const key = `${row.po.id}|${row.date}`;
    if (!groups.has(key)) groups.set(key, { po: row.po, date: row.date, rows: [], cartons: new Map() });
    const g = groups.get(key);
    g.rows.push(row);
    const ck = row.v.supplier_carton_id || '';
    if (!g.cartons.has(ck)) g.cartons.set(ck, { id: ck, rows: [] });
    g.cartons.get(ck).rows.push(row);
  }

  // Values that must agree across a shipment / a carton
  const conflicts = (list, field, msg) => {
    const first = list[0]?.v[field] ?? '';
    for (const r of list) if ((r.v[field] ?? '') !== first && field in r.v) err(r, field, msg);
  };
  const cartonOwner = new Map(); // carton ID -> group key (a carton can't be on two shipments)
  for (const [key, g] of groups) {
    for (const f of ['tracking_number', 'supplier_reference', 'packing_slip_number']) {
      conflicts(g.rows, f, 'Must be the same on every row of this shipment.');
    }
    const some = g.rows.some((r) => r.v.supplier_carton_id), none = g.rows.some((r) => !r.v.supplier_carton_id);
    if (some && none) for (const r of g.rows) if (!r.v.supplier_carton_id) err(r, 'supplier_carton_id', 'Carton ID is blank. Every row of this shipment needs one.');
    for (const c of g.cartons.values()) {
      conflicts(c.rows, 'carton_tracking', 'Must be the same on every row of this carton.');
      // Lot and expire date belong to each item: one item can have only one of each per carton
      const byItem = new Map();
      for (const r of c.rows) if (r.lineId) { if (!byItem.has(r.lineId)) byItem.set(r.lineId, []); byItem.get(r.lineId).push(r); }
      for (const rs of byItem.values()) {
        conflicts(rs, 'lot_number', 'An item can have only one lot per carton. Use a separate carton for a second lot.');
        conflicts(rs, 'expiration_date', 'An item can have only one expire date per carton.');
      }
      if (c.id) {
        const owner = cartonOwner.get(c.id.toLowerCase());
        if (owner && owner !== key) for (const r of c.rows) err(r, 'supplier_carton_id', `Carton ID ${c.id} is used on more than one shipment in this file.`);
        else cartonOwner.set(c.id.toLowerCase(), key);
      }
    }
  }
  // A lot number can only be used once: not twice in this file on different shipments, and not on any earlier shipment
  const lotOwner = new Map();
  for (const [key, g] of groups) {
    for (const r of g.rows) {
      const k = low(r.v.lot_number);
      if (!k) continue;
      const owner = lotOwner.get(k);
      if (owner && owner !== key) err(r, 'lot_number', `Lot ${r.v.lot_number} is used on more than one shipment in this file. A lot number can only be used once.`);
      else lotOwner.set(k, key);
    }
  }
  const lotRows = rows.filter((r) => r.v.lot_number);
  if (lotRows.length) {
    const usedLots = new Set((await findUsedLots({ tenantId, supplierId, lots: lotRows.map((r) => r.v.lot_number) })).map(low));
    for (const r of lotRows) if (usedLots.has(low(r.v.lot_number))) err(r, 'lot_number', `Lot ${r.v.lot_number} was already used on an earlier shipment. A lot number can only be used once.`);
  }

  // Carton IDs already used on an earlier shipment
  const ids = [...new Set(rows.map((r) => r.v.supplier_carton_id).filter(Boolean))];
  if (ids.length) {
    const { data: used } = await supabase.from('shipment_cartons').select('supplier_carton_id').eq('tenant_id', tenantId).in('supplier_carton_id', ids);
    const usedSet = new Set((used ?? []).map((u) => String(u.supplier_carton_id).toLowerCase()));
    for (const r of rows) if (r.v.supplier_carton_id && usedSet.has(r.v.supplier_carton_id.toLowerCase())) err(r, 'supplier_carton_id', `Carton ID ${r.v.supplier_carton_id} was already used on an earlier shipment.`);
  }

  // Quantities against what is left to ship (across the whole file)
  const perLine = new Map();
  for (const r of rows) if (r.lineId && r.qty) perLine.set(r.lineId, (perLine.get(r.lineId) ?? 0) + r.qty);
  for (const [lineId, total] of perLine) {
    const l = lineById.get(lineId);
    const left = (l.order_qty_units ?? 0) - (shipped[lineId] ?? 0);
    if (total > left) for (const r of rows) if (r.lineId === lineId) err(r, 'ship_qty', `The file ships ${total.toLocaleString()} of this item, but only ${Math.max(0, left).toLocaleString()} are left to ship.`);
  }

  // ── The retailer's own field rules (SSCC format, lot format, required fields …) ──
  const config = await loadShipmentConfig(tenantId, supplierId);
  const out = [], payloads = [];
  for (const g of groups.values()) {
    const first = g.rows[0].v;
    const shipment = { today: resolveToday(clientDate), ship_date: g.date, tracking_number: first.tracking_number, supplier_reference: first.supplier_reference, packing_slip_number: first.packing_slip_number };
    const cartons = [...g.cartons.values()].map((c) => {
      const byLine = new Map();
      for (const r of c.rows) {
        if (!(r.lineId && r.qty)) continue;
        const cur = byLine.get(r.lineId) ?? { qty: 0, sku: lineById.get(r.lineId)?.sku, lot_number: r.v.lot_number ?? '', expiration_date: r.exp ?? '' };
        cur.qty += r.qty; byLine.set(r.lineId, cur);
      }
      const f0 = c.rows[0].v;
      return {
        supplier_carton_id: c.id, tracking_number: f0.carton_tracking, _rows: c.rows,
        lines: [...byLine].map(([lineId, x]) => ({ lineId, ...x })),
      };
    });
    for (const msg of validateShipment(config, shipment, cartons)) {
      const m = /^Carton (\d+), ([^:]+):/.exec(msg);
      const field = m ? LABEL_TO_FIELD[m[2]] : LABEL_TO_FIELD[msg.split(':')[0]];
      const target = m ? cartons[Number(m[1]) - 1]?._rows ?? g.rows : g.rows;
      // A row whose item couldn't be identified has no usable quantity: that is the only problem to report, not a knock-on "no quantity" error
      if (/enter a quantity for at least one item/.test(msg) && target.some((r) => r.badItem)) continue;
      const text = msg.replace(/^Carton \d+, [^:]+:\s*/, '').replace(/^[^:]+:\s*/, (x) => (m ? '' : x));
      for (const r of target) err(r, field && field in r.v ? field : Object.keys(r.v)[0], text.charAt(0).toUpperCase() + text.slice(1));
    }
    const units = g.rows.reduce((t, r) => t + (r.qty ?? 0), 0);
    out.push({
      poNumber: g.po.po_number, shipDate: g.date, tracking: first.tracking_number || null, reference: first.supplier_reference || null,
      packingSlip: first.packing_slip_number || null, units,
      cartons: cartons.map((c, i) => ({
        no: i + 1, cartonId: c.supplier_carton_id || null, tracking: c.tracking_number || null,
        units: c.lines.reduce((t, x) => t + x.qty, 0),
        items: c.lines.map((x) => ({ sku: lineById.get(x.lineId)?.sku ?? '', title: lineById.get(x.lineId)?.title ?? '', qty: x.qty, lot: x.lot_number || null, exp: x.expiration_date || null })),
      })),
    });
    payloads.push({ poId: g.po.id, shipment, cartons: cartons.map(({ _rows, ...rest }) => rest) });
  }
  out.sort((a, b) => a.poNumber.localeCompare(b.poNumber) || a.shipDate.localeCompare(b.shipDate));

  const totals = { shipments: out.length, cartons: out.reduce((t, g) => t + g.cartons.length, 0), units: out.reduce((t, g) => t + g.units, 0) };
  return {
    ok: errors.length === 0 && out.length > 0, columns, errors: errors.slice(0, maxErrors), errorCount: errors.length,
    rows: rows.slice(0, 500).map(({ n, v, e }) => ({ n, v, e })), rowCount: rows.length, groups: out, totals, payloads,
  };
}

/** Creates every shipment in a clean plan, one after another. Stops at the first failure. */
export async function commitImportPlan({ tenantId, supplierId, userName, plan, clientDate, logActivity = true }) {
  const created = [];
  for (const p of plan.payloads) {
    const r = await createShipment({ tenantId, supplierId, userName, poId: p.poId, shipment: p.shipment, cartons: p.cartons, clientDate, logActivity });
    if (!r.ok) return { ok: false, created, error: r.error };
    created.push(r.shipmentNumber);
  }
  return { ok: true, created };
}
