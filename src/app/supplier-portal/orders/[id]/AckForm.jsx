'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AckForm({ poId, requestedShipDate }) {
  const router = useRouter();
  const [date, setDate] = useState(requestedShipDate || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/supplier-portal/acknowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poId, shipDate: date || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }
      router.refresh();
    } catch { setError('Something went wrong.'); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-gray-900">Acknowledgement Required</h2>
      <p className="mt-1 text-xs text-gray-600">Confirm the expected ship date (or enter a revised one), then acknowledge.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-gray-700">Expected Ship Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 block h-10 rounded border border-gray-300 bg-white px-3 text-sm" />
        </label>
        <button disabled={busy} className="h-10 rounded bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Saving…' : 'Acknowledge'}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
