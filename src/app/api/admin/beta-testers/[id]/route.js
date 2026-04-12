// /src/app/api/admin/beta-testers/[id]/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/logError';

function isAuthorized(request) {
  const key = request.nextUrl.searchParams.get('key');
  return key === process.env.ADMIN_SECRET_KEY;
}

// ── PATCH /api/admin/beta-testers/[id] — update a beta tester ────────────────
export async function PATCH(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = [
      'contact_name', 'contact_email', 'contact_phone', 'notes',
      'shopify_domain', 'store_name', 'owner_name', 'owner_email',
      'is_active',
    ];

    const updates = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('beta_testers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    await logError({ source: 'api/admin/beta-testers/PATCH', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE /api/admin/beta-testers/[id] — remove a beta tester ───────────────
export async function DELETE(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { error } = await supabase
      .from('beta_testers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/admin/beta-testers/DELETE', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
