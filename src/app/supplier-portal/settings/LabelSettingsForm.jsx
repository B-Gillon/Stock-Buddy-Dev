'use client';
import { useState } from 'react';
import Button from '@/shared/components/ui/Button';

const input = 'h-9 rounded border border-gray-300 px-2 text-sm';

export default function LabelSettingsForm({ initial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [prefix, setPrefix] = useState(initial.companyPrefix);
  const [ext, setExt] = useState(String(initial.extensionDigit));
  const [mode, setMode] = useState(initial.printMode);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/supplier-portal/label-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, companyPrefix: prefix, extensionDigit: ext, printMode: mode }) });
      const d = await res.json().catch(() => ({}));
      setMsg(res.ok && d.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: d.error || 'Something went wrong.' });
    } catch { setMsg({ ok: false, text: 'Something went wrong.' }); }
    setBusy(false);
  }

  return (
    <div className="max-w-2xl rounded-lg border border-gray-200 bg-white shadow-sm">
      <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">Carton Labels (SSCC)</h2>
      <div className="space-y-4 p-4 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Generate an SSCC and carton label for each carton I pack
        </label>
        <div className={enabled ? '' : 'opacity-50'}>
          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">GS1 Company Prefix (7–10 digits, issued by GS1)</span>
              <input className={`${input} w-56`} inputMode="numeric" value={prefix} disabled={!enabled}
                onChange={(e) => setPrefix(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">Extension digit</span>
              <select className={`${input} w-24`} value={ext} disabled={!enabled} onChange={(e) => setExt(e.target.value)}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="mt-4 space-y-1.5">
            <legend className="mb-1 text-xs text-gray-500">When to print labels</legend>
            <label className="flex items-center gap-2"><input type="radio" name="mode" disabled={!enabled} checked={mode === 'each_carton'} onChange={() => setMode('each_carton')} />Each time a carton is saved</label>
            <label className="flex items-center gap-2"><input type="radio" name="mode" disabled={!enabled} checked={mode === 'end'} onChange={() => setMode('end')} />All at once after the shipment is saved</label>
          </fieldset>
          <p className="mt-4 text-xs text-gray-400">
            SSCC numbers are assigned in order and never reused. You can also reprint labels any time from the shipments list on a PO. Labels are 4 × 6 in.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}
