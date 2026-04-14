// /src/app/api/purchase-orders/[id]/resend/route.js
import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenants';
import { sendPOEmail } from '@/lib/sendPOEmail';
import { logPOActivity } from '@/lib/logPOActivity';
import { logError } from '@/lib/logError';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('supplier_id, supplier:suppliers(id, po_email)')
      .eq('id', id)
      .single();

    const { data: recipients } = await supabase
      .from('supplier_transmission_recipients')
      .select('to_emails')
      .eq('supplier_id', po?.supplier?.id ?? '')
      .order('sort_order', { ascending: true });

    let toComment = '';
    if (recipients && recipients.length > 0) {
      toComment = recipients
        .flatMap((r) => (r.to_emails ?? '').split(',').map((e) => e.trim()).filter(Boolean))
        .join(', ');
    } else if (po?.supplier?.po_email) {
      toComment = po.supplier.po_email;
    }

    // Send the email — must be awaited before returning or Vercel will
    // terminate the function before the email is sent
    const result = await sendPOEmail(id, { isResend: true });

    if (!result.success) {
      await logError({
        source: 'api/purchase-orders/[id]/resend/email',
        error: new Error(result.error),
        tenantId,
        context: { poId: id },
      });
      await logPOActivity({
        poId: id, tenantId, action: 'error',
        comments: `Email send failed: ${result.error}`,
      });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    await logPOActivity({
      poId: id, tenantId, action: 'resent',
      comments: toComment || null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/[id]/resend', error: err, tenantId });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
