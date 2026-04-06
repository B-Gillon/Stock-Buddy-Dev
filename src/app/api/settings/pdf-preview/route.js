// /src/app/api/settings/pdf-preview/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';
import { generatePOPdf } from '@/lib/generatePO';

const SAMPLE_PO = {
  po_number:      'PO-PREVIEW',
  po_date:        new Date().toISOString(),
  expected_date:  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  status:         'draft',
  notes_supplier: 'This is a sample purchase order for preview purposes only.',
  supplier: { supplier_name: 'Sample Supplier Co.' },
  location: {
    name: 'Main Warehouse', address1: '123 Commerce St', address2: '',
    city: 'Newark', province: 'NJ', zip: '07102', country: 'United States',
  },
};

const SAMPLE_LINES = [
  { line_no: 1, sku: 'SKU-001', title: 'Sample Product – Blue / Large',  supplier_sku: 'SUP-001', supplier_barcode: 'UPC000000001', order_qty_units: 100, unit_cost: 9.99,  extended_cost: 999.00  },
  { line_no: 2, sku: 'SKU-002', title: 'Sample Product – Blue / Medium', supplier_sku: 'SUP-002', supplier_barcode: 'UPC000000002', order_qty_units: 250, unit_cost: 9.99,  extended_cost: 2497.50 },
  { line_no: 3, sku: 'SKU-003', title: 'Sample Product – Red / Large',   supplier_sku: 'SUP-003', supplier_barcode: 'UPC000000003', order_qty_units: 50,  unit_cost: 12.99, extended_cost: 649.50  },
  { line_no: 4, sku: 'SKU-004', title: 'Sample Product – Red / Medium',  supplier_sku: 'SUP-004', supplier_barcode: 'UPC000000004', order_qty_units: 75,  unit_cost: 12.99, extended_cost: 974.25  },
];

export async function GET(request) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['pdf.contact_name', 'pdf.contact_email', 'pdf.contact_phone']);

  const settingsMap = Object.fromEntries(
    (settings || []).map(r => [r.key, r.value || ''])
  );

  const po = {
    ...SAMPLE_PO,
    contact_name:  settingsMap['pdf.contact_name']  || '',
    contact_email: settingsMap['pdf.contact_email'] || '',
    contact_phone: settingsMap['pdf.contact_phone'] || '',
  };

  const pdfBuffer = await generatePOPdf(po, SAMPLE_LINES, true);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Cache-Control':       'no-store',
    },
  });
}
