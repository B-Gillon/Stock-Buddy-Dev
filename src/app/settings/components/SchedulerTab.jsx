'use client';
// Settings -> Scheduler: when each background job runs, turn a job on or off, and run one now.
// The schedule itself is kept by the database (pg_cron), which calls the app when a job is due.
import { useState, useEffect, useCallback } from 'react';

const PRESETS = [5, 10, 15, 30, 60, 120, 240, 360, 720, 1440];
const every = (m) => (m < 60 ? `${m} minutes` : m === 60 ? 'hour' : m % 60 === 0 ? `${m / 60} hours` : `${m} minutes`);
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '—');
const btn = 'inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50';

export default function SchedulerTab() {
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});     // key -> { enabled, interval_minutes }
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(null);
  const [note, setNote] = useState(null);     // { ok, text }

  const load = useCallback(async () => {
    const res = await fetch('/api/scheduler');
    const d = await res.json().catch(() => null);
    if (res.ok && d) { setData(d); return d; }
    return null;
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="py-10 text-center text-sm text-gray-500">Loading…</p>;

  const cur = (j) => ({ enabled: edits[j.key]?.enabled ?? j.enabled, interval_minutes: edits[j.key]?.interval_minutes ?? j.interval_minutes });
  const dirty = data.jobs.some((j) => { const c = cur(j); return c.enabled !== j.enabled || c.interval_minutes !== j.interval_minutes; });
  const set = (key, patch) => setEdits((e) => ({ ...e, [key]: { ...(e[key] ?? {}), ...patch } }));
  const st = data.status;

  async function save() {
    setSaving(true); setNote(null);
    try {
      const jobs = Object.fromEntries(data.jobs.map((j) => [j.key, cur(j)]));
      const res = await fetch('/api/scheduler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobs }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setData(d); setEdits({}); setNote({ ok: true, text: 'Saved. Changes take effect at the next minute.' });
    } catch (e) { setNote({ ok: false, text: e.message }); }
    finally { setSaving(false); setTimeout(() => setNote(null), 6000); }
  }

  async function runNow(key) {
    setRunning(key); setNote(null);
    try {
      const res = await fetch('/api/scheduler/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || 'The job failed.');
      setNote(d.skipped ? { ok: false, text: 'That job is already running.' } : { ok: true, text: 'Done.' });
    } catch (e) { setNote({ ok: false, text: e.message }); }
    finally { setRunning(null); await load(); setTimeout(() => setNote(null), 6000); }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Scheduler</h2>
        <p className="mt-1 text-sm text-gray-500">The background jobs, how often each runs, and a way to run one right now. Times are shown in your local time zone.</p>
      </div>

      {st && !st.tick_scheduled && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">The database scheduler is not running, so nothing runs on its own. “Run now” still works.</p>}
      {st?.tick_scheduled && <p className="text-xs text-gray-400">Scheduler is on. Last check by the database: {when(st.last_tick_at)} (it checks every minute).</p>}

      <div className="space-y-3">
        {data.jobs.map((j) => {
          const c = cur(j);
          const options = PRESETS.includes(c.interval_minutes) ? PRESETS : [...PRESETS, c.interval_minutes].sort((a, b) => a - b);
          const next = c.enabled && j.last_triggered_at ? new Date(new Date(j.last_triggered_at).getTime() + j.interval_minutes * 60000) : null;
          return (
            <div key={j.key} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800">{j.label}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">{j.description}</p>
                </div>
                <button type="button" className={btn} disabled={running !== null} onClick={() => runNow(j.key)}>{running === j.key ? 'Running…' : 'Run now'}</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <label className="flex items-center gap-2 text-gray-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" checked={c.enabled} onChange={(e) => set(j.key, { enabled: e.target.checked })} />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-gray-700">
                  Run every
                  <select className="rounded border border-gray-300 bg-white px-2 py-1 text-sm" value={c.interval_minutes} onChange={(e) => set(j.key, { interval_minutes: Number(e.target.value) })}>
                    {options.map((m) => <option key={m} value={m}>{every(m)}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                <p>
                  Last run: {when(j.last_finished_at)}
                  {j.last_status && <span className={`ml-2 font-medium ${j.last_status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{j.last_status === 'ok' ? 'OK' : 'Failed'}</span>}
                  {j.last_trigger && <span className="ml-2 text-gray-400">({j.last_trigger === 'manual' ? 'run now' : j.last_trigger === 'schedule' ? 'scheduled' : j.last_trigger})</span>}
                  {j.running_since && <span className="ml-2 text-amber-600">running…</span>}
                </p>
                {j.last_message && <p className="text-gray-500">{j.last_message}</p>}
                <p>Next run: {!c.enabled ? 'off' : next ? when(next.toISOString()) : 'at the next minute'}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
        {note && <span className={`text-sm ${note.ok ? 'text-green-600' : 'text-red-600'}`}>{note.text}</span>}
        <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </div>
  );
}
