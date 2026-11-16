// Signed-in supplier user saves their own display preferences (which item columns they see).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizeLineColumns } from '@/lib/supplierColumns';

export async function POST(request) {
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const lineColumns = normalizeLineColumns(body.lineColumns);

  const { data: user } = await supabase.from('app_users').select('ui_prefs').eq('id', userId).maybeSingle();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { error } = await supabase.from('app_users')
    .update({ ui_prefs: { ...(user.ui_prefs ?? {}), lineColumns } }).eq('id', userId);
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  return NextResponse.json({ ok: true, lineColumns });
}
