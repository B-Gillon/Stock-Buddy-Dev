// /src/app/api/suppliers/[id]/csv-settings/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/logError';

const COLUMN_MAP = {
  po_number:                 'csv_export.po_number',
  supplier_name:             'csv_export.supplier_name',
  supplier_number:           'csv_export.supplier_number',
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

const FIELD_TO_COLUMN = Object.fromEntries(Object.entries(COLUMN_MAP).map(([col, key]) => [key, col]));

export async function GET(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;

    const { data, error } = await supabase.from('supplier_csv_settings').select('*').eq('supplier_id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return NextResponse.json({ use_global: true, settings: null });

    const settings = {};
    for (const [col, key] of Object.entries(COLUMN_MAP)) settings[key] = data[col];
    return NextResponse.json({ use_global: data.use_global, settings });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/csv-settings/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const { id } = await params;
    const body = await request.json();
    const { use_global, settings } = body;

    const row = { tenant_id: tenantId, supplier_id: id, use_global: use_global ?? true, updated_at: new Date().toISOString() };
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        const col = FIELD_TO_COLUMN[key];
        if (col) row[col] = value;
      }
    }

    const { error } = await supabase.from('supplier_csv_settings').upsert(row, { onConflict: 'supplier_id' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/csv-settings/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
