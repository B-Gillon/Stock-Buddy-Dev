// /src/app/api/cron/ack-reminders/route.js
// Hourly job (GitHub Actions): emails reminders for POs not acknowledged within the supplier's
// configured number of business days.
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sendDueReminders } from '@/lib/acknowledgements';
import { logError } from '@/lib/logError';

export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed
  const a = Buffer.from(request.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const summary = await sendDueReminders();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    await logError({ source: 'api/cron/ack-reminders', error: err });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
