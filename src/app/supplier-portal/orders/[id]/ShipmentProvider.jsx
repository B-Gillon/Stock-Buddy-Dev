'use client';
// Shared state for "Create Shipment" on the supplier PO screen: the button (top right)
// and the line items table (which turns editable) live in different places on the page.
import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/shared/components/ui/Button';
import { formatCurrency } from '@/shared/utils/formatCurrency';

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

export function LinesTable({ poId, lines, currency, exportLinks }) {
  const router = useRouter();
  const { creating, setCreating } = useContext(Ctx);
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remaining = (l) => Math.max(0, (l.ordered ?? 0) - (l.shipped ?? 0));
  const totalUnits = lines.reduce((t, l) => t + (l.ordered ?? 0), 0);
  const totalCost = lines.reduce((t, l) => t + (parseFloat(l.extended) || 0), 0);

  function fillAll() {
    const next = {};
    for (const l of lines) if (remaining(l) > 0) next[l.id] = String(remaining(l));
    setQty(next);
  }
  function cancel() { setCreating(false); setQty({}); setError(''); }

  async function save() {
    setBusy(true); setError('');
    const payload = lines.map((l) => ({ lineId: l.id, qty: Number(qty[l.id] || 0) }));
    for (const l of lines) {
      const n = Number(qty[l.id] || 0);
      if (!Number.isInteger(n) || n < 0) { setError('Shipped quantities must be whole numbers.'); setBusy(false); return; }
      if (n > remaining(l)) { setError(`Line ${l.lineNo}: more than the ${remaining(l)} remaining unshipped.`); setBusy(false); return; }
    }
    try {
      const res = await fetch('/api/supplier-portal/shipments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poId, lines: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }
      cancel(); setBusy(false); router.refresh();
    } catch { setError('Something went wrong.'); setBusy(false); }
  }

  const th = 'text-left px-3 py-2 font-medium';
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">
          {creating ? 'Create Shipment' : 'Line Items'}<span className="ml-2 text-xs font-normal text-gray-400">({lines.length})</span>
        </h2>
        {creating ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Shipment'}</Button>
          </div>
        ) : exportLinks}
      </div>
      {error ? <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            <th className={th}>#</th><th className={th}></th><th className={th}>SKU</th><th className={th}>Description</th>
            <th className={th}>Ordered</th><th className={th}>Shipped</th>
            {creating && (
              <th className={th}>
                <button type="button" onClick={fillAll} title="Fill every line with its remaining unshipped quantity"
                  className="font-medium text-blue-700 underline decoration-dotted hover:text-blue-900">Shipped Qty</button>
              </th>
            )}
            <th className={th}>Received</th><th className={th}>Open</th><th className={th}>Unit Cost</th><th className={th}>Extended Cost</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr><td colSpan={creating ? 11 : 10} className="px-3 py-8 text-center text-gray-400">No line items on this purchase order.</td></tr>
          ) : lines.map((l) => {
            const open = (l.ordered ?? 0) - (l.received ?? 0);
            const rem = remaining(l);
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
                {creating && (
                  <td className="px-3 py-1.5">
                    <input type="number" min="0" max={rem} step="1" inputMode="numeric" disabled={rem === 0}
                      value={qty[l.id] ?? ''} placeholder={rem === 0 ? '—' : ''}
                      onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                      className="h-8 w-24 rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100" />
                  </td>
                )}
                <td className="px-3 py-2 text-gray-800">{(l.received ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-800">{open > 0 ? open.toLocaleString() : '—'}</td>
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
  );
}
