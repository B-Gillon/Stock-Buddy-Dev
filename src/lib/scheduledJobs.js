// /src/lib/scheduledJobs.js
// The background jobs, who may call them, and how a run is recorded. The database scheduler (pg_cron, see
// doc/migrations/2026-11-20_scheduler_pg_cron.sql) calls each job's endpoint when it is due; the Scheduler tab in
// Settings edits the schedule and can run a job on demand. Server-side only.
import { timingSafeEqual } from 'node:crypto';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';
import { pickupAllShipFiles } from '@/lib/shipFilePickup';
import { refreshAllSftpStatus } from '@/lib/sftp';
import { sendDueReminders } from '@/lib/acknowledgements';

export const JOBS = {
  ship_file_pickup: {
    label: 'Ship file pickup',
    description: 'Picks up shipment files from each supplier\'s SFTP site (suppliers with SFTP Shipments turned on), creates the shipments and deletes the files.',
    run: pickupAllShipFiles,
  },
  sftp_status: {
    label: 'SFTP delivery check',
    description: 'Checks the PO files we put on suppliers\' SFTP sites and records when they were picked up or removed.',
    run: refreshAllSftpStatus,
  },
  ack_reminders: {
    label: 'Acknowledgement reminders',
    description: 'Emails suppliers a reminder when a PO has not been acknowledged within their set number of business days.',
    run: sendDueReminders,
  },
};

export const MIN_INTERVAL = 5, MAX_INTERVAL = 1440;

/** The scheduler (or the old GitHub job) calls with the CRON_SECRET from Vercel or the scheduler's own database secret. */
export async function cronAuthorized(request) {
  const given = request.headers.get('authorization') ?? '';
  if (!given.startsWith('Bearer ')) return false;
  const env = process.env.CRON_SECRET;
  if (env) {
    const a = Buffer.from(given), b = Buffer.from(`Bearer ${env}`);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  const { data } = await supabase.rpc('scheduler_check_secret', { candidate: given.slice(7) });
  return data === true;
}

const brief = (summary) => Object.entries(summary ?? {}).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${v}`).join(', ').slice(0, 500);

/**
 * Runs one job and records the outcome. A job already running (started under 10 minutes ago) is not started twice.
 * @returns {Promise<{ok:boolean, skipped?:boolean, summary?:object, error?:string}>}
 */
export async function runJob(key, trigger) {
  const job = JOBS[key];
  if (!job) return { ok: false, error: 'Unknown job.' };
  const now = new Date();
  const stale = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: claimed } = await supabase.from('scheduled_jobs').update({ running_since: now.toISOString() })
    .eq('job_key', key).or(`running_since.is.null,running_since.lt.${stale}`).select('job_key');
  if (!claimed?.length) return { ok: true, skipped: true, error: 'Already running.' };

  let result;
  try {
    const summary = await job.run();
    result = { ok: true, summary };
    await supabase.from('scheduled_jobs').update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'ok', last_message: brief(summary), last_trigger: trigger }).eq('job_key', key);
  } catch (err) {
    await logError({ source: `scheduler/${key}`, error: err });
    result = { ok: false, error: err.message };
    await supabase.from('scheduled_jobs').update({ running_since: null, last_finished_at: new Date().toISOString(), last_status: 'error', last_message: String(err.message).slice(0, 500), last_trigger: trigger }).eq('job_key', key);
  }
  return result;
}
