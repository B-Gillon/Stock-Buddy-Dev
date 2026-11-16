// /src/app/api/users/route.js — list users for the store, and add one (sends the create-password email)
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { createAuthToken } from '@/lib/auth/tokens';
import { sendPasswordLinkEmail, appUrl } from '@/lib/auth/inviteEmail';
import { logError } from '@/lib/logError';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const forbidden = (request) => request.headers.get('x-auth-role') === 'supplier';

export async function GET(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const [{ data: users }, { data: suppliers }] = await Promise.all([
      supabase.from('app_users')
        .select('id, email, role, supplier_id, status, last_login_at, created_at, supplier:suppliers ( supplier_name )')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, supplier_name').eq('tenant_id', tenantId).order('supplier_name'),
    ]);
    return NextResponse.json({
      users: (users ?? []).map((u) => ({ ...u, supplier_name: (Array.isArray(u.supplier) ? u.supplier[0] : u.supplier)?.supplier_name ?? null, supplier: undefined })),
      suppliers: suppliers ?? [],
    });
  } catch (err) {
    await logError({ source: 'api/users/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (forbidden(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const b = await request.json();
    const role = b.role === 'supplier' ? 'supplier' : b.role === 'retailer' ? 'retailer' : null;
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!role) return NextResponse.json({ error: 'Choose a user type.' }, { status: 400 });
    if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

    let supplier = null;
    if (role === 'supplier') {
      const { data } = await supabase.from('suppliers').select('id, supplier_name')
        .eq('id', b.supplier_id ?? '').eq('tenant_id', tenantId).maybeSingle();
      if (!data) return NextResponse.json({ error: 'Choose a supplier account.' }, { status: 400 });
      supplier = data;
    }

    const { data: user, error } = await supabase.from('app_users')
      .insert({ tenant_id: tenantId, email, role, supplier_id: supplier?.id ?? null })
      .select('id').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'That email address already has an account.' }, { status: 409 });
      throw error;
    }

    const { data: tenant } = await supabase.from('tenants').select('shop_name').eq('id', tenantId).maybeSingle();
    let emailSent = true;
    try {
      const raw = await createAuthToken(user.id, 'set_password');
      await sendPasswordLinkEmail({ to: email, link: appUrl(`/set-password/${raw}`), kind: 'invite',
        retailerName: tenant?.shop_name, supplierName: supplier?.supplier_name });
    } catch (err) {
      emailSent = false;
      await logError({ source: 'api/users/POST/email', error: err, tenantId });
    }
    return NextResponse.json({ success: true, emailSent });
  } catch (err) {
    await logError({ source: 'api/users/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
