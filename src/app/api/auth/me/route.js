// /src/app/api/auth/me/route.js — who is signed in on the website (null inside Shopify)
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, readSessionValue } from '@/lib/auth/session';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  const jar = await cookies();
  const s = readSessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ user: null });
  const { data } = await supabase.from('app_users').select('email, role, status').eq('id', s.uid).maybeSingle();
  if (!data || data.status !== 'active') return NextResponse.json({ user: null });
  return NextResponse.json({ user: { email: data.email, role: data.role } });
}
