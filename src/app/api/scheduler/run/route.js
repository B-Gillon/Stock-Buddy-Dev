// Settings -> Scheduler: run a job now.
import { NextResponse } from 'next/server';
import { runJob } from '@/lib/scheduledJobs';

export const maxDuration = 60;

export async function POST(request) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { key } = await request.json().catch(() => ({}));
  const result = await runJob(String(key ?? ''), 'manual');
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
