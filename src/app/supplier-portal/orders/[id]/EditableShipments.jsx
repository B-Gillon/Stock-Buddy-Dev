'use client';
// Supplier's shipments on a PO: delete a carton (its items go back to waiting to ship) and print labels.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BTN_BLUE, useLastShipmentId } from './ShipmentProvider';

const btn = 'inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50';
const fmt = (v) => { if (!v) return '—'; const [y, m, d] = String(v).slice(0, 10).split('-'); return `${m}/${d}/${y}`; };

export default function EditableShipments({ shipments: allShipments }) {
  // Right after Save Shipment, show only the shipment just created (a page reload lists them all again)
  const lastId = useLastShipmentId();
  const shipments = lastId && allShipments.some((s) => s.id === lastId) ? allShipments.filter((s) => s.id === lastId) : allShipments;
  const router = useRouter();
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function remove(c) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/supplier-portal/shipments/cartons/${c.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { setError(d.error || 'Something went wrong.'); setBusy(false); return; }
      setConfirmId(null); setBusy(false); router.refresh();
    } catch { setError('Something went wrong.'); setBusy(false); }
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
              const confirming = confirmId === c.id;
              return (
                <div key={c.id} className="rounded border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-800">
                      Carton {c.carton_no}
                      <span className="ml-3 text-xs text-gray-500">{units} unit{units === 1 ? '' : 's'}{c.sscc ? ` · SSCC ${c.sscc}` : ''}{c.received_at ? ' · Received' : ''}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs">
                      {!c.received_at && !confirming && <button type="button" className="text-red-600 hover:underline" onClick={() => { setConfirmId(c.id); setError(''); }}>Delete</button>}
                      {(c.sscc || c.supplier_carton_id) && !c.received_at && <a className={BTN_BLUE} href={`/supplier-portal/labels?carton=${c.id}`} target="_blank" rel="noopener noreferrer">Print Case Label</a>}
                    </span>
                  </div>
                  {confirming && (
                    <div className="space-y-2 border-t border-gray-100 px-3 py-3">
                      <p className="text-sm text-gray-700">
                        Delete Carton {c.carton_no}? Its items go back to waiting to ship, and its SSCC is voided.
                        {sh.cartons.length > 1 ? ' The remaining cartons in this shipment are renumbered, so reprint all of their labels.' : ' This is the last carton, so the shipment is deleted too.'}
                      </p>
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" className={btn} onClick={() => { setConfirmId(null); setError(''); }} disabled={busy}>Cancel</button>
                        <button type="button" className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50" onClick={() => remove(c)} disabled={busy}>{busy ? 'Deleting…' : 'Delete Carton'}</button>
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
