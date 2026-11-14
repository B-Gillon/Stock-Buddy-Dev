'use client';
// Supplier enters their name (and optionally an expected ship date) and clicks Acknowledge.
import { useState } from 'react';

export default function AcknowledgeForm({ token, stamp, requiredShipDate }) {
  const [name, setName] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: hidden from people
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, stamp, name, shipDate: shipDate || null, website }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok) setDone(true);
      else if (json.code === 'already') setDone(true);
      else setError(json.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-900">
        <p className="font-semibold">Thank you. This order has been acknowledged.</p>
        <p className="mt-1">You can close this page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">Acknowledge this order</h2>
      <p className="text-sm text-gray-600">
        Acknowledge receipt and the required ship date, or provide a revised ship date and then acknowledge.
      </p>
      <div>
        <label htmlFor="ack-name" className="block text-sm font-medium text-gray-700">Your name <span className="text-red-600">*</span></label>
        <input id="ack-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Required Ship Date</label>
          <div className="mt-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{requiredShipDate || "TBD"}</div>
        </div>
        <div>
          <label htmlFor="ack-ship" className="block text-sm font-medium text-gray-700">Expected Ship Date <span className="font-normal text-gray-500">(optional)</span></label>
          <input id="ack-ship" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy}
        className="rounded bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? 'Submitting…' : 'Acknowledge'}
      </button>
    </form>
  );
}
