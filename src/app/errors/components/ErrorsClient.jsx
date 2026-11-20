'use client';
// Errors that have occurred for this store. Select one or more and delete them; expand a row to see each error.
import { useState } from 'react';
import AppLayout from '@/shared/components/layout/AppLayout';

const fmt = (iso) => new Date(iso).toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });

// The one-line version shown while a row is collapsed
function summary(e) {
  if (e.source === 'shipFilePickup/file') return 'Ship file had processing errors';
  if (e.source === 'shipFilePickup/connect') return 'Could not check the supplier\'s SFTP site for ship files';
  const first = String(e.message ?? '').split('\n')[0];
  return first.length > 110 ? `${first.slice(0, 107)}…` : first;
}
// The errors themselves, one per line (the ship file header line is dropped: it is the summary)
function lines(e) {
  const all = String(e.message ?? '').split('\n').map((l) => l.trimEnd()).filter(Boolean);
  return e.source === 'shipFilePickup/file' ? all.slice(1) : all;
}

export default function ErrorsClient({ initialErrors }) {
  const [errors, setErrors] = useState(initialErrors);
  const [open, setOpen] = useState(() => new Set());
  const [picked, setPicked] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const allPicked = errors.length > 0 && picked.size === errors.length;
  const toggle = (set, setSet, id) => setSet((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function removePicked() {
    setBusy(true); setProblem('');
    try {
      const ids = [...picked];
      const res = await fetch('/api/errors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed');
      setErrors((list) => list.filter((e) => !picked.has(e.id)));
      setPicked(new Set()); setConfirming(false);
    } catch (e) { setProblem(e.message); }
    finally { setBusy(false); }
  }

  return (
    <AppLayout title="Errors" showActionBar={false}>
      <div className="mx-auto max-w-6xl p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">Problems Stock Buddy ran into, newest first (up to the latest 200).</p>
          {confirming ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-gray-700">Delete {picked.size} error{picked.size === 1 ? '' : 's'}?</span>
              <button type="button" disabled={busy} onClick={removePicked} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="text-xs text-gray-600 hover:underline">Cancel</button>
            </span>
          ) : (
            <button type="button" disabled={picked.size === 0} onClick={() => setConfirming(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
              Delete{picked.size ? ` (${picked.size})` : ''}
            </button>
          )}
        </div>
        {problem && <p className="mb-2 text-sm text-red-600">{problem}</p>}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300" title="Select all" checked={allPicked} disabled={errors.length === 0}
                    onChange={() => { setPicked(allPicked ? new Set() : new Set(errors.map((e) => e.id))); setConfirming(false); }} />
                </th>
                <th className="px-2 py-2">Date / time</th>
                <th className="px-2 py-2">Problem</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">User</th>
              </tr>
            </thead>
            <tbody>
              {errors.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No errors.</td></tr>}
              {errors.map((e) => {
                const isOpen = open.has(e.id);
                const detail = lines(e);
                return [
                  <tr key={e.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-2"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={picked.has(e.id)} onChange={() => { toggle(picked, setPicked, e.id); setConfirming(false); }} /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-600">{fmt(e.created_at)}</td>
                    <td className="px-2 py-2 text-gray-900">
                      <span className="flex items-start gap-2">
                        <button type="button" aria-label={isOpen ? 'Hide errors' : 'Show errors'} aria-expanded={isOpen} onClick={() => toggle(open, setOpen, e.id)}
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-100">{isOpen ? '−' : '+'}</button>
                        <span>{summary(e)}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{e.supplier || <span className="text-gray-400">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{e.user_name ?? <span className="text-gray-400">—</span>}</td>
                  </tr>,
                  isOpen && (
                    <tr key={`${e.id}-open`} className="bg-gray-50">
                      <td />
                      <td />
                      {/* One line per error, never wrapped; a long one runs on under the Supplier and User columns */}
                      <td colSpan={3} className="px-2 pb-3 pt-1">
                        <div className="space-y-0.5 text-xs text-gray-800">
                          {detail.map((l, i) => <div key={i} className="whitespace-nowrap">{l}</div>)}
                          {detail.length === 0 && <div className="text-gray-400">No details recorded.</div>}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
