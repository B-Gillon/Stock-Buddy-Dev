// /src/app/api/admin/beta-testers/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';

// ── Auth check ────────────────────────────────────────────────────────────────
function isAuthorized(request) {
  const key = request.nextUrl.searchParams.get('key');
  return key === process.env.ADMIN_SECRET_KEY;
}

// ── GET /api/admin/beta-testers — list all beta testers ──────────────────────
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('beta_testers')
      .select('*')
      .order('invited_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    await logError({ source: 'api/admin/beta-testers/GET', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/admin/beta-testers — create a new beta tester ──────────────────
export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contact_name, contact_email, contact_phone, notes, shopify_domain } = body;

    if (!contact_name) {
      return NextResponse.json({ error: 'contact_name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('beta_testers')
      .insert({
        contact_name,
        contact_email:  contact_email  || null,
        contact_phone:  contact_phone  || null,
        notes:          notes          || null,
        shopify_domain: shopify_domain || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    await logError({ source: 'api/admin/beta-testers/POST', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
