// Printable 4x6 carton labels (GS1-128 barcode of the SSCC). One label per carton.
import { notFound } from 'next/navigation';
import bwipjs from 'bwip-js';
import { supabase } from '@/lib/supabaseClient';
import { requireSupplier } from '@/lib/supplierPortal';
import PrintNow from './PrintNow';
import { LOT_RE } from '@/lib/shipmentFields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carton Labels – Stock Buddy', robots: { index: false, follow: false } };

const fmt = (s) => `${s[0]} ${s.slice(1, 8)} ${s.slice(8, 17)} ${s[17]}`;
// GS1-128 for the expiry (AI 17, YYMMDD) and lot (AI 10, variable length so it goes last)
function lotBarcode(lot, exp) {
  const parts = [];
  if (exp && /^\d{4}-\d{2}-\d{2}$/.test(String(exp))) parts.push(`(17)${exp.slice(2, 4)}${exp.slice(5, 7)}${exp.slice(8, 10)}`);
  if (lot && LOT_RE.test(String(lot))) parts.push(`(10)${lot}`);
  if (!parts.length) return null;
  try { return { svg: bwipjs.toSVG({ bcid: 'gs1-128', text: parts.join(''), scale: 2, height: 12, includetext: false }), text: parts.join(' ') }; }
  catch { return null; }
}
const barcode = (sscc) => bwipjs.toSVG({ bcid: 'gs1-128', text: `(00)${sscc}`, scale: 3, height: 22, includetext: false });

export default async function LabelsPage({ searchParams }) {
  const s = await requireSupplier();
  const { shipment: shipmentId, sscc: ssccParam, lot: lotParam, exp: expParam } = (await searchParams) ?? {};
  let labels = []; // { sscc, cartonNo, total, poId, shipmentNumber }

  if (shipmentId) {
    const { data: sh } = await supabase.from('shipments').select('id, po_id, shipment_number, total_cartons')
      .eq('id', shipmentId).eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).maybeSingle();
    if (!sh) notFound();
    const { data: cartons } = await supabase.from('shipment_cartons').select('carton_no, sscc, lot_number, expiration_date')
      .eq('shipment_id', sh.id).order('carton_no');
    labels = (cartons ?? []).filter((c) => c.sscc).map((c) => ({ sscc: c.sscc, cartonNo: c.carton_no, lot: c.lot_number, exp: c.expiration_date, total: sh.total_cartons, poId: sh.po_id, shipmentNumber: sh.shipment_number }));
  } else if (ssccParam) {
    const { data: r } = await supabase.from('supplier_ssccs').select('sscc, po_id, carton_no, shipment_id')
      .eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).eq('sscc', String(ssccParam)).is('voided_at', null).maybeSingle();
    if (!r) notFound();
    let sh = null;
    if (r.shipment_id) ({ data: sh } = await supabase.from('shipments').select('shipment_number, total_cartons').eq('id', r.shipment_id).maybeSingle());
    // Saved carton: use its stored lot/expiry; not saved yet: use what the supplier just entered
    const { data: saved } = r.shipment_id ? await supabase.from('shipment_cartons').select('lot_number, expiration_date').eq('tenant_id', s.tenantId).eq('sscc', r.sscc).maybeSingle() : { data: null };
    const lot = saved ? saved.lot_number : String(lotParam ?? '').slice(0, 40) || null;
    const exp = saved ? saved.expiration_date : /^\d{4}-\d{2}-\d{2}$/.test(String(expParam ?? '')) ? expParam : null;
    labels = [{ lot, exp, sscc: r.sscc, cartonNo: r.carton_no, total: sh?.total_cartons ?? null, poId: r.po_id, shipmentNumber: sh?.shipment_number ?? null }];
  }
  if (!labels.length) notFound();

  const { data: po } = await supabase.from('purchase_orders')
    .select('po_number, location:locations!ship_to_location_id ( name, address1, address2, city, province, zip, country )')
    .eq('id', labels[0].poId).eq('tenant_id', s.tenantId).eq('supplier_id', s.supplierId).maybeSingle();
  if (!po) notFound();
  const loc = Array.isArray(po.location) ? po.location[0] : po.location;
  const cityLine = [loc?.city, loc?.province, loc?.zip].filter(Boolean).join(', ');

  return (
    <>
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        body { margin: 0; background: #e5e7eb; }
        .label { width: 4in; height: 6in; box-sizing: border-box; padding: 0.2in; margin: 0.2in auto; background: #fff; color: #000;
          font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; page-break-after: always; break-after: page; }
        .label h4 { margin: 0 0 2px; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #444; }
        .label .blk { border-bottom: 1.5px solid #000; padding: 6px 0; font-size: 13px; line-height: 1.25; }
        .label .big { font-size: 20px; font-weight: 700; }
        .label .bar { margin-top: auto; text-align: center; }
        .label .bar svg { width: 100%; height: 1.4in; }
        .label .bar.small svg { height: 1.0in; }
        .label .bar2 { text-align: center; margin-top: 6px; }
        .label .bar2 svg { width: 100%; height: 0.55in; }
        .label .bar2 .num { font-size: 11px; margin-top: 2px; }
        .label .num { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: .04em; margin-top: 4px; }
        .noprint { text-align: center; padding: 12px; font-family: Arial, sans-serif; font-size: 14px; }
        @media print { body { background: #fff; } .label { margin: 0; } .noprint { display: none; } }
      `}</style>
      <div className="noprint">
        {labels.length} label{labels.length === 1 ? '' : 's'} ·{' '}
        <button type="button" id="print-btn" style={{ padding: '4px 12px', border: '1px solid #999', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Print</button>
      </div>
      {labels.map((l) => (
        <div key={l.sscc} className="label">
          <div className="blk"><h4>Ship from</h4><div style={{ fontWeight: 700 }}>{s.supplierName}</div></div>
          <div className="blk">
            <h4>Ship to</h4>
            <div style={{ fontWeight: 700 }}>{loc?.name}</div>
            {loc?.address1 && <div>{loc.address1}</div>}
            {loc?.address2 && <div>{loc.address2}</div>}
            {cityLine && <div>{cityLine}</div>}
            {loc?.country && <div>{loc.country}</div>}
          </div>
          <div className="blk" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div><h4>PO</h4><div className="big">{po.po_number}</div>{l.shipmentNumber && <div style={{ fontSize: 11 }}>{l.shipmentNumber}</div>}</div>
            <div style={{ textAlign: 'right' }}><h4>Carton</h4><div className="big">{l.cartonNo}{l.total ? ` of ${l.total}` : ''}</div></div>
          </div>
          {(l.lot || l.exp) && (
            <div className="blk" style={{ display: 'flex', gap: 24 }}>
              {l.lot && <div><h4>Lot</h4><div style={{ fontWeight: 700 }}>{l.lot}</div></div>}
              {l.exp && <div><h4>Expires</h4><div style={{ fontWeight: 700 }}>{`${String(l.exp).slice(5, 7)}/${String(l.exp).slice(8, 10)}/${String(l.exp).slice(0, 4)}`}</div></div>}
            </div>
          )}
          {(() => {
            const lb = lotBarcode(l.lot, l.exp);
            return (
              <>
                {lb && (
                  <div className="bar2" style={{ marginTop: 'auto' }}>
                    <div dangerouslySetInnerHTML={{ __html: lb.svg }} />
                    <div className="num">{lb.text}</div>
                  </div>
                )}
                <div className={`bar${lb ? ' small' : ''}`} style={lb ? { marginTop: 6 } : undefined}>
            <h4 style={{ textAlign: 'left' }}>SSCC</h4>
            <div dangerouslySetInnerHTML={{ __html: barcode(l.sscc) }} />
            <div className="num">(00) {fmt(l.sscc)}</div>
                </div>
              </>
            );
          })()}
        </div>
      ))}
      <PrintNow />
    </>
  );
}
