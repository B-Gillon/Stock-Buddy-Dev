// src/app/api/admin/access-requests/[id]/route.js
// PATCH: approve or reject a pending access request.
// Also updates the matching beta_testers row notes field.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function PATCH(request, { params }) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { status, reviewer_notes } = body;
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected".' }, { status: 400 });
  }

  // Update access_requests
  const { data: updated, error: updateError } = await supabase
    .from('access_requests')
    .update({ status, reviewer_notes: reviewer_notes ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[admin/access-requests/[id]] update error:', updateError);
    return NextResponse.json({ error: 'Failed to update request.' }, { status: 500 });
  }

  // Sync beta_testers notes to reflect new status (Approved / Rejected)
  const newNote = status === 'approved' ? 'Approved' : 'Rejected';
  await supabase
    .from('beta_testers')
    .update({ notes: newNote, is_active: status === 'approved' })
    .eq('shopify_domain', updated.store_url)
    .eq('notes', 'Form Submitted');

  return NextResponse.json({ data: updated }, { status: 200 });
}
