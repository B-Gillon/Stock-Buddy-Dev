// /src/app/api/purchase-orders/[id]/resend/route.js
import { NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenants';
import { sendPOEmail } from '@/lib/sendPOEmail';
import { logPOActivity } from '@/lib/logPOActivity';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id } = await params;

    // Fetch To addresses for the log comment
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
      const allTo = recipients
        .flatMap((r) => (r.to_emails ?? '').split(',').map((e) => e.trim()).filter(Boolean));
      toComment = allTo.join(', ');
    } else if (po?.supplier?.po_email) {
      toComment = po.supplier.po_email;
    }

    // Log resent immediately before sending (Option B — optimistic)
    await logPOActivity({
      poId:     id,
      tenantId,
      action:   'resent',
      comments: toComment || null,
    });

    // Return 200 immediately — send email in background
    Promise.resolve().then(async () => {
      const result = await sendPOEmail(id, { isResend: true });
      if (!result.success) {
        console.error('Resend email error:', result.error);
        await logPOActivity({
          poId:     id,
          tenantId,
          action:   'error',
          comments: `Email send failed: ${result.error}`,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Resend route error:', err);
    try {
      const { id } = await params;
      await logPOActivity({
        poId:     id,
        tenantId: null,
        action:   'error',
        comments: `Resend failed: ${err.message}`,
      });
    } catch (_) {}
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
