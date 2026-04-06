import PDFDocument from 'pdfkit';
import path from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────
const MARGIN    = 0.6 * 72;
const PAGE_W    = 8.5 * 72;
const PAGE_H    = 11 * 72;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_H  = MARGIN / 2;
const PAGE_BOTTOM = PAGE_H - MARGIN - FOOTER_H;

const COLS = {
  sku:     1.00 * 72,
  supSku:  1.15 * 72,
  barcode: 1.10 * 72,
  title:   2.15 * 72,
  qty:     0.45 * 72,
  ucost:   0.72 * 72,
  ecost:   0.73 * 72,
};
const COL_WIDTHS = Object.values(COLS);

const HEADER_GRAY  = '#D8D8D8';
const ROW_ALT_GRAY = '#F0F0F0';
const SECTION_GRAY = '#F5F5F5';
const BORDER_GRAY  = '#CCCCCC';
const BLACK        = '#000000';
const GRAY_TEXT    = '#666666';

const ROW_H      = 18;
const HDR_CELL_H = 20;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 5;
const FONT_SIZE  = 8;
const FONT_BOLD  = 'Helvetica-Bold';
const FONT_REG   = 'Helvetica';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCost(val) {
  if (val == null) return '';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val) {
  if (!val) return '';
  const d = new Date(val.includes('T') ? val : `${val}T00:00:00`);
  return isNaN(d) ? '' : d.toLocaleDateString('en-US');
}

function truncateText(doc, text, maxWidth, font, size) {
  doc.font(font).fontSize(size);
  if (doc.widthOfString(text) <= maxWidth) return text;
  while (text.length > 0 && doc.widthOfString(text + '…') > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + '…';
}

function fillRect(doc, x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function strokeRect(doc, x, y, w, h, color, lineWidth = 0.5) {
  doc.save().rect(x, y, w, h).lineWidth(lineWidth).stroke(color).restore();
}

function drawDraftPill(doc) {
  const pillW  = 90;
  const pillH  = 18;
  const pillX  = MARGIN + (CONTENT_W - pillW) / 2;
  const pillY  = MARGIN - pillH - 6;
  const radius = pillH / 2;
  doc.save().roundedRect(pillX, pillY, pillW, pillH, radius).fill('#DC2626');
  doc.font(FONT_BOLD).fontSize(7).fillColor('#FFFFFF')
    .text('DRAFT COPY', pillX, pillY + 6.5, { width: pillW, align: 'center', lineBreak: false });
  doc.restore();
}

function drawHeader(doc, po, logoPath, y, isDraft = false) {
  const halfW  = CONTENT_W / 2;
  const thirdW = CONTENT_W / 3;

  if (logoPath) {
    try {
      doc.image(logoPath, MARGIN, y, { width: 1.4 * 72, height: 1.4 * 72 });
    } catch (e) {
      console.error('PDF logo error:', e.message);
    }
  }

  doc.font(FONT_BOLD).fontSize(18).fillColor(BLACK)
    .text('PURCHASE ORDER', MARGIN + halfW, y + 6, { width: halfW, align: 'right' });

  y += 1.4 * 72 + 8;

  const loc      = po.location || {};
  const addr2    = loc.address2 ? `${loc.address2}\n` : '';
  const shipLines = [
    loc.name || '',
    loc.address1 || '',
    addr2 + `${loc.city || ''}, ${loc.province || ''} ${loc.zip || ''}`,
    loc.country || '',
  ].filter(Boolean).join('\n');

  const poDetailsLines = [
    { label: 'PO #:',     value: po.po_number || '' },
    { label: 'Supplier:', value: po.supplier?.supplier_name || '' },
    { label: 'PO Date:',  value: fmtDate(po.po_date) },
    { label: 'Expected:', value: fmtDate(po.expected_date) || '—' },
  ];

  const lineH    = 13;
  const poBoxH   = 12 + 14 + poDetailsLines.length * lineH;
  const shipBoxH = 12 + 14 + shipLines.split('\n').length * lineH;
  const boxH     = Math.max(poBoxH, shipBoxH, 80);

  const cols = [
    { x: MARGIN,              label: 'PO DETAILS',   poDetails: poDetailsLines },
    { x: MARGIN + thirdW,     label: 'SHIP TO',       content: shipLines },
    { x: MARGIN + thirdW * 2, label: 'CONTACT INFO',  content: [
      po.contact_name,
      po.contact_email,
      po.contact_phone,
    ].filter(Boolean).join('\n') || 'Not configured' },
  ];

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const w   = i === 2 ? CONTENT_W - thirdW * 2 : thirdW;
    fillRect(doc, col.x, y, w, boxH, SECTION_GRAY);
    strokeRect(doc, col.x, y, w, boxH, BORDER_GRAY);
    doc.font(FONT_BOLD).fontSize(FONT_SIZE).fillColor(BLACK)
      .text(col.label, col.x + CELL_PAD_X, y + CELL_PAD_Y + 2, { width: w - CELL_PAD_X * 2 });
    const contentY = y + CELL_PAD_Y + 14;
    if (col.poDetails) {
      let rowY = contentY;
      for (const item of col.poDetails) {
        doc.font(FONT_BOLD).fontSize(FONT_SIZE).fillColor(BLACK)
          .text(item.label, col.x + CELL_PAD_X, rowY, { continued: true })
          .font(FONT_REG).text(` ${item.value}`);
        rowY += lineH;
      }
    } else {
      doc.font(FONT_REG).fontSize(FONT_SIZE).fillColor(BLACK)
        .text(col.content || '', col.x + CELL_PAD_X, contentY, { width: w - CELL_PAD_X * 2 });
    }
  }

  if (isDraft) drawDraftPill(doc);
  return y + boxH + 4;
}

function drawNotes(doc, notes, y) {
  if (!notes) return y;
  const labelW   = 0.65 * 72;
  const contentW = CONTENT_W - labelW;
  doc.font(FONT_REG).fontSize(FONT_SIZE);
  const textH = doc.heightOfString(notes, { width: contentW - CELL_PAD_X * 2 });
  const boxH  = Math.max(textH + CELL_PAD_Y * 2, 24);
  fillRect(doc, MARGIN, y, CONTENT_W, boxH, SECTION_GRAY);
  strokeRect(doc, MARGIN, y, CONTENT_W, boxH, BORDER_GRAY);
  strokeRect(doc, MARGIN + labelW, y, contentW, boxH, BORDER_GRAY);
  doc.font(FONT_BOLD).fontSize(FONT_SIZE).fillColor(BLACK)
    .text('NOTES', MARGIN + CELL_PAD_X, y + CELL_PAD_Y, { width: labelW - CELL_PAD_X * 2 });
  doc.font(FONT_REG).fontSize(FONT_SIZE).fillColor(BLACK)
    .text(notes, MARGIN + labelW + CELL_PAD_X, y + CELL_PAD_Y, { width: contentW - CELL_PAD_X * 2 });
  return y + boxH;
}

function drawLineItems(doc, lines, startY, po, logoPath, notes, isDraft = false) {
  const headers = ['SKU', 'Supplier SKU', 'Barcode', 'Title', 'Qty', 'Unit Cost', 'Ext. Cost'];
  const aligns  = ['left', 'left', 'left', 'left', 'right', 'right', 'right'];

  function drawTableHeader(y) {
    let x = MARGIN;
    fillRect(doc, MARGIN, y, CONTENT_W, HDR_CELL_H, HEADER_GRAY);
    strokeRect(doc, MARGIN, y, CONTENT_W, HDR_CELL_H, BORDER_GRAY);
    for (let i = 0; i < COL_WIDTHS.length; i++) {
      const w = COL_WIDTHS[i];
      doc.font(FONT_BOLD).fontSize(FONT_SIZE).fillColor(BLACK)
        .text(headers[i], x + CELL_PAD_X, y + CELL_PAD_Y, {
          width: w - CELL_PAD_X * 2, align: aligns[i], lineBreak: false,
        });
      if (i < COL_WIDTHS.length - 1) {
        doc.save().moveTo(x + w, y).lineTo(x + w, y + HDR_CELL_H)
          .lineWidth(0.25).stroke(BORDER_GRAY).restore();
      }
      x += w;
    }
    return y + HDR_CELL_H;
  }

  let y        = startY;
  let total    = 0;
  let rowIndex = 0;
  y = drawTableHeader(y);

  for (const line of lines) {
    const ext = line.extended_cost != null
      ? line.extended_cost
      : line.order_qty_units * line.unit_cost;
    total += Number(ext);

    doc.font(FONT_REG).fontSize(FONT_SIZE);
    const titleH = doc.heightOfString(line.title || '', { width: COLS.title - CELL_PAD_X * 2 });
    const rowH   = Math.max(ROW_H, titleH + CELL_PAD_Y * 2);

    if (y + rowH > PAGE_BOTTOM) {
      doc.addPage();
      y = drawHeader(doc, po, logoPath, MARGIN, isDraft);
      y += 8;
      if (notes) { y = drawNotes(doc, notes, y); y += 8; }
      y = drawTableHeader(y);
      rowIndex = 0;
    }

    if (rowIndex % 2 === 1) fillRect(doc, MARGIN, y, CONTENT_W, rowH, ROW_ALT_GRAY);

    const values = [
      truncateText(doc, String(line.sku || ''),              COLS.sku     - CELL_PAD_X * 2, FONT_REG, FONT_SIZE),
      truncateText(doc, String(line.supplier_sku || ''),     COLS.supSku  - CELL_PAD_X * 2, FONT_REG, FONT_SIZE),
      truncateText(doc, String(line.supplier_barcode || ''), COLS.barcode - CELL_PAD_X * 2, FONT_REG, FONT_SIZE),
      line.title || '',
      truncateText(doc, String(line.order_qty_units ?? ''),  COLS.qty     - CELL_PAD_X * 2, FONT_REG, FONT_SIZE),
      truncateText(doc, fmtCost(line.unit_cost),             COLS.ucost   - CELL_PAD_X * 2, FONT_REG, FONT_SIZE),
      truncateText(doc, fmtCost(ext),                        COLS.ecost   - CELL_PAD_X * 2, FONT_REG, FONT_SIZE),
    ];

    let x = MARGIN;
    for (let i = 0; i < COL_WIDTHS.length; i++) {
      const w = COL_WIDTHS[i];
      doc.font(FONT_REG).fontSize(FONT_SIZE).fillColor(BLACK)
        .text(values[i], x + CELL_PAD_X, y + CELL_PAD_Y, {
          width: w - CELL_PAD_X * 2, align: aligns[i], lineBreak: i === 3,
        });
      if (i < COL_WIDTHS.length - 1) {
        doc.save().moveTo(x + w, y).lineTo(x + w, y + rowH)
          .lineWidth(0.25).stroke(BORDER_GRAY).restore();
      }
      x += w;
    }

    doc.save().moveTo(MARGIN, y + rowH).lineTo(MARGIN + CONTENT_W, y + rowH)
      .lineWidth(0.25).stroke(BORDER_GRAY).restore();

    y += rowH;
    rowIndex++;
  }

  // Total row
  if (y + ROW_H > PAGE_BOTTOM) {
    doc.addPage();
    y = drawHeader(doc, po, logoPath, MARGIN, isDraft);
    y += 8;
  }
  fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, HEADER_GRAY);
  doc.save().moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
    .lineWidth(0.5).stroke(BORDER_GRAY).restore();

  const totalX      = MARGIN + COL_WIDTHS.slice(0, 5).reduce((a, b) => a + b, 0);
  const totalLabelW = COLS.ucost;
  const totalValW   = COLS.ecost;
  doc.font(FONT_BOLD).fontSize(FONT_SIZE).fillColor(BLACK)
    .text('TOTAL', totalX, y + CELL_PAD_Y, { width: totalLabelW - CELL_PAD_X, align: 'right', lineBreak: false });
  doc.font(FONT_BOLD).fontSize(FONT_SIZE).fillColor(BLACK)
    .text(fmtCost(total), totalX + totalLabelW, y + CELL_PAD_Y, { width: totalValW - CELL_PAD_X, align: 'right', lineBreak: false });

  strokeRect(doc, MARGIN, startY, CONTENT_W, y + ROW_H - startY, BORDER_GRAY);
}

// ── Main export: generate PDF buffer ─────────────────────────────────────────
export async function generatePOPdf(po, lines, isDraft = true) {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const notes    = po.notes_supplier || '';

  const { Writable } = await import('stream');

  // Pass 1 — count pages
  let totalPages = 1;
  const counter  = new PDFDocument({ size: 'LETTER', autoFirstPage: true });
  counter.on('pageAdded', () => totalPages++);
  counter.pipe(new Writable({ write(_, __, cb) { cb(); } }));
  {
    let cy = MARGIN;
    cy = drawHeader(counter, po, logoPath, cy, isDraft);
    cy += 4;
    if (notes) { cy = drawNotes(counter, notes, cy); cy += 8; }
    cy += 8;
    drawLineItems(counter, lines, cy, po, logoPath, notes, isDraft);
  }
  await new Promise(r => { counter.on('end', r); counter.end(); });

  // Pass 2 — render with footers
  let pageNum = 1;
  const doc   = new PDFDocument({ size: 'LETTER', autoFirstPage: true });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  function writeFooterNow() {
    doc.save();
    doc.font(FONT_REG).fontSize(FONT_SIZE).fillColor(GRAY_TEXT);
    const text  = `Page ${pageNum} of ${totalPages}`;
    const textW = doc.widthOfString(text);
    doc.text(text, MARGIN + (CONTENT_W - textW) / 2, PAGE_H - MARGIN + 6, { lineBreak: false });
    doc.restore();
    pageNum++;
  }

  writeFooterNow();
  doc.on('pageAdded', writeFooterNow);

  let y = MARGIN;
  y = drawHeader(doc, po, logoPath, y, isDraft);
  y += 4;
  if (notes) { y = drawNotes(doc, notes, y); y += 8; }
  y += 8;
  drawLineItems(doc, lines, y, po, logoPath, notes, isDraft);

  await new Promise(resolve => { doc.on('end', resolve); doc.end(); });
  return Buffer.concat(chunks);
}

// ── Generate CSV buffer ───────────────────────────────────────────────────────
export function generatePOCsv(po, lines) {
  const BOM = '\uFEFF';

  const fmt     = (val) => (val == null ? '' : String(val));
  const fmtZip  = (val) => (val == null ? '' : `"${String(val)}"`);
  const fmtNum  = (val) => {
    if (val == null) return '';
    const str = String(val);
    return str.startsWith('0') ? `"${str}"` : str;
  };
  const fmtCostCsv = (val) => (val == null ? '' : Number(val).toFixed(2));
  const fmtDateCsv = (val) => {
    if (!val) return '';
    const d = new Date(val.includes('T') ? val : `${val}T00:00:00`);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US');
  };

  const loc = po.location || {};
  const rows = [];

  rows.push([
    'PO Number','PO Date','Expected Date','Supplier Name',
    'Ship To Name','Ship To Address1','Ship To Address2',
    'Ship To City','Ship To Province','Ship To Zip','Ship To Country','Notes',
  ].join(','));

  rows.push([
    fmt(po.po_number),
    fmtDateCsv(po.po_date),
    fmtDateCsv(po.expected_date),
    fmt(po.supplier?.supplier_name),
    fmt(loc.name),
    fmt(loc.address1),
    fmt(loc.address2),
    fmt(loc.city),
    fmt(loc.province),
    fmtZip(loc.zip),
    fmt(loc.country),
    fmt(po.notes_supplier),
  ].join(','));

  rows.push(['Line No','SKU','Supplier SKU','Supplier Barcode','Title','Order Qty Units','Unit Cost','Extended Cost'].join(','));

  for (const line of lines) {
    const ext = line.extended_cost != null
      ? line.extended_cost
      : line.order_qty_units * line.unit_cost;
    rows.push([
      fmt(line.line_no),
      fmtNum(line.sku),
      fmtNum(line.supplier_sku),
      fmtNum(line.supplier_barcode),
      `"${(line.title || '').replace(/"/g, '""')}"`,
      fmt(line.order_qty_units),
      fmtCostCsv(line.unit_cost),
      fmtCostCsv(ext),
    ].join(','));
  }

  return Buffer.from(BOM + rows.join('\r\n'), 'utf-8');
}
