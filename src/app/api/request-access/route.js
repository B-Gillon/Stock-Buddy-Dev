// src/app/api/request-access/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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
    has_supplier_requirements,
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

  // Required field validation
  if (!store_url?.trim())     return NextResponse.json({ error: 'Store URL is required.' }, { status: 400 });
  if (!contact_name?.trim())  return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 });
  if (!contact_email?.trim()) return NextResponse.json({ error: 'Contact email is required.' }, { status: 400 });
  if (!understands_private_beta) return NextResponse.json({ error: 'You must acknowledge the private beta terms.' }, { status: 400 });
  if (!agrees_no_share_link)     return NextResponse.json({ error: 'You must agree not to share the install link.' }, { status: 400 });

  const { error } = await supabase.from('access_requests').insert({
    store_url:                  store_url.trim(),
    contact_name:               contact_name.trim(),
    contact_email:              contact_email.trim().toLowerCase(),
    company_size:               company_size || null,
    monthly_order_volume:       monthly_order_volume || null,
    num_skus_variants:          num_skus_variants || null,
    current_inventory_methods:  Array.isArray(current_inventory_methods) ? current_inventory_methods : [],
    has_supplier_requirements:  has_supplier_requirements ?? null,
    how_create_pos_today:       how_create_pos_today?.trim() || null,
    biggest_challenge:          biggest_challenge?.trim() || null,
    why_interested:             why_interested?.trim() || null,
    willing_to_provide_feedback: willing_to_provide_feedback ?? null,
    open_to_onboarding_calls:   open_to_onboarding_calls ?? null,
    how_soon_to_start:          how_soon_to_start || null,
    anything_else:              anything_else?.trim() || null,
    understands_private_beta:   true,
    agrees_no_share_link:       true,
    status:                     'pending',
  });

  if (error) {
    console.error('[request-access] Supabase insert error:', error);
    return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
