/**
 * The tryout report as a real PDF, made on the phone.
 *
 * Why this exists: an app opened from the iPhone home screen cannot print (the system gives it no
 * print dialog), so "Print, then save as PDF" is a dead end there. This builds the PDF directly and
 * the Share button hands it to Messages, Mail, AirDrop or Files.
 *
 * It shows exactly what the report page shows (reportScope in engine/tryout.ts decides both): only
 * kids somebody marked, only stations somebody scored, every coach's marks side by side and every
 * coach's notes under his own name. It is dressed the same way too: color bar, wordmark or logo,
 * a band in the team color, table heads and each kid's name bar in the team color.
 *
 * Loaded on demand (the PDF library is big), so it is imported with import() from the Board.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Tryout } from '../engine/types';
import { NOTE_STATION } from '../engine/types';
import { reportScope, reportColors, reportStationName, reportSessionName, wearingOn, fmt, DECISION_LABEL, SCALE_RULE, SPLIT_AT, type BoardRow, type BoardReportOpts } from '../engine/tryout';
import { hexToRgb } from '../engine/brand';

type RGB = [number, number, number];
const INK: RGB = [22, 32, 46];
const MUTED: RGB = [91, 102, 128];
const LINE: RGB = [205, 214, 227];
const SPLIT: RGB = [255, 243, 214];
const WHITE: RGB = [255, 255, 255];
const rgb = (hex: string, fallback: RGB): RGB => (hexToRgb(hex) as RGB | null) ?? fallback;

/**
 * The built-in PDF fonts only know Western European letters. Swap the few typographic characters
 * we use for plain ones and strip accents the font cannot draw, so nothing prints as garbage.
 */
export function pdfSafe(s: string): string {
  return s
    .replace(/[\u2013\u2014\u2212]/g, '-') // dashes and the minus sign
    .replace(/[\u2022\u00b7]/g, '-') // bullet and middle dot
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u0141/g, 'L').replace(/\u0142/g, 'l')
    .replace(/[^\u0000-\u00ff]/g, (ch) => {
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return base && /^[\u0000-\u00ff]+$/.test(base) ? base : '?';
    });
}

/** A file name a phone will accept: "Warriors-tryouts-Mon-Nov-23.pdf". */
export function tryoutPdfName(t: Tryout, sessionLabel: string): string {
  const slug = pdfSafe(`${t.name} ${sessionLabel}`).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'tryout-report'}.pdf`;
}

export function buildTryoutPdf(t: Tryout, rows: BoardRow[], opts: BoardReportOpts, compress = true): Uint8Array {
  const { shown, ran, left, anyLean, anyDecision, noteNights, sideways } = reportScope(t, rows);
  const colors = reportColors(opts.brand);
  const brand = colors.b;
  const P = rgb(colors.primary, INK);
  const A = rgb(colors.accent, MUTED);
  const SOFT = rgb(colors.soft, [238, 243, 249]);
  const SOFTER = rgb(colors.softer, [246, 249, 252]);
  const ON_A = rgb(colors.onAccent, WHITE);
  const A_TEXT = rgb(colors.accentText, MUTED);
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: sideways ? 'landscape' : 'portrait', compress });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const CW = W - 2 * M;
  const TOP = M + 6; // where a continuation page starts, under its color bar
  const bottom = H - 46;
  let y = 0;

  type TextOpts = { size?: number; bold?: boolean; color?: RGB; space?: number; right?: boolean };
  const widthOf = (s: string, o: TextOpts) => { doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size ?? 10); return doc.getTextWidth(s) + (o.space ?? 0) * Math.max(0, s.length - 1); };
  /** One line of text. With `right`, x is the right edge. */
  const text = (raw: string, x: number, yy: number, o: TextOpts = {}) => {
    const s = pdfSafe(raw);
    const w = widthOf(s, o);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(s, o.right ? x - w : x, yy, o.space ? { charSpace: o.space } : undefined);
    return w;
  };
  const fill = (c: RGB, x: number, yy: number, w: number, h: number, r = 0) => { doc.setFillColor(...c); if (r) doc.roundedRect(x, yy, w, h, r, r, 'F'); else doc.rect(x, yy, w, h, 'F'); };
  const colorBar = () => { fill(P, 0, 0, W, 12); fill(A, 0, 12, W, 4); };
  const newPage = () => { doc.addPage(); colorBar(); y = TOP; };
  const need = (h: number) => { if (y + h > bottom) newPage(); };
  const wrap = (s: string, width: number, o: TextOpts = {}): string[] => { doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size ?? 10); return doc.splitTextToSize(pdfSafe(s), width); };
  /** Wrapped text that moves down the page and onto the next one when it runs out of room. */
  const para = (s: string, x: number, width: number, o: TextOpts & { gap?: number } = {}) => {
    const size = o.size ?? 10;
    for (const line of wrap(s, width, o)) { need(size * 1.35); text(line, x, y + size, o); y += size * 1.35; }
    y += o.gap ?? 0;
  };
  const kidName = (r: BoardRow) => `${r.candidate.number ? `#${r.candidate.number} ` : ''}${r.candidate.name}`;

  // ---- Letterhead -------------------------------------------------------------------------
  colorBar();
  y = 30;
  const headH = 58;
  if (brand?.wordmark) {
    try { doc.addImage(brand.wordmark.src, 'PNG', M, y, headH * brand.wordmark.ratio, headH); } catch { text(brand.name.toUpperCase(), M, y + 36, { size: 22, bold: true, color: P }); }
  } else if (brand) {
    let x = M;
    if (brand.logo && /^data:image\/(png|jpe?g)/i.test(brand.logo)) {
      try { doc.addImage(brand.logo, /^data:image\/png/i.test(brand.logo) ? 'PNG' : 'JPEG', M, y + 4, 50, 50); x = M + 60; } catch { /* a logo the PDF cannot read is left off; the report still prints */ }
    }
    // The name shares the line with the title block: shrink it to fit, then let it take two lines.
    const titleW = widthOf('TRYOUT REPORT', { size: 18, bold: true, space: 2.2 });
    const room = W - M - titleW - 18 - x;
    const name = brand.name.toUpperCase();
    let size = 21;
    while (size > 13 && widthOf(pdfSafe(name), { size, bold: true }) > room) size -= 1;
    const lines = wrap(name, room, { size, bold: true }).slice(0, 2);
    lines.forEach((line, i) => text(line, x, y + (lines.length > 1 ? 26 : 37) + i * (size + 3), { size, bold: true, color: P }));
  }
  text('TRYOUT REPORT', W - M, y + 22, { size: 18, bold: true, color: P, space: 2.2, right: true });
  text(t.name, W - M, y + 38, { size: 11, bold: true, color: A_TEXT, right: true });
  text(`${opts.sessionLabel} - as of ${opts.asOf}`, W - M, y + 52, { size: 9, color: MUTED, right: true });
  y += headH + 12;

  // The band
  fill(P, 0, y, W, 26);
  text(brand?.tagline || brand?.name || 'Tryout report', M, y + 17, { size: 10, bold: true, color: WHITE, space: 0.3 });
  {
    const label = 'COACHES ONLY';
    const w = widthOf(label, { size: 8, bold: true, space: 1.2 }) + 20;
    fill(A, W - M - w, y + 5, w, 16, 8);
    text(label, W - M - w + 10, y + 16, { size: 8, bold: true, color: ON_A, space: 1.2 });
  }
  y += 26 + 16;

  {
    const lead = 'Scored by ';
    const w1 = text(lead, M, y, { size: 10 });
    const who = opts.coaches.join(', ') || 'no one yet';
    const w2 = text(who, M + w1, y, { size: 10, bold: true, color: P });
    text(`  -  ${shown.length} ${shown.length === 1 ? 'kid' : 'kids'}  -  ${ran.length} ${ran.length === 1 ? 'station' : 'stations'}`, M + w1 + w2, y, { size: 10 });
    y += 12;
  }

  // Coaches-only box
  {
    const lines = wrap(`For coaches only. Do not share with families or players. ${SCALE_RULE} Each number in the summary is the average of the coaches who scored it, so higher is better. A shaded box means two coaches were ${SPLIT_AT} or more apart: talk about that one. A dash means that coach did not score it. This is a copy from the time shown above; marks changed after that are only in the app.`, CW - 24, { size: 9.5 });
    const h = lines.length * 12.5 + 12;
    fill(SOFTER, M, y, CW, h);
    fill(A, M, y, 4, h);
    lines.forEach((line, i) => text(line, M + 14, y + 15 + i * 12.5, { size: 9.5 }));
    y += h + 18;
  }

  const heading = (s: string) => {
    need(70);
    text(s.toUpperCase(), M, y + 10, { size: 10, bold: true, color: P, space: 1.8 });
    y += 16;
    fill(A, M, y, CW, 2.2);
    y += 10;
  };
  const cellPad = { top: 5, bottom: 5, left: 7, right: 7 };

  if (!shown.length) {
    para('No marks yet.', M, CW);
  } else {
    // ---- Summary ---------------------------------------------------------------------------
    heading('Summary');
    autoTable(doc, {
      theme: 'plain',
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: 54 },
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: cellPad, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.6 } as any, overflow: 'linebreak' },
      headStyles: { fillColor: P, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5, lineWidth: 0 as any },
      alternateRowStyles: { fillColor: SOFTER },
      rowPageBreak: 'avoid',
      willDrawPage: () => { if (doc.getCurrentPageInfo().pageNumber > 1) colorBar(); },
      head: [['Kid', 'Overall', ...ran.map(({ st }) => pdfSafe(st.label)), ...(anyLean ? ['Yes / Maybe / No'] : []), ...(anyDecision ? ['Decision'] : [])]],
      body: shown.map((r) => {
        const scoredHere = ran.filter(({ i }) => r.cells[i].avg !== undefined).length;
        return [
          { content: pdfSafe(kidName(r)), styles: { fontStyle: 'bold' as const } },
          { content: `${pdfSafe(fmt(r.overall))}   ${scoredHere} of ${ran.length}`, styles: { fontStyle: 'bold' as const, textColor: P } },
          ...ran.map(({ i }) => ({ content: pdfSafe(fmt(r.cells[i].avg)), styles: r.cells[i].split ? { fillColor: SPLIT } : {} })),
          ...(anyLean ? [`${r.leans.yes.length} / ${r.leans.maybe.length} / ${r.leans.no.length}`] : []),
          ...(anyDecision ? [r.candidate.decision ? DECISION_LABEL[r.candidate.decision] : ''] : [])
        ];
      })
    });
    y = (doc as any).lastAutoTable.finalY + 20;

    // ---- Kid by kid ------------------------------------------------------------------------
    let headed = false;
    const pad = 12;
    const gap = 22;
    const leftW = (CW - 2 * pad - gap) * 0.5;
    const rightX = M + pad + leftW + gap;
    const rightW = CW - 2 * pad - gap - leftW;
    for (const r of shown) {
      const c = r.candidate;
      const scorers = [...new Set(ran.flatMap(({ i }) => r.cells[i].byCoach.map((x) => x.by)))].sort((a, b) => a.localeCompare(b));
      const scoredStations = ran.filter(({ i }) => r.cells[i].avg !== undefined);
      const wearing = wearingOn(c, t, opts.sessionId);
      const meta = [c.positions, c.team, c.note].filter(Boolean).join(' - ');
      const lean = [r.leans.yes.length ? `Yes: ${r.leans.yes.join(', ')}` : '', r.leans.maybe.length ? `Maybe: ${r.leans.maybe.join(', ')}` : '', r.leans.no.length ? `No: ${r.leans.no.join(', ')}` : ''].filter(Boolean).join('   ');
      const decision = c.decision ? `Decision: ${DECISION_LABEL[c.decision]}${c.decisionNote ? `. ${c.decisionNote}` : ''}` : '';
      const writers = [...new Set(r.notes.map((n) => n.by))].sort((a, b) => a.localeCompare(b));
      // The notes, laid out ahead of time so the card's height is known before anything is drawn.
      const noteLines: Array<{ kind: 'coach' | 'note' | 'more' | 'none'; s: string }> = [];
      for (const by of writers) {
        noteLines.push({ kind: 'coach', s: by });
        for (const n of r.notes.filter((x) => x.by === by)) {
          const where = n.stationId === NOTE_STATION ? '' : `${reportStationName(t, n.stationId)}: `;
          const night = !opts.sessionId && noteNights > 1 && reportSessionName(t, n.sessionId) ? ` (${reportSessionName(t, n.sessionId)})` : '';
          wrap(`${where}${n.text}${night}`, rightW - 22, { size: 9.5 }).forEach((line, i) => noteLines.push({ kind: i === 0 ? 'note' : 'more', s: line }));
        }
      }
      if (!writers.length) noteLines.push({ kind: 'none', s: 'No written notes.' });
      const lineH = (k: string) => (k === 'coach' ? 17 : 12.5);
      const notesH = 20 + noteLines.reduce((sum, l) => sum + lineH(l.kind), 0);
      const tableH = scorers.length ? (scoredStations.length + 2) * 20 + 2 : 16;
      const extras = (lean ? wrap(`Take him?  ${lean}`, leftW, { size: 9.5, bold: true }).length * 13 + 6 : 0) + (decision ? wrap(decision, leftW, { size: 9.5, bold: true }).length * 13 + 4 : 0);
      const headBar = meta ? 42 : 32;
      const wearLines = wearing ? wrap(`Wearing: ${wearing}`, CW - 2 * pad, { size: 9 }) : [];
      const wearH = wearLines.length ? wearLines.length * 12 + 8 : 0;
      const bodyH = Math.max(tableH + extras, notesH) + 20;
      const cardH = headBar + 4 + wearH + bodyH;
      // A card stays whole on a page. One taller than a page (a lot of notes) starts on a fresh page and runs on.
      // The section heading travels with the first card, never alone at the foot of a page.
      // A card that fits stays whole. One that does not fit starts here anyway when its marks do and
      // there is real room left, and its notes run on to the next page; otherwise it starts a fresh page.
      const lead = headed ? 0 : 28;
      const marksH = headBar + 4 + wearH + tableH + extras + 30;
      const room = bottom - y - lead;
      if (cardH > room && !(marksH <= room && room >= 220)) newPage();
      if (!headed) { heading('Kid by kid'); headed = true; }
      const cardTop = y;

      // Name bar
      fill(P, M, y, CW, headBar);
      fill(A, M, y + headBar, CW, 4);
      text(kidName(r), M + pad, y + (meta ? 18 : 21), { size: 13.5, bold: true, color: WHITE });
      if (meta) text(wrap(meta, CW - 2 * pad - 90, { size: 9 })[0] ?? '', M + pad, y + 33, { size: 9, color: [214, 224, 238] });
      {
        const bw = 64;
        const bh = headBar - 12;
        fill(A, M + CW - pad - bw, y + 6, bw, bh, 5);
        const lab = 'OVERALL';
        text(lab, M + CW - pad - bw / 2 - widthOf(lab, { size: 6.5, bold: true, space: 1 }) / 2, y + 15, { size: 6.5, bold: true, color: ON_A, space: 1 });
        const val = pdfSafe(fmt(r.overall));
        text(val, M + CW - pad - bw / 2 - widthOf(val, { size: 14, bold: true }) / 2, y + (meta ? 31 : 27), { size: meta ? 14 : 11, bold: true, color: ON_A });
      }
      y += headBar + 4;
      if (wearLines.length) {
        fill(SOFT, M, y, CW, wearH);
        wearLines.forEach((line, i) => text(line, M + pad, y + 13 + i * 12, { size: 9, color: [43, 56, 82] }));
        y += wearH;
      }
      const bodyTop = y + 8;

      // Left: the marks
      let leftY = bodyTop;
      if (scorers.length) {
        autoTable(doc, {
          theme: 'plain',
          startY: leftY,
          margin: { left: M + pad, right: W - (M + pad + leftW), top: TOP, bottom: 54 },
          tableWidth: leftW,
          pageBreak: 'avoid',
          rowPageBreak: 'avoid',
          styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 4.5, bottom: 4.5, left: 5, right: 5 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.6 } as any },
          headStyles: { fontStyle: 'bold', fontSize: 8, textColor: P, lineColor: A, lineWidth: { bottom: 1.6 } as any },
          willDrawPage: () => { if (doc.getCurrentPageInfo().pageNumber > 1) colorBar(); },
          head: [['STATION', ...scorers.map((s) => pdfSafe(s).toUpperCase()), 'AVERAGE']],
          body: [
            ...scoredStations.map(({ st, i }) => {
              const cell = r.cells[i];
              const tone = cell.split ? { fillColor: SPLIT } : {};
              return [
                { content: pdfSafe(st.label), styles: tone },
                ...scorers.map((by) => { const v = cell.byCoach.find((x) => x.by === by); return { content: v ? fmt(v.value) : '-', styles: tone }; }),
                { content: pdfSafe(fmt(cell.avg)), styles: { ...tone, fontStyle: 'bold' as const } }
              ];
            }),
            [{ content: 'Overall', styles: { fontStyle: 'bold' as const, textColor: P, lineWidth: 0 as any } }, ...scorers.map(() => ({ content: '', styles: { lineWidth: 0 as any } })), { content: pdfSafe(fmt(r.overall)), styles: { fontStyle: 'bold' as const, textColor: P, lineWidth: 0 as any } }]
          ]
        });
        leftY = (doc as any).lastAutoTable.finalY + 6;
      } else {
        text('No station marks.', M + pad, leftY + 10, { size: 9, color: MUTED });
        leftY += 18;
      }
      for (const line of lean ? wrap(`Take him?  ${lean}`, leftW, { size: 9.5, bold: true }) : []) { text(line, M + pad, leftY + 10, { size: 9.5, bold: true }); leftY += 13; }
      if (lean) leftY += 4;
      for (const line of decision ? wrap(decision, leftW, { size: 9.5, bold: true }) : []) { text(line, M + pad, leftY + 10, { size: 9.5, bold: true, color: P }); leftY += 13; }

      // Right: what the coaches wrote, each under his own name
      let ry = bodyTop;
      let segTop = cardTop; // top of the card's outline on the page being drawn
      const outline = (from: number, to: number) => { doc.setDrawColor(...LINE); doc.setLineWidth(0.8); doc.rect(M, from, CW, to - from, 'S'); };
      text('WHAT THE COACHES WROTE', rightX, ry + 10, { size: 8, bold: true, color: P, space: 0.6 });
      ry += 15;
      fill(A, rightX, ry, rightW, 1.6);
      ry += 5;
      let barFrom = ry;
      const bar = (to: number) => { if (writers.length && to > barFrom) fill(A, rightX, barFrom, 2.2, to - barFrom); };
      for (const l of noteLines) {
        const h = lineH(l.kind);
        if (ry + h > bottom) {
          bar(ry);
          outline(segTop, bottom + 4);
          newPage();
          segTop = y - 6;
          ry = y + 4;
          barFrom = ry;
        }
        if (l.kind === 'coach') { text(l.s, rightX + 10, ry + 13, { size: 10, bold: true, color: P }); }
        else if (l.kind === 'none') { text(l.s, rightX, ry + 10, { size: 9, color: MUTED }); }
        else {
          if (l.kind === 'note') text('-', rightX + 10, ry + 9.5, { size: 9.5, color: A_TEXT, bold: true });
          text(l.s, rightX + 20, ry + 9.5, { size: 9.5 });
        }
        ry += h;
      }
      bar(ry);
      const sameSpread = segTop === cardTop;
      const cardBottom = Math.max(sameSpread ? leftY : 0, ry) + 10;
      outline(segTop, cardBottom);
      y = cardBottom + 14;
    }
  }

  if (left) { need(30); para(left, M, CW, { size: 9, color: MUTED, gap: 4 }); }

  // Every page: who it is for, whose it is, and where it sits in the stack.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    fill(P, M, H - 36, CW, 1.6);
    if (brand) text(brand.footer || brand.name, M, H - 22, { size: 8.5, bold: true, color: P });
    const mid = 'For coaches only. Do not share with families or players.';
    text(mid, W / 2 - widthOf(mid, { size: 8 }) / 2, H - 22, { size: 8, color: MUTED });
    text(`Page ${i} of ${pages}`, W - M, H - 22, { size: 8, color: MUTED, right: true });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
