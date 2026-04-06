// /src/app/api/suppliers/[id]/csv-settings/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';

// Column name → CSV field key mapping
const COLUMN_MAP = {
  po_number:                 'csv_export.po_number',
  supplier_name:             'csv_export.supplier_name',
  ship_to_name:              'csv_export.ship_to_name',
  ship_to_address:           'csv_export.ship_to_address',
  po_date:                   'csv_export.po_date',
  expected_date:             'csv_export.expected_date',
  notes_supplier:            'csv_export.notes_supplier',
  line_no:                   'csv_export.line_no',
  sku:                       'csv_export.sku',
  title:                     'csv_export.title',
  quantity:                  'csv_export.quantity',
  unit_cost:                 'csv_export.unit_cost',
  supplier_sku:              'csv_export.supplier_sku',
  barcode:                   'csv_export.barcode',
  extended_cost:             'csv_export.extended_cost',
  bin_location:              'csv_export.bin_location',
  product_tags:              'csv_export.product_tags',
  weight_value:              'csv_export.weight_value',
  total_weight:              'csv_export.total_weight',
  weight_unit:               'csv_export.weight_unit',
  retail_price:              'csv_export.retail_price',
  current_stock:             'csv_export.current_stock',
  total_stock_all_locations: 'csv_export.total_stock_all_locations',
};

// Reverse map: CSV field key → column name
const FIELD_TO_COLUMN = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([col, key]) => [key, col])
);

// GET /api/suppliers/[id]/csv-settings
// Returns { use_global, settings: { 'csv_export.po_number': true, ... } }
export async function GET(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  const { data, error } = await supabase
    .from('supplier_csv_settings')
    .select('*')
    .eq('supplier_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('GET supplier_csv_settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // No row yet — return null to signal "use defaults"
  if (!data) {
    return NextResponse.json({ use_global: true, settings: null });
  }

  // Map columns back to CSV field keys
  const settings = {};
  for (const [col, key] of Object.entries(COLUMN_MAP)) {
    settings[key] = data[col];
  }

  return NextResponse.json({ use_global: data.use_global, settings });
}

// POST /api/suppliers/[id]/csv-settings
// Body: { use_global: bool, settings: { 'csv_export.po_number': true, ... } }
export async function POST(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { use_global, settings } = body;

  // Build the upsert row
  const row = {
    tenant_id:   tenantId,
    supplier_id: id,
    use_global:  use_global ?? true,
    updated_at:  new Date().toISOString(),
  };

  // Map CSV field keys → column names
  if (settings) {
    for (const [key, value] of Object.entries(settings)) {
      const col = FIELD_TO_COLUMN[key];
      if (col) row[col] = value;
    }
  }

  const { error } = await supabase
    .from('supplier_csv_settings')
    .upsert(row, { onConflict: 'supplier_id' });

  if (error) {
    console.error('POST supplier_csv_settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
