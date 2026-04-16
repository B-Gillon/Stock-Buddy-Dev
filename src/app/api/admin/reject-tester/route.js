// src/app/api/admin/reject-tester/route.js
// Sends a rejection email and marks the access_request as rejected.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import nodemailer from 'nodemailer';
import { buildEmailHtml } from '@/lib/email/buildEmailHtml';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { access_request_id, to_email, subject, message } = body;

  if (!access_request_id) return NextResponse.json({ error: 'access_request_id is required.' }, { status: 400 });
  if (!to_email?.trim())   return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
  if (!subject?.trim())    return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
  if (!message?.trim())    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

  const bodyParagraphs = message
    .trim()
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const bodyHtml = `${bodyParagraphs}`;

  const textEmail = message.trim();

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
      to:      to_email.trim(),
      bcc:     process.env.SMTP_USER,
      replyTo: process.env.SMTP_USER,
      subject: subject.trim(),
      text:    textEmail,
      html:    buildEmailHtml({ bodyHtml }),
    });
  } catch (err) {
    console.error('[reject-tester] SMTP error:', err);
    return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('access_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', access_request_id);

  if (updateError) console.error('[reject-tester] DB update error:', updateError);

  await supabase
    .from('beta_testers')
    .update({ notes: 'Rejected', is_active: false, invited_at: null })
    .eq('contact_email', to_email.trim().toLowerCase());

  return NextResponse.json({ success: true }, { status: 200 });
}
