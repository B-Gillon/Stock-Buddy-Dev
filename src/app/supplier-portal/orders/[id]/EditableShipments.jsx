'use client';
// Supplier's shipments on a PO, with carton editing and label (re)printing.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateShipment } from '@/lib/shipmentFields';
import { LINE_COLUMN_DEFS } from '@/lib/supplierColumns';
import { CartonFields, ItemQtyTable, BTN_BLUE, useLastShipmentId } from './ShipmentProvider';

const btn = 'inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50';
const fmt = (v) => { if (!v) return '—'; const [y, m, d] = String(v).slice(0, 10).split('-'); return `${m}/${d}/${y}`; };
const s2 = (v) => (v == null ? '' : String(v));

const toDraft = (c, cartonLines) => ({
  f: {
    supplier_carton_id: s2(c.supplier_carton_id), sscc: s2(c.sscc), tracking_number: s2(c.tracking_number),
    weight: s2(c.weight), weight_unit: c.weight_unit || 'lb',
    length: s2(c.length), width: s2(c.width), height: s2(c.height), dim_unit: c.dim_unit || 'in',
    pallet_id: s2(c.pallet_id),
  },
  q: Object.fromEntries(cartonLines.map((l) => [l.po_line_id, String(l.shipped_qty)])),
  lx: Object.fromEntries(cartonLines.map((l) => [l.po_line_id, { lot: s2(l.lot_number), exp: s2(l.expiration_date) }])),
});

export default function EditableShipments({ shipments: allShipments, lines, config, lineColumns, labels }) {
  // Right after Save Shipment, show only the shipment just created (a page reload lists them all again)
  const lastId = useLastShipmentId();
  const shipments = lastId && allShipments.some((s) => s.id === lastId) ? allShipments.filter((s) => s.id === lastId) : allShipments;
  const cartonCfg = config.carton;
  const router = useRouter();
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idCols = LINE_COLUMN_DEFS.filter((c) => lineColumns?.[c.id] && ['sku', 'supplier_sku', 'barcode'].includes(c.id));

  const savedQty = (carton, lineId) => Number(carton.lines.find((x) => x.po_line_id === lineId)?.shipped_qty ?? 0);

  function start(c) { setEditId(c.id); setDraft(toDraft(c, c.lines)); setError(''); }
  function cancel() { setEditId(null); setDraft(null); setError(''); }

  async function save(c) {
    const payload = { ...draft.f, lines: lines.map((l) => ({ lineId: l.id, sku: l.sku, qty: Number(draft.q[l.id] || 0) || 0, lot_number: draft.lx?.[l.id]?.lot ?? '', expiration_date: draft.lx?.[l.id]?.exp ?? '' })).filter((x) => x.qty) };
    const errs = validateShipment(config, { ship_date: '2000-01-01' }, [{ ...payload, sscc: labels?.enabled ? (c.sscc || '000000000000000000') : payload.sscc }])
      .filter((e) => e.startsWith('Carton 1'));
    if (errs.length) { setError(errs[0].replace('Carton 1', `Carton ${c.carton_no}`)); return; }
    setBusy(true); setError('');
    const w = labels?.enabled && labels.printMode === 'each_carton' ? window.open('', '_blank') : null;
    try {
      const res = await fetch(`/api/supplier-portal/shipments/cartons/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carton: payload }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { w?.close(); setError(d.error || 'Something went wrong.'); setBusy(false); return; }
      if (w) w.location.href = `/supplier-portal/labels?sscc=${d.sscc}`;
      cancel(); setBusy(false); router.refresh();
    } catch { w?.close(); setError('Something went wrong.'); setBusy(false); }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">Shipments</h2>
      {shipments.map((sh) => (
        <div key={sh.id} className="border-b border-gray-100 last:border-0">
          <div className="flex items-center justify-between py-2.5 pl-4 pr-[29px]">
            <p className="text-sm font-medium text-gray-800">
              {sh.shipment_number}
              <span className="ml-3 text-xs font-normal text-gray-500">Ship date {fmt(sh.ship_date)} · {sh.cartons.length} carton{sh.cartons.length === 1 ? '' : 's'}</span>
            </p>
            {sh.cartons.some((c) => c.sscc || c.supplier_carton_id) && (
              <a className={BTN_BLUE} href={`/supplier-portal/labels?shipment=${sh.id}`} target="_blank" rel="noopener noreferrer">Print All Case Labels</a>
            )}
          </div>
          <div className="px-4 pb-3 space-y-2">
            {sh.cartons.map((c) => {
              const units = c.lines.reduce((t, x) => t + x.shipped_qty, 0);
              const editing = editId === c.id;
              return (
                <div key={c.id} className="rounded border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-800">
                      Carton {c.carton_no}
                      <span className="ml-3 text-xs text-gray-500">{units} unit{units === 1 ? '' : 's'}{c.sscc ? ` · SSCC ${c.sscc}` : ''}{c.received_at ? ' · Received' : ''}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs">
                      {!c.received_at && !editing && <button type="button" className="text-blue-700 hover:underline" onClick={() => start(c)}>Edit</button>}
                      {(c.sscc || c.supplier_carton_id) && !c.received_at && <a className={BTN_BLUE} href={`/supplier-portal/labels?carton=${c.id}`} target="_blank" rel="noopener noreferrer">Print Case Label</a>}
                    </span>
                  </div>
                  {editing && draft && (
                    <div className="space-y-4 border-t border-gray-100 px-3 py-3">
                      <CartonFields enforce={config.enforceValidSscc} cfg={cartonCfg} f={draft.f} set={(patch) => setDraft((d) => ({ ...d, f: { ...d.f, ...patch } }))} autoSscc={labels?.enabled} />
                      <ItemQtyTable lines={lines} carton={draft} idCols={idCols} cfg={cartonCfg}
                        onLx={(lineId, patch) => setDraft((d) => ({ ...d, lx: { ...d.lx, [lineId]: { ...d.lx?.[lineId], ...patch } } }))}
                        leftFor={(l) => Math.max(0, l.ordered - l.shipped) + savedQty(c, l.id)}
                        onQty={(lineId, v) => setDraft((d) => ({ ...d, q: { ...d.q, [lineId]: v } }))} />
                      {labels?.enabled && <p className="text-xs text-gray-500">If you change the quantities, a new SSCC and label are issued for this carton and the old label is voided.</p>}
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" className={btn} onClick={cancel} disabled={busy}>Cancel</button>
                        <button type="button" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => save(c)} disabled={busy}>{busy ? 'Saving…' : 'Save Carton'}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
