// /src/lib/shipmentFields.js
// The optional shipment and carton fields, the retailer's visible/required settings for them,
// and the validation shared by the supplier page (for feedback) and the API (for enforcement).
//
// Always required, not configurable: the automatic carton number, at least one item with a positive
// quantity in every carton, and the ship date.

// A lot number must fit a GS1-128 barcode (AI 10): up to 20 characters from the GS1 set, no spaces or parentheses.
export const LOT_RE = /^[A-Za-z0-9!"%&'*+,\-./:;<=>?_]{1,20}$/;

// SSCC: 18 digits whose last digit is the GS1 mod-10 check digit. A scanner's 20-digit form ("00" + SSCC) is accepted and stored as 18.
export function normalizeSscc(v) {
  const d = String(v ?? '').replace(/[\s-]+/g, '');
  return /^00\d{18}$/.test(d) ? d.slice(2) : d;
}
export function isValidSscc(v) {
  const d = normalizeSscc(v);
  if (!/^\d{18}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(d[16 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(d[17]);
}

export const WEIGHT_UNITS = ['lb', 'kg'];
export const DIM_UNITS = ['in', 'cm'];

// kind: text | notes | date | int | weight | dims
export const CARTON_FIELDS = [
  { id: 'supplier_carton_id', label: 'SSCC Case Number', kind: 'text', hiddenByDefault: false },
  { id: 'sscc',               label: 'SSCC',               kind: 'sscc', hiddenByDefault: true },
  { id: 'carton_tracking',    label: 'Carton Tracking Number', kind: 'text', hiddenByDefault: false },
  { id: 'weight',             label: 'Weight (with unit)', kind: 'weight', hiddenByDefault: true },
  { id: 'dimensions',         label: 'Dimensions: Length × Width × Height (with unit)', kind: 'dims', hiddenByDefault: true },
  { id: 'pallet_id',          label: 'Pallet ID',          kind: 'text', hiddenByDefault: true },
  { id: 'lot_number',         label: 'Lot Number',         kind: 'text', hiddenByDefault: true },
  { id: 'expiration_date',    label: 'Expiration Date',    kind: 'date', hiddenByDefault: true },
];

export const SHIPMENT_FIELDS = [
  { id: 'ship_method',         label: 'Ship Method',                     kind: 'text', hiddenByDefault: false },
  { id: 'tracking_number',     label: 'PRO/Tracking Number',  kind: 'text', hiddenByDefault: false },
  { id: 'bol_number',          label: 'BOL Number',                      kind: 'text', hiddenByDefault: false },
  { id: 'est_delivery_date',   label: 'Estimated Delivery Date',         kind: 'date', hiddenByDefault: false },
  { id: 'supplier_reference',  label: 'Supplier Shipment Reference',     kind: 'text', hiddenByDefault: false },
  { id: 'packing_slip_number', label: 'Packing Slip Number',             kind: 'text', hiddenByDefault: false },
  { id: 'total_pallets',       label: 'Total Pallets',                   kind: 'int',  hiddenByDefault: true },
  { id: 'total_weight',        label: 'Total Shipment Weight (with unit)', kind: 'weight', hiddenByDefault: true },
  { id: 'shipment_notes',      label: 'Shipment Notes',                  kind: 'notes', hiddenByDefault: false },
];

const defaults = (defs) => Object.fromEntries(defs.map((d) => [d.id, { visible: !d.hiddenByDefault, required: false }]));

/** Fills gaps with defaults and makes sure a hidden field is never required. */
export function normalizeConfig(raw) {
  const out = { carton: defaults(CARTON_FIELDS), shipment: defaults(SHIPMENT_FIELDS) };
  for (const section of ['carton', 'shipment']) {
    for (const id of Object.keys(out[section])) {
      const r = raw?.[section]?.[id];
      if (r && typeof r === 'object') {
        if (typeof r.visible === 'boolean') out[section][id].visible = r.visible;
        if (typeof r.required === 'boolean') out[section][id].required = r.required;
      }
      if (!out[section][id].visible) out[section][id].required = false;
    }
  }
  return out;
}

const blank = (v) => v == null || String(v).trim() === '';
const num = (v) => (blank(v) ? null : Number(v));
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

function checkField(def, cfg, get, label, errors) {
  if (!cfg?.visible) return;
  const req = !!cfg.required;
  const need = (cond, msg) => { if (!cond) errors.push(`${label}: ${msg}`); };
  switch (def.kind) {
    case 'weight': {
      const v = get('value'); const u = get('unit');
      if (blank(v)) { need(!req, 'required.'); return; }
      need(Number(v) > 0, 'enter a weight above zero.');
      need(WEIGHT_UNITS.includes(u), 'choose a unit.');
      return;
    }
    case 'dims': {
      const vals = ['length', 'width', 'height'].map((k) => get(k));
      const filled = vals.filter((v) => !blank(v)).length;
      if (filled === 0) { need(!req, 'required.'); return; }
      need(filled === 3 && vals.every((v) => Number(v) > 0), 'enter length, width and height (each above zero).');
      need(DIM_UNITS.includes(get('unit')), 'choose a unit.');
      return;
    }
    default: {
      const v = get('value');
      if (blank(v)) { need(!req, 'required.'); return; }
      if (def.kind === 'date') need(isDate(String(v)), 'not a valid date.');
      if (def.kind === 'int') need(/^\d+$/.test(String(v).trim()), 'enter a whole number.');
      if (def.kind === 'sscc') need(isValidSscc(v), 'enter a valid 18-digit SSCC (its last digit is a check digit). A 20-digit value starting with 00 is also accepted.');
      need(String(v).length <= (def.kind === 'notes' ? 1000 : 100), 'too long.');
    }
  }
}

/**
 * @param config  normalized settings
 * @param shipment  { ship_date, ship_method, ..., total_weight, weight_unit, notes }
 * @param cartons   [{ supplier_carton_id, sscc, tracking_number, weight, weight_unit, length, width, height, dim_unit, pallet_id, notes, lines:[{lineId, qty}] }]
 * @returns {string[]} error messages (empty = valid)
 */
export function validateShipment(config, shipment, cartons) {
  const errors = [];
  const s = shipment ?? {};
  if (blank(s.ship_date)) errors.push('Ship Date: required.');
  else if (!isDate(String(s.ship_date))) errors.push('Ship Date: not a valid date.');

  const sget = {
    ship_method: () => ({ value: s.ship_method }),
    tracking_number: () => ({ value: s.tracking_number }), bol_number: () => ({ value: s.bol_number }),
    est_delivery_date: () => ({ value: s.est_delivery_date }), supplier_reference: () => ({ value: s.supplier_reference }),
    packing_slip_number: () => ({ value: s.packing_slip_number }), total_pallets: () => ({ value: s.total_pallets }),
    total_weight: () => ({ value: s.total_weight, unit: s.weight_unit }), shipment_notes: () => ({ value: s.notes }),
  };
  for (const def of SHIPMENT_FIELDS) {
    const g = sget[def.id]();
    checkField(def, config.shipment[def.id], (k) => g[k], def.label.replace(/ \(with unit\)/, ''), errors);
  }
  if (config.shipment.est_delivery_date.visible && isDate(String(s.est_delivery_date ?? '')) && isDate(String(s.ship_date ?? ''))
      && s.est_delivery_date < s.ship_date) {
    errors.push('Estimated Delivery Date: can’t be before the ship date.');
  }

  if (!Array.isArray(cartons) || cartons.length === 0) errors.push('Add at least one carton.');
  (cartons ?? []).forEach((c, i) => {
    const n = `Carton ${i + 1}`;
    const qtys = (c.lines ?? []).map((l) => Number(l.qty) || 0);
    if (qtys.some((q) => q < 0 || !Number.isInteger(q))) errors.push(`${n}: quantities must be whole numbers.`);
    else if (!qtys.some((q) => q > 0)) errors.push(`${n}: enter a quantity for at least one item.`);
    const cget = {
      supplier_carton_id: () => ({ value: c.supplier_carton_id }), sscc: () => ({ value: c.sscc }),
      carton_tracking: () => ({ value: c.tracking_number }), weight: () => ({ value: c.weight, unit: c.weight_unit }),
      dimensions: () => ({ length: c.length, width: c.width, height: c.height, unit: c.dim_unit }),
      pallet_id: () => ({ value: c.pallet_id }),
      lot_number: () => ({ value: c.lot_number }), expiration_date: () => ({ value: c.expiration_date }),
    };
    if (config.carton.lot_number.visible && !blank(c.lot_number) && !LOT_RE.test(String(c.lot_number).trim())) {
      errors.push(`${n}, Lot Number: up to 20 letters, numbers or - . / _ (no spaces).`);
    }
    for (const def of CARTON_FIELDS) {
      const g = cget[def.id]();
      checkField(def, config.carton[def.id], (k) => g[k], `${n}, ${def.label.replace(/ \(with unit\)/, '').replace(/:.*/, '')}`, errors);
    }
  });
  return errors;
}
