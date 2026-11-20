'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IMPORT_STORAGE_KEY } from '../UploadShipFile';

const fmtDate = (v) => { if (!v) return '—'; const [y, m, d] = String(v).slice(0, 10).split('-'); return `${m}/${d}/${y}`; };
const btnBlue = 'inline-flex items-center rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const btnGray = 'inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

async function callImport(fileText, commit) {
  const res = await fetch('/api/supplier-portal/shipment-import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileText, commit, clientDate: new Date().toLocaleDateString('en-CA') }),
  });
  return res.json();
}

export default function ImportRecap() {
  const router = useRouter();
  const pick = useRef(null);
  const [file, setFile] = useState(null);     // { name, text }
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(null);     // { created: [...] }
  const [submitError, setSubmitError] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(true);

  const preview = useCallback(async (f) => {
    setBusy(true); setPlan(null); setSubmitError('');
    try { setPlan(await callImport(f.text, false)); }
    catch { setPlan({ ok: false, fatal: 'Something went wrong reading the file. Please try again.' }); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    let f = null;
    try { f = JSON.parse(sessionStorage.getItem(IMPORT_STORAGE_KEY) ?? 'null'); } catch { /* none */ }
    if (!f?.text) { setBusy(false); return; }
    setFile(f); preview(f);
  }, [preview]);

  function leave() {
    try { sessionStorage.removeItem(IMPORT_STORAGE_KEY); } catch { /* ignore */ }
    router.push('/supplier-portal/shipping');
  }

  async function onReplace(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setPlan({ ok: false, fatal: 'The file is too large (2 MB maximum).' }); return; }
    const next = { name: f.name, text: await f.text() };
    try { sessionStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setFile(next); setDone(null); preview(next);
  }

  async function submit() {
    setBusy(true); setSubmitError('');
    try {
      const r = await callImport(file.text, true);
      if (r.committed) {
        try { sessionStorage.removeItem(IMPORT_STORAGE_KEY); } catch { /* ignore */ }
        setDone({ created: r.created ?? [] });
      } else if (r.commitError) {
        setSubmitError(`${r.commitError}${r.created?.length ? ` Already created before the problem: ${r.created.join(', ')}.` : ''}`);
      } else { setPlan(r); }
    } catch { setSubmitError('Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Shipments created</h2>
        <p className="mt-2 text-sm text-gray-700">{done.created.length} shipment{done.created.length === 1 ? '' : 's'} created: {done.created.join(', ')}.</p>
        <div className="mt-4"><Link href="/supplier-portal/shipping" className={btnBlue}>Back to Shipping</Link></div>
      </section>
    );
  }
  if (!file && !busy) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-700">No file was selected.</p>
        <div className="mt-4"><Link href="/supplier-portal/shipping" className={btnBlue}>Back to Shipping</Link></div>
      </section>
    );
  }

  const bad = plan && !plan.ok;
  const shownRows = plan?.rows ? (onlyProblems && plan.errorCount ? plan.rows.filter((r) => Object.keys(r.e).length) : plan.rows) : [];
  const actions = (
    <div className="flex items-center gap-2">
      <input ref={pick} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onReplace} />
      {bad && <button type="button" className={btnGray} onClick={() => pick.current?.click()} disabled={busy}>Upload corrected file</button>}
      <button type="button" className={btnGray} onClick={leave} disabled={busy}>Cancel</button>
      <button type="button" className={btnBlue} onClick={submit} disabled={busy || !plan?.ok}>{busy && plan ? 'Working…' : 'Submit'}</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Review Ship File</h2>
            <p className="mt-0.5 text-xs text-gray-500">{file?.name}{plan?.rowCount ? ` · ${plan.rowCount.toLocaleString()} row${plan.rowCount === 1 ? '' : 's'}` : ''}. Nothing is created until you click Submit.</p>
          </div>
          {actions}
        </div>
        {busy && !plan && <p className="mt-3 text-sm text-gray-500">Checking the file…</p>}
        {submitError && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{submitError}</p>}
        {plan?.fatal && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{plan.fatal}</p>}
        {plan && !plan.fatal && plan.ok && (
          <p className="mt-3 text-sm text-gray-800">
            Submitting will create <b>{plan.totals.shipments}</b> shipment{plan.totals.shipments === 1 ? '' : 's'} with <b>{plan.totals.cartons}</b> carton{plan.totals.cartons === 1 ? '' : 's'} and <b>{plan.totals.units.toLocaleString()}</b> unit{plan.totals.units === 1 ? '' : 's'}.
          </p>
        )}
        {plan && !plan.fatal && !plan.ok && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-medium">{plan.errorCount} problem{plan.errorCount === 1 ? '' : 's'} found. Nothing has been created. Fix the fields shown in red and upload the corrected file.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {plan.errors.slice(0, 15).map((e, i) => <li key={i}>Row {e.n}: {e.message}</li>)}
              {plan.errorCount > 15 && <li>…and {plan.errorCount - 15} more (see the rows below).</li>}
            </ul>
          </div>
        )}
      </section>

      {/* Rows with the problem fields in red */}
      {plan && !plan.fatal && !plan.ok && plan.rows.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">File rows</h3>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Show only rows with problems
            </label>
          </div>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-2 py-1.5 font-medium">Row</th>
                {plan.columns.map((c) => <th key={c.id} className="whitespace-nowrap px-2 py-1.5 font-medium">{c.label}</th>)}
              </tr></thead>
              <tbody>
                {shownRows.map((r) => (
                  <tr key={r.n} className="border-t border-gray-100">
                    <td className="px-2 py-1 text-gray-400">{r.n}</td>
                    {plan.columns.map((c) => (
                      <td key={c.id} title={r.e[c.id] ?? ''}
                        className={`whitespace-nowrap px-2 py-1 ${r.e[c.id] ? 'bg-red-100 font-medium text-red-800 ring-1 ring-inset ring-red-400' : 'text-gray-700'}`}>
                        {r.v[c.id] || (r.e[c.id] ? '(blank)' : '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.rowCount > plan.rows.length && <p className="mt-1.5 text-xs text-gray-400">Showing the first {plan.rows.length} rows. Problems are listed above.</p>}
        </section>
      )}

      {/* What is about to be created */}
      {plan?.ok && plan.groups.map((g) => (
        <section key={`${g.poNumber}-${g.shipDate}`} className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-800">
              {g.poNumber}
              <span className="ml-3 text-xs font-normal text-gray-500">
                Ship date {fmtDate(g.shipDate)} · {g.cartons.length} carton{g.cartons.length === 1 ? '' : 's'} · {g.units.toLocaleString()} unit{g.units === 1 ? '' : 's'}
                {g.tracking ? ` · PRO/Tracking ${g.tracking}` : ''}{g.reference ? ` · Ref ${g.reference}` : ''}{g.packingSlip ? ` · Packing slip ${g.packingSlip}` : ''}
              </span>
            </p>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-400">
              <th className="px-4 py-1.5 font-medium">Carton</th><th className="px-2 py-1.5 font-medium">Carton ID</th>
              <th className="px-2 py-1.5 font-medium">Items</th><th className="px-2 py-1.5 font-medium">Units</th>
              <th className="px-2 py-1.5 font-medium">Lot</th><th className="px-2 py-1.5 font-medium">Expires</th>
            </tr></thead>
            <tbody>
              {g.cartons.map((c) => (
                <tr key={c.no} className="border-t border-gray-50 align-top">
                  <td className="px-4 py-1.5 text-gray-800">Carton {c.no}</td>
                  <td className="px-2 py-1.5 font-mono text-gray-700">{c.cartonId ?? '—'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{c.items.map((it, i) => <div key={i}>{it.sku}{it.title ? ` – ${it.title}` : ''} × {it.qty.toLocaleString()}</div>)}</td>
                  <td className="px-2 py-1.5 text-gray-700">{c.units.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-gray-700">{c.lot ?? '—'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{fmtDate(c.exp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {plan?.ok && <div className="flex justify-end">{actions}</div>}
    </div>
  );
}
