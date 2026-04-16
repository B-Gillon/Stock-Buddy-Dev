// src/app/api/admin/access-requests/route.js
// Returns all access_requests rows for the admin activity page detail modal.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/access-requests] fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch access requests.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
