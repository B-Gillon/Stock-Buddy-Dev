// /src/app/api/acknowledge/route.js
// Public endpoint: the supplier's acknowledgement submit. Protected by the signed token.
import { NextResponse } from 'next/server';
import { submitAck } from '@/lib/acknowledgements';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const result = await submitAck({
    token: body.token,
    name: body.name,
    shipDate: body.shipDate,
    stamp: body.stamp,
    website: body.website,
    ip,
    userAgent: request.headers.get('user-agent'),
  });

  const status = result.ok ? 200 : result.code === 'invalid' ? 404 : result.code === 'error' ? 500 : 400;
  return NextResponse.json(result, { status });
}
