'use client';
// "Create Shipment" on the supplier PO screen: line items, shipment details, and carton-level packing.
// The button (top right) and the screen body live in different places, so they share state here.
import { createContext, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/shared/components/ui/Button';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { validateShipment, WEIGHT_UNITS, DIM_UNITS } from '@/lib/shipmentFields';

const Ctx = createContext(null);

export function ShipmentProvider({ children }) {
  const [creating, setCreating] = useState(false);
  return <Ctx.Provider value={{ creating, setCreating }}>{children}</Ctx.Provider>;
}

export function CreateShipmentButton({ enabled, hint }) {
  const { creating, setCreating } = useContext(Ctx);
  if (creating) return null;
  return <Button onClick={() => setCreating(true)} disabled={!enabled} title={enabled ? undefined : hint}>Create Shipment</Button>;
}

const input = 'h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm';
const today = () => new Date().toLocaleDateString('en-CA');
const newCarton = () => ({ key: Math.random().toString(36).slice(2), f: { weight_unit: 'lb', dim_unit: 'in' }, q: {} });

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
      {v('carton_notes') && <Field label="Notes" required={r('carton_notes')} wide>{text('notes')}</Field>}
    </div>
  );
}

function ShipmentDetails({ cfg, s, set }) {
  const v = (id) => cfg[id].visible; const r = (id) => cfg[id].required;
  const text = (key) => <input className={input} value={s[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} />;
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Ship Date" required><input className={input} type="date" value={s.ship_date ?? ''} onChange={(e) => set({ ship_date: e.target.value })} /></Field>
      {v('carrier') && <Field label="Carrier" required={r('carrier')}>{text('carrier')}</Field>}
      {v('service') && <Field label="Shipping Method / Service" required={r('service')}>{text('service')}</Field>}
      {v('tracking_number') && <Field label="Shipment Tracking / PRO Number" required={r('tracking_number')}>{text('tracking_number')}</Field>}
      {v('bol_number') && <Field label="BOL Number" required={r('bol_number')}>{text('bol_number')}</Field>}
      {v('est_delivery_date') && <Field label="Estimated Delivery Date" required={r('est_delivery_date')}><input className={input} type="date" value={s.est_delivery_date ?? ''} onChange={(e) => set({ est_delivery_date: e.target.value })} /></Field>}
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
      {v('shipment_notes') && <Field label="Shipment Notes" required={r('shipment_notes')} wide>{text('notes')}</Field>}
    </div>
  );
}

export function LinesTable({ poId, lines, currency, exportLinks, config }) {
  const router = useRouter();
  const { creating, setCreating } = useContext(Ctx);
  const [cartons, setCartons] = useState([newCarton()]);
  const [active, setActive] = useState(0);
  const [ship, setShip] = useState({ ship_date: today(), weight_unit: 'lb' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remainingBase = (l) => Math.max(0, (l.ordered ?? 0) - (l.shipped ?? 0));
  const qtyIn = (c, id) => Number(c.q[id] || 0) || 0;
  const thisShipment = useMemo(() => {
    const t = {};
    for (const c of cartons) for (const l of lines) t[l.id] = (t[l.id] ?? 0) + qtyIn(c, l.id);
    return t;
  }, [cartons, lines]);
  const leftFor = (l, idx) => remainingBase(l) - ((thisShipment[l.id] ?? 0) - qtyIn(cartons[idx], l.id));

  const totalUnits = lines.reduce((t, l) => t + (l.ordered ?? 0), 0);
  const totalCost = lines.reduce((t, l) => t + (parseFloat(l.extended) || 0), 0);

  const setCarton = (idx, patch) => setCartons((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const setCartonFields = (idx) => (patch) => setCarton(idx, { f: { ...cartons[idx].f, ...patch } });
  const setQty = (idx, lineId, value) => setCarton(idx, { q: { ...cartons[idx].q, [lineId]: value } });

  function fillActive() {
    const q = {};
    for (const l of lines) { const left = leftFor(l, active); if (left > 0) q[l.id] = String(left); }
    setCarton(active, { q });
  }
  function addCarton() {
    const cur = cartons[active];
    if (!lines.some((l) => qtyIn(cur, l.id) > 0)) { setError(`Enter a quantity for at least one item in Carton ${active + 1} before adding another.`); return; }
    setError('');
    setCartons((cs) => [...cs, newCarton()]);
    setActive(cartons.length);
  }
  function removeCarton(idx) {
    if (cartons.length === 1) { setCartons([newCarton()]); setActive(0); return; }
    setCartons((cs) => cs.filter((_, i) => i !== idx));
    setActive((a) => (idx < a ? a - 1 : idx === a ? Math.max(0, idx - 1) : a));
  }
  function cancel() { setCreating(false); setCartons([newCarton()]); setActive(0); setShip({ ship_date: today(), weight_unit: 'lb' }); setError(''); }

  function payload() {
    const { _cartons, ...shipment } = ship;
    return {
      poId,
      shipment,
      cartons: cartons.map((c) => ({ ...c.f, lines: lines.map((l) => ({ lineId: l.id, qty: qtyIn(c, l.id) })).filter((x) => x.qty) })),
    };
  }

  async function save() {
    setError('');
    const body = payload();
    const errs = validateShipment(config, body.shipment, body.cartons);
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

  const th = 'text-left px-3 py-2 font-medium';
  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
      <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Shipment'}</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">
            {creating ? 'Create Shipment' : 'Line Items'}<span className="ml-2 text-xs font-normal text-gray-400">({lines.length})</span>
          </h2>
          {creating ? actions : exportLinks}
        </div>
        {error ? <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
              <th className={th}>#</th><th className={th}></th><th className={th}>SKU</th><th className={th}>Description</th>
              <th className={th}>Ordered</th><th className={th}>Shipped</th>
              <th className={th}>Received</th><th className={th}>Open</th>
              {creating && (
                <th className={th}>
                  <button type="button" onClick={fillActive} title={`Fill Carton ${active + 1} with every remaining unshipped quantity`}
                    className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">Shipped Qty</button>
                </th>
              )}
              <th className={th}>Unit Cost</th><th className={th}>Extended Cost</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={creating ? 11 : 10} className="px-3 py-8 text-center text-gray-400">No line items on this purchase order.</td></tr>
            ) : lines.map((l) => {
              const open = (l.ordered ?? 0) - (l.received ?? 0);
              return (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{l.lineNo}</td>
                  <td className="px-3 py-2">
                    <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image ? <img src={l.image} alt={l.title} className="object-cover w-full h-full" /> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{l.sku || '—'}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium">{l.title || '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{l.ordered?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{(l.shipped ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-800">{(l.received ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-800">{open > 0 ? open.toLocaleString() : '—'}</td>
                  {creating && (
                    <td className={`px-3 py-2 font-medium ${(thisShipment[l.id] ?? 0) > remainingBase(l) ? 'text-red-600' : 'text-gray-900'}`}>
                      {(thisShipment[l.id] ?? 0).toLocaleString()}
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
                <td className="px-3 py-2" colSpan={3}></td>
                <td className="px-3 py-2 text-xs text-gray-500 font-medium">Totals</td>
                <td className="px-3 py-2 font-semibold">{totalUnits.toLocaleString()}</td>
                <td className="px-3 py-2" colSpan={creating ? 5 : 4}></td>
                <td className="px-3 py-2 font-semibold">{formatCurrency(totalCost, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {creating && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">Shipment Details</h2>
            <div className="p-4">
              <ShipmentDetails cfg={config.shipment} s={{ ...ship, _cartons: cartons.length }} set={(p) => setShip((s) => ({ ...s, ...p }))} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Cartons<span className="ml-2 text-xs font-normal text-gray-400">({cartons.length})</span></h2>
              <Button variant="secondary" onClick={addCarton}>Add Carton</Button>
            </div>
            <div className="divide-y divide-gray-100">
              {cartons.map((c, idx) => {
                const units = lines.reduce((t, l) => t + qtyIn(c, l.id), 0);
                const isActive = idx === active;
                return (
                  <div key={c.key} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        Carton {idx + 1}
                        <span className="ml-3 text-xs font-normal text-gray-500">{units} unit{units === 1 ? '' : 's'}{c.f.supplier_carton_id ? ` · ${c.f.supplier_carton_id}` : ''}</span>
                      </p>
                      <div className="flex items-center gap-3 text-sm">
                        {!isActive && <button type="button" className="text-blue-700 hover:underline" onClick={() => { setActive(idx); setError(''); }}>Edit</button>}
                        <button type="button" className="text-red-600 hover:underline" onClick={() => removeCarton(idx)}>{cartons.length === 1 ? 'Clear' : 'Remove'}</button>
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-3 space-y-4">
                        <CartonFields cfg={config.carton} f={c.f} set={setCartonFields(idx)} />
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                              <th className="py-1 pr-3 font-medium">SKU</th><th className="py-1 pr-3 font-medium">Description</th>
                              <th className="py-1 pr-3 font-medium">Left to Ship</th><th className="py-1 font-medium">Qty in Carton {idx + 1}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((l) => {
                              const left = leftFor(l, idx);
                              return (
                                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                                  <td className="py-1.5 pr-3 text-gray-600">{l.sku || '—'}</td>
                                  <td className="py-1.5 pr-3 text-gray-800">{l.title}</td>
                                  <td className="py-1.5 pr-3 text-gray-800">{Math.max(0, left - qtyIn(c, l.id)) }</td>
                                  <td className="py-1">
                                    <input type="number" min="0" max={left} step="1" inputMode="numeric" disabled={left === 0 && !qtyIn(c, l.id)}
                                      value={c.q[l.id] ?? ''} onChange={(e) => setQty(idx, l.id, e.target.value)}
                                      className="h-8 w-24 rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">{actions}</div>
          </div>
        </>
      )}
    </div>
  );
}
