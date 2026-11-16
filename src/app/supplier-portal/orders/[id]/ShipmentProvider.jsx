'use client';
// "Create Shipment" on the supplier PO screen: line items, shipment details, and carton-level packing.
// The button (top right) and the screen body live in different places, so they share state here.
import { createContext, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/shared/components/ui/Button';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { validateShipment, WEIGHT_UNITS, DIM_UNITS } from '@/lib/shipmentFields';
import { LINE_COLUMN_DEFS } from '@/lib/supplierColumns';

const idValue = (l, id) => (id === 'sku' ? l.sku : id === 'supplier_sku' ? l.supplierSku : l.barcode) || '—';

const Ctx = createContext(null);

export function ShipmentProvider({ children }) {
  const [creating, setCreating] = useState(false);
  return <Ctx.Provider value={{ creating, setCreating }}>{children}</Ctx.Provider>;
}

export function HideWhileCreating({ children }) {
  const { creating } = useContext(Ctx);
  return creating ? null : children;
}

export function CreateShipmentButton({ enabled, hint }) {
  const { creating, setCreating } = useContext(Ctx);
  if (creating) return null;
  return <Button onClick={() => setCreating(true)} disabled={!enabled} title={enabled ? undefined : hint}>Create Shipment</Button>;
}

const input = 'h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm';
const today = () => new Date().toLocaleDateString('en-CA');
const blankCarton = () => ({ f: { weight_unit: 'lb', dim_unit: 'in' }, q: {} });

function Field({ label, required, children, wide }) {
  return (
    <label className={`block text-xs font-medium text-gray-600 ${wide ? 'sm:col-span-2' : ''}`}>
      {label}{required ? <span className="text-red-600"> *</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CartonFields({ cfg, f, set }) {
  const v = (id) => cfg[id].visible; const r = (id) => cfg[id].required;
  const text = (key) => <input className={input} value={f[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} />;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {v('supplier_carton_id') && <Field label="Supplier Carton ID" required={r('supplier_carton_id')}>{text('supplier_carton_id')}</Field>}
      {v('sscc') && <Field label="SSCC" required={r('sscc')}><input className={input} inputMode="numeric" placeholder="18 digits" value={f.sscc ?? ''} onChange={(e) => set({ sscc: e.target.value })} /></Field>}
      {v('carton_tracking') && <Field label="Carton Tracking Number" required={r('carton_tracking')}>{text('tracking_number')}</Field>}
      {v('weight') && (
        <Field label="Weight" required={r('weight')}>
          <div className="flex gap-2">
            <input className={input} type="number" min="0" step="any" value={f.weight ?? ''} onChange={(e) => set({ weight: e.target.value })} />
            <select className={`${input} w-20`} value={f.weight_unit} onChange={(e) => set({ weight_unit: e.target.value })}>{WEIGHT_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
        </Field>
      )}
      {v('dimensions') && (
        <Field label="Length × Width × Height" required={r('dimensions')} wide>
          <div className="flex items-center gap-2">
            {['length', 'width', 'height'].map((k, i) => (
              <span key={k} className="flex items-center gap-2">
                {i > 0 && <span className="text-gray-400">×</span>}
                <input className={`${input} w-20`} type="number" min="0" step="any" placeholder={k[0].toUpperCase() + k.slice(1)} value={f[k] ?? ''} onChange={(e) => set({ [k]: e.target.value })} />
              </span>
            ))}
            <select className={`${input} w-20`} value={f.dim_unit} onChange={(e) => set({ dim_unit: e.target.value })}>{DIM_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
        </Field>
      )}
      {v('pallet_id') && <Field label="Pallet ID" required={r('pallet_id')}>{text('pallet_id')}</Field>}
    </div>
  );
}

function ShipmentDetails({ cfg, s, set }) {
  const v = (id) => cfg[id].visible; const r = (id) => cfg[id].required;
  const text = (key) => <input className={input} value={s[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} />;
  const date = (key) => <input className={`${input} w-[7.5rem] px-1`} type="date" value={s[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} />;
  return (
    <div className="flex items-stretch gap-4">
      <div className="grid flex-1 content-start gap-x-3 gap-y-3 sm:grid-cols-4">
        <Field label="Ship Date" required>{date('ship_date')}</Field>
        {v('ship_method') && <Field label="Ship Method" required={r('ship_method')}>{text('ship_method')}</Field>}
        {v('tracking_number') && <Field label="PRO/Tracking Number" required={r('tracking_number')}>{text('tracking_number')}</Field>}
        {v('bol_number') && <Field label="BOL Number" required={r('bol_number')}>{text('bol_number')}</Field>}
        {v('est_delivery_date') && <Field label="Estimated Delivery Date" required={r('est_delivery_date')}>{date('est_delivery_date')}</Field>}
        {v('supplier_reference') && <Field label="Supplier Shipment Reference" required={r('supplier_reference')}>{text('supplier_reference')}</Field>}
        {v('packing_slip_number') && <Field label="Packing Slip Number" required={r('packing_slip_number')}>{text('packing_slip_number')}</Field>}
        {v('total_pallets') && <Field label="Total Pallets" required={r('total_pallets')}><input className={input} type="number" min="0" step="1" value={s.total_pallets ?? ''} onChange={(e) => set({ total_pallets: e.target.value })} /></Field>}
        {v('total_weight') && (
          <Field label="Total Shipment Weight" required={r('total_weight')}>
            <div className="flex gap-2">
              <input className={input} type="number" min="0" step="any" value={s.total_weight ?? ''} onChange={(e) => set({ total_weight: e.target.value })} />
              <select className={`${input} w-20`} value={s.weight_unit} onChange={(e) => set({ weight_unit: e.target.value })}>{WEIGHT_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
          </Field>
        )}
        <Field label="Total Cartons">
          <div className="flex h-9 items-center text-sm font-medium text-gray-800">{s._cartons}</div>
        </Field>
      </div>
      {v('shipment_notes') && (
        <label className="flex w-1/3 shrink-0 flex-col text-xs font-medium text-gray-600">
          <span>Shipment Notes{r('shipment_notes') ? <span className="text-red-600"> *</span> : null}</span>
          <textarea rows={5} value={s.notes ?? ''} onChange={(e) => set({ notes: e.target.value })}
            className="mt-1 min-h-[7.25rem] w-full flex-1 resize-none rounded border border-gray-300 bg-white px-2 py-1.5 text-sm" />
        </label>
      )}
    </div>
  );
}

const th = 'text-left px-3 py-2 font-medium';

function ItemQtyTable({ lines, carton, leftFor, onQty, idCols }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
          {idCols.map((c) => <th key={c.id} className="py-1 pr-3 font-medium">{c.label}</th>)}<th className="py-1 pr-3 font-medium">Description</th>
          <th className="py-1 pr-3 font-medium">Left to Ship</th><th className="py-1 font-medium">Carton Qty</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const mine = Number(carton.q[l.id] || 0) || 0;
          const left = leftFor(l);
          return (
            <tr key={l.id} className="border-b border-gray-50 last:border-0">
              {idCols.map((c) => <td key={c.id} className="py-1.5 pr-3 text-gray-600">{idValue(l, c.id)}</td>)}
              <td className="py-1.5 pr-3 text-gray-800">{l.title}</td>
              <td className="py-1.5 pr-3 text-gray-800">{Math.max(0, left - mine)}</td>
              <td className="py-1">
                <input type="number" min="0" max={left} step="1" inputMode="numeric" disabled={left === 0 && !mine}
                  value={carton.q[l.id] ?? ''} onChange={(e) => onQty(l.id, e.target.value)}
                  className="h-8 w-24 rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function LinesTable({ poId, lines, currency, exportLinks, config, lineColumns }) {
  const router = useRouter();
  const { creating, setCreating } = useContext(Ctx);
  const [saved, setSaved] = useState([]);          // cartons already saved, in order
  const [cur, setCur] = useState(blankCarton());   // the carton being filled in
  const [editIdx, setEditIdx] = useState(null);    // a saved carton open for editing
  const [ship, setShip] = useState({ ship_date: today(), weight_unit: 'lb' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cols, setCols] = useState(lineColumns);
  const [colsOpen, setColsOpen] = useState(false);
  const idCols = LINE_COLUMN_DEFS.filter((c) => cols[c.id]);

  async function toggleCol(id) {
    const next = { ...cols, [id]: !cols[id] };
    if (!next.sku && !next.supplier_sku && !next.barcode) return; // keep at least one
    setCols(next);
    try {
      await fetch('/api/supplier-portal/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineColumns: next }) });
    } catch { /* the choice still applies on this screen */ }
  }

  const qtyIn = (c, id) => Number(c.q[id] || 0) || 0;
  const hasQty = (c) => lines.some((l) => qtyIn(c, l.id) > 0);
  const remainingBase = (l) => Math.max(0, (l.ordered ?? 0) - (l.shipped ?? 0));

  const thisShipment = useMemo(() => {
    const t = {};
    for (const c of [...saved, cur]) for (const l of lines) t[l.id] = (t[l.id] ?? 0) + qtyIn(c, l.id);
    return t;
  }, [saved, cur, lines]); // eslint-disable-line react-hooks/exhaustive-deps
  // What a given carton can still take: remaining, minus what every OTHER carton already holds
  const leftFor = (l, own) => remainingBase(l) - ((thisShipment[l.id] ?? 0) - qtyIn(own, l.id));

  const curNo = saved.length + 1;
  const totalUnits = lines.reduce((t, l) => t + (l.ordered ?? 0), 0);
  const totalCost = lines.reduce((t, l) => t + (parseFloat(l.extended) || 0), 0);
  const cartonCount = saved.length + (hasQty(cur) ? 1 : 0);

  const cartonPayload = (c) => ({ ...c.f, lines: lines.map((l) => ({ lineId: l.id, qty: qtyIn(c, l.id) })).filter((x) => x.qty) });
  function cartonErrors(c, n) {
    return validateShipment(config, { ship_date: '2000-01-01' }, [cartonPayload(c)])
      .filter((e) => e.startsWith('Carton 1'))
      .map((e) => e.replace('Carton 1', `Carton ${n}`));
  }

  function fillCurrent() {
    const q = {};
    for (const l of lines) { const left = leftFor(l, cur); if (left > 0) q[l.id] = String(left); }
    setCur((c) => ({ ...c, q }));
  }

  function saveAndAddAnother() {
    const errs = cartonErrors(cur, curNo);
    if (errs.length) { setError(errs.slice(0, 3).join(' ')); return; }
    setError('');
    setSaved((cs) => [...cs, cur]);
    setCur(blankCarton());
  }
  const patchSaved = (i, patch) => setSaved((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  function removeSaved(i) {
    setSaved((cs) => cs.filter((_, k) => k !== i));
    setEditIdx((e) => (e == null ? null : e === i ? null : e > i ? e - 1 : e));
  }
  function doneEditing(i) {
    const errs = cartonErrors(saved[i], i + 1);
    if (errs.length) { setError(errs.slice(0, 3).join(' ')); return; }
    setError(''); setEditIdx(null);
  }

  function cancel() {
    setCreating(false); setSaved([]); setCur(blankCarton()); setEditIdx(null);
    setShip({ ship_date: today(), weight_unit: 'lb' }); setError('');
  }

  async function save() {
    setError('');
    const all = hasQty(cur) ? [...saved, cur] : saved;
    const { ...shipment } = ship;
    const body = { poId, shipment, cartons: all.map(cartonPayload) };
    const errs = validateShipment(config, body.shipment, body.cartons);
    if (!hasQty(cur) && Object.values(cur.f).some((v) => v && !['lb', 'in'].includes(v))) {
      errs.push(`Carton ${curNo}: enter a quantity for at least one item, or clear its fields.`);
    }
    for (const l of lines) if ((thisShipment[l.id] ?? 0) > remainingBase(l)) errs.push(`${l.sku || `Line ${l.lineNo}`}: more than the ${remainingBase(l)} remaining unshipped.`);
    if (errs.length) { setError(errs.slice(0, 4).join(' ') + (errs.length > 4 ? ` (and ${errs.length - 4} more)` : '')); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/supplier-portal/shipments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }
      cancel(); setBusy(false); router.refresh();
    } catch { setError('Something went wrong.'); setBusy(false); }
  }

  const buttons = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
      <Button variant="secondary" onClick={saveAndAddAnother} disabled={busy}>Save Carton / Add Another</Button>
      <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Shipment'}</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {creating && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">Shipment Details</h2>
          <div className="p-4">
            <ShipmentDetails cfg={config.shipment} s={{ ...ship, _cartons: cartonCount }} set={(p) => setShip((s) => ({ ...s, ...p }))} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">
            {creating ? `Create Shipment · Carton ${curNo}` : (<>Line Items<span className="ml-2 text-xs font-normal text-gray-400">({lines.length})</span></>)}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setColsOpen((o) => !o)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition">Columns</button>
              {colsOpen && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                  <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Show item columns</p>
                  {LINE_COLUMN_DEFS.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-gray-700 hover:bg-gray-50">
                      <input type="checkbox" checked={!!cols[c.id]} onChange={() => toggleCol(c.id)} />{c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {creating ? buttons : exportLinks}
          </div>
        </div>
        {error ? <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
        {creating && (
          <div className="border-b border-gray-200 p-4">
            <CartonFields cfg={config.carton} f={cur.f} set={(patch) => setCur((c) => ({ ...c, f: { ...c.f, ...patch } }))} />
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
              <th className={th}>#</th><th className={th}></th>{idCols.map((c) => <th key={c.id} className={th}>{c.label}</th>)}<th className={th}>Description</th>
              <th className={th}>Ordered</th><th className={th}>Shipped</th>
              <th className={th}>Received</th>
              {creating && <th className={th}>Shipment Qty</th>}
              {creating && (
                <th className={th}>
                  <button type="button" onClick={fillCurrent} title={`Fill Carton ${curNo} with every remaining unshipped quantity`}
                    className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">Carton Qty</button>
                </th>
              )}
              <th className={th}>Unit Cost</th><th className={th}>Extended Cost</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={(creating ? 10 : 8) + idCols.length} className="px-3 py-8 text-center text-gray-400">No line items on this purchase order.</td></tr>
            ) : lines.map((l) => {
              const left = leftFor(l, cur);
              return (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{l.lineNo}</td>
                  <td className="px-3 py-2">
                    <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image ? <img src={l.image} alt={l.title} className="object-cover w-full h-full" /> : null}
                    </div>
                  </td>
                  {idCols.map((c) => <td key={c.id} className="px-3 py-2 text-gray-600">{idValue(l, c.id)}</td>)}
                  <td className="px-3 py-2 text-gray-800 font-medium">{l.title || '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{l.ordered?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{(l.shipped ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-800">{(l.received ?? 0).toLocaleString()}</td>
                  {creating && (
                    <td className={`px-3 py-2 font-medium ${(thisShipment[l.id] ?? 0) > remainingBase(l) ? 'text-red-600' : 'text-gray-900'}`}>
                      {(thisShipment[l.id] ?? 0).toLocaleString()}
                    </td>
                  )}
                  {creating && (
                    <td className="px-3 py-1.5">
                      <input type="number" min="0" max={left} step="1" inputMode="numeric" disabled={left === 0 && !qtyIn(cur, l.id)}
                        value={cur.q[l.id] ?? ''} onChange={(e) => setCur((c) => ({ ...c, q: { ...c.q, [l.id]: e.target.value } }))}
                        className="h-8 w-24 rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100" />
                    </td>
                  )}
                  <td className="px-3 py-2 text-gray-800">{formatCurrency(l.unitCost, currency)}</td>
                  <td className="px-3 py-2 text-gray-800">{formatCurrency(l.extended, currency)}</td>
                </tr>
              );
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50 text-sm text-gray-800">
                <td className="px-3 py-2" colSpan={2 + idCols.length}></td>
                <td className="px-3 py-2 text-xs text-gray-500 font-medium">Totals</td>
                <td className="px-3 py-2 font-semibold">{totalUnits.toLocaleString()}</td>
                <td className="px-3 py-2" colSpan={creating ? 5 : 3}></td>
                <td className="px-3 py-2 font-semibold">{formatCurrency(totalCost, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {creating && saved.map((c, i) => {
        const units = lines.reduce((t, l) => t + qtyIn(c, l.id), 0);
        const editing = editIdx === i;
        const bits = [c.f.supplier_carton_id && `ID ${c.f.supplier_carton_id}`, c.f.tracking_number && `Tracking ${c.f.tracking_number}`, c.f.sscc && `SSCC ${c.f.sscc}`].filter(Boolean);
        return (
          <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">
                Carton {i + 1}
                <span className="ml-3 text-xs font-normal text-gray-500">{units} unit{units === 1 ? '' : 's'}{bits.length ? ` · ${bits.join(' · ')}` : ''}</span>
              </p>
              <div className="flex items-center gap-3 text-sm">
                {editing
                  ? <button type="button" className="text-blue-700 hover:underline" onClick={() => doneEditing(i)}>Done</button>
                  : <button type="button" className="text-blue-700 hover:underline" onClick={() => { setEditIdx(i); setError(''); }}>Edit</button>}
                <button type="button" className="text-red-600 hover:underline" onClick={() => removeSaved(i)}>Remove</button>
              </div>
            </div>
            <div className="border-t border-gray-100 px-4 py-3">
              {editing ? (
                <div className="space-y-4">
                  <CartonFields cfg={config.carton} f={c.f} set={(patch) => patchSaved(i, { f: { ...c.f, ...patch } })} />
                  <ItemQtyTable lines={lines} carton={c} idCols={idCols} leftFor={(l) => leftFor(l, c)}
                    onQty={(lineId, v) => patchSaved(i, { q: { ...c.q, [lineId]: v } })} />
                </div>
              ) : (
                <ul className="text-sm text-gray-700">
                  {lines.filter((l) => qtyIn(c, l.id) > 0).map((l) => (
                    <li key={l.id} className="flex gap-3"><span className="w-28 text-gray-500">{l.sku || '—'}</span><span className="flex-1">{l.title}</span><span className="font-medium">{qtyIn(c, l.id)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
