// src/app/api/contact/route.js
// Handles "Have Questions?" form submissions from the request-access intro page.
// Sends a plain-text email to hello@brandongillon.com via SMTP.

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, message } = body;

  if (!name?.trim())    return NextResponse.json({ error: 'Name is required.'    }, { status: 400 });
  if (!email?.trim())   return NextResponse.json({ error: 'Email is required.'   }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
      to:      'hello@brandongillon.com',
      replyTo: `"${name.trim()}" <${email.trim()}>`,
      subject: `Stock Buddy Question from ${name.trim()}`,
      text: [
        `Name:    ${name.trim()}`,
        `Email:   ${email.trim()}`,
        '',
        'Message:',
        message.trim(),
      ].join('\n'),
    });
  } catch (err) {
    console.error('[contact] SMTP error:', err);
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
