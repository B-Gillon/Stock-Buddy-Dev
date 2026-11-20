// Settings -> Scheduler: the jobs with their schedule and last run (GET), and edits to enabled / frequency (POST).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import { JOBS, MIN_INTERVAL, MAX_INTERVAL } from '@/lib/scheduledJobs';

const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

async function view() {
  const { data } = await supabase.from('scheduled_jobs').select('job_key, enabled, interval_minutes, last_triggered_at, running_since, last_finished_at, last_status, last_message, last_trigger');
  const by = new Map((data ?? []).map((r) => [r.job_key, r]));
  const { data: status } = await supabase.rpc('scheduler_status');
  return {
    status: status ?? null,
    minInterval: MIN_INTERVAL, maxInterval: MAX_INTERVAL,
    jobs: Object.entries(JOBS).map(([key, j]) => ({ key, label: j.label, description: j.description, ...(by.get(key) ?? { enabled: false, interval_minutes: 60 }) })),
  };
}

export async function GET(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { return NextResponse.json(await view()); }
  catch (err) { await logError({ source: 'api/scheduler/GET', error: err }); return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const b = await request.json();
    for (const [key, v] of Object.entries(b.jobs ?? {})) {
      if (!JOBS[key]) continue;
      const mins = Number(v.interval_minutes);
      if (!Number.isInteger(mins) || mins < MIN_INTERVAL || mins > MAX_INTERVAL) {
        return NextResponse.json({ error: `${JOBS[key].label}: run every ${MIN_INTERVAL} to ${MAX_INTERVAL} minutes.` }, { status: 422 });
      }
      const { error } = await supabase.from('scheduled_jobs').update({ enabled: !!v.enabled, interval_minutes: mins, updated_at: new Date().toISOString() }).eq('job_key', key);
      if (error) throw error;
    }
    return NextResponse.json({ success: true, ...(await view()) });
  } catch (err) {
    await logError({ source: 'api/scheduler/POST', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
