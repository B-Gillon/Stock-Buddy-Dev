// src/app/api/request-access/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import nodemailer from 'nodemailer';

/** Strip protocol, www, trailing slashes so domains compare cleanly. */
function normalizeDomain(raw) {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    store_url,
    contact_name,
    contact_email,
    company_size,
    monthly_order_volume,
    num_skus_variants,
    current_inventory_methods,
    how_send_pos_to_suppliers,
    how_create_pos_today,
    biggest_challenge,
    why_interested,
    willing_to_provide_feedback,
    open_to_onboarding_calls,
    how_soon_to_start,
    anything_else,
    understands_private_beta,
    agrees_no_share_link,
  } = body;

  // ── Required field validation ──────────────────────────────────────────────
  if (!store_url?.trim())               return NextResponse.json({ error: 'Store URL is required.' }, { status: 400 });
  if (!contact_name?.trim())            return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 });
  if (!contact_email?.trim())           return NextResponse.json({ error: 'Contact email is required.' }, { status: 400 });
  if (!company_size?.trim())            return NextResponse.json({ error: 'Company size is required.' }, { status: 400 });
  if (!monthly_order_volume?.trim())    return NextResponse.json({ error: 'Monthly order volume is required.' }, { status: 400 });
  if (!num_skus_variants?.trim())       return NextResponse.json({ error: 'Number of SKUs / Variants is required.' }, { status: 400 });
  if (!Array.isArray(current_inventory_methods) || current_inventory_methods.length === 0)
    return NextResponse.json({ error: 'Please select at least one inventory management method.' }, { status: 400 });
  if (!how_send_pos_to_suppliers?.trim())   return NextResponse.json({ error: 'Please describe how you send purchase orders to suppliers.' }, { status: 400 });
  if (!how_create_pos_today?.trim())    return NextResponse.json({ error: 'Please describe how you create purchase orders today.' }, { status: 400 });
  if (!biggest_challenge?.trim())       return NextResponse.json({ error: 'Please describe your biggest challenge.' }, { status: 400 });
  if (!why_interested?.trim())          return NextResponse.json({ error: 'Please tell us why you are interested in Stock Buddy.' }, { status: 400 });
  if (willing_to_provide_feedback === '' || willing_to_provide_feedback === null || willing_to_provide_feedback === undefined)
    return NextResponse.json({ error: 'Please answer the feedback question.' }, { status: 400 });
  if (open_to_onboarding_calls === '' || open_to_onboarding_calls === null || open_to_onboarding_calls === undefined)
    return NextResponse.json({ error: 'Please answer the onboarding calls question.' }, { status: 400 });
  if (!how_soon_to_start?.trim())       return NextResponse.json({ error: 'Please select how soon you are looking to get started.' }, { status: 400 });
  if (!understands_private_beta)        return NextResponse.json({ error: 'You must acknowledge the private beta terms.' }, { status: 400 });
  if (!agrees_no_share_link)            return NextResponse.json({ error: 'You must agree not to share the install link.' }, { status: 400 });

  const normalizedDomain = normalizeDomain(store_url);

  // ── Duplicate check ────────────────────────────────────────────────────────
  // Fetch all access_requests store_urls and normalize for comparison.
  const { data: existing } = await supabase
    .from('access_requests')
    .select('store_url');

  const duplicate = (existing ?? []).some(
    row => normalizeDomain(row.store_url) === normalizedDomain
  );

  if (duplicate) {
    return NextResponse.json({ duplicate: true }, { status: 200 });
  }

  // ── Insert into access_requests ───────────────────────────────────────────
  const { error: insertError } = await supabase.from('access_requests').insert({
    store_url:                  normalizedDomain,
    contact_name:               contact_name.trim(),
    contact_email:              contact_email.trim().toLowerCase(),
    company_size:               company_size || null,
    monthly_order_volume:       monthly_order_volume || null,
    num_skus_variants:          num_skus_variants || null,
    current_inventory_methods:  current_inventory_methods,
    how_send_pos_to_suppliers:  how_send_pos_to_suppliers?.trim() || null,
    how_create_pos_today:       how_create_pos_today?.trim() || null,
    biggest_challenge:          biggest_challenge?.trim() || null,
    why_interested:             why_interested?.trim() || null,
    willing_to_provide_feedback: willing_to_provide_feedback === 'yes' ? true : willing_to_provide_feedback === 'no' ? false : null,
    open_to_onboarding_calls:   open_to_onboarding_calls === 'yes' ? true : open_to_onboarding_calls === 'no' ? false : null,
    how_soon_to_start:          how_soon_to_start || null,
    anything_else:              anything_else?.trim() || null,
    understands_private_beta:   true,
    agrees_no_share_link:       true,
    status:                     'pending',
  });

  if (insertError) {
    console.error('[request-access] Supabase insert error:', insertError);
    return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
  }

  // ── Insert into beta_testers with status "Form Submitted" ────────────────
  // notes field carries the status label so the admin registry can display it.
  const { error: testerError } = await supabase.from('beta_testers').insert({
    contact_name:   contact_name.trim(),
    contact_email:  contact_email.trim().toLowerCase(),
    shopify_domain: normalizedDomain,
    notes:          'Form Submitted',
    is_active:      false,
    invited_at:     null,
  });

  if (testerError) {
    // Non-fatal — log but don't fail the submission.
    console.error('[request-access] beta_testers insert error:', testerError);
  }

  // ── Send notification email ───────────────────────────────────────────────
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const yesNo = v => v === true ? 'Yes' : v === false ? 'No' : '—';
    const willingFeedback = willing_to_provide_feedback === 'yes' ? 'Yes' : willing_to_provide_feedback === 'no' ? 'No' : '—';
    const openCalls = open_to_onboarding_calls === 'yes' ? 'Yes' : open_to_onboarding_calls === 'no' ? 'No' : '—';

    await transporter.sendMail({
      from:    `"Stock Buddy" <${process.env.SMTP_USER}>`,
      to:      'hello@brandongillon.com',
      replyTo: `"${contact_name.trim()}" <${contact_email.trim()}>`,
      subject: `New Beta Request: ${contact_name.trim()} — ${normalizedDomain}`,
      text: [
        '── Contact Info ──────────────────────────────',
        `Name:           ${contact_name.trim()}`,
        `Email:          ${contact_email.trim()}`,
        `Store URL:      ${normalizedDomain}`,
        '',
        '── Business Profile ──────────────────────────',
        `Company Size:          ${company_size || '—'}`,
        `Monthly Order Volume:  ${monthly_order_volume || '—'}`,
        `SKUs / Variants:       ${num_skus_variants || '—'}`,
        `Inventory Methods:     ${(current_inventory_methods ?? []).join(', ') || '—'}`,
        `How they send POs to suppliers:`,
        how_send_pos_to_suppliers?.trim() || '—',
        '',
        '── Current Process ───────────────────────────',
        `How they create POs today:`,
        how_create_pos_today?.trim() || '—',
        '',
        `Biggest challenge:`,
        biggest_challenge?.trim() || '—',
        '',
        `Why interested in Stock Buddy:`,
        why_interested?.trim() || '—',
        '',
        '── Beta Participation ────────────────────────',
        `Willing to provide feedback: ${willingFeedback}`,
        `Open to onboarding calls:    ${openCalls}`,
        `How soon to start:           ${how_soon_to_start || '—'}`,
        '',
        `Anything else: ${anything_else?.trim() || '—'}`,
      ].join('\n'),
    });
  } catch (emailErr) {
    // Non-fatal — log but don't fail the submission.
    console.error('[request-access] notification email error:', emailErr);
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
