'use client';
// Errors that have occurred for this store. Each can be expanded for details and deleted.
import { useState } from 'react';
import AppLayout from '@/shared/components/layout/AppLayout';

const fmt = (iso) => new Date(iso).toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });

export default function ErrorsClient({ initialErrors }) {
  const [errors, setErrors] = useState(initialErrors);
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function remove(id) {
    setBusy(true); setProblem('');
    try {
      const res = await fetch(`/api/errors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed');
      setErrors((list) => list.filter((e) => e.id !== id));
      setConfirm(null);
    } catch (e) { setProblem(e.message); }
    finally { setBusy(false); }
  }

  return (
    <AppLayout title="Errors" showActionBar={false}>
      <div className="mx-auto max-w-6xl p-4">
        <p className="mb-3 text-sm text-gray-500">Problems Stock Buddy ran into, newest first (up to the latest 200). Delete one once you've dealt with it.</p>
        {problem && <p className="mb-2 text-sm text-red-600">{problem}</p>}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-2">Date / time</th><th className="px-4 py-2">Problem</th><th className="px-4 py-2">Where</th><th className="px-4 py-2">User</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>
              {errors.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No errors. 🎉</td></tr>}
              {errors.map((e) => (
                <FragmentRow key={e.id}>
                  <tr className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{fmt(e.created_at)}</td>
                    <td className="px-4 py-2 text-gray-900">
                      <button type="button" className="text-left hover:underline" onClick={() => setOpen(open === e.id ? null : e.id)}>{e.message}</button>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{e.source}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{e.user_name ?? <span className="text-gray-400">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {confirm === e.id ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <button type="button" disabled={busy} onClick={() => remove(e.id)} className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
                          <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="text-gray-600 hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirm(e.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                      )}
                    </td>
                  </tr>
                  {open === e.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        {e.context && <pre className="mb-2 whitespace-pre-wrap break-all rounded border border-gray-200 bg-white p-2 text-xs text-gray-700">{JSON.stringify(e.context, null, 2)}</pre>}
                        {e.stack ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">{e.stack}</pre> : <p className="text-xs text-gray-400">No technical details recorded.</p>}
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

// A keyed wrapper so a row and its detail row stay together
function FragmentRow({ children }) { return <>{children}</>; }
