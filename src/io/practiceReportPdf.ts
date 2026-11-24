/**
 * The practice report as a PDF, made on the phone: one kid, one practice, for his family.
 *
 * Same letterhead as the tryout report (color bar, wordmark or logo, a band in the team color), so
 * everything that leaves the app looks like it came from the same program. What it says comes from
 * a PracticeReport (src/engine/practiceReport.ts); this file only draws it.
 *
 * Loaded on demand with import(), like the tryout PDF.
 */
import { jsPDF } from 'jspdf';
import type { PracticeReport } from '../engine/practiceReport';
import { reportColors } from '../engine/tryout';
import { hexToRgb } from '../engine/brand';
import { pdfSafe } from './tryoutPdf';

type RGB = [number, number, number];
const INK: RGB = [22, 32, 46];
const MUTED: RGB = [91, 102, 128];
const LINE: RGB = [205, 214, 227];
const WHITE: RGB = [255, 255, 255];
const SAMPLE_BG: RGB = [255, 243, 214];
const SAMPLE_INK: RGB = [122, 78, 0];
const rgb = (hex: string, fallback: RGB): RGB => (hexToRgb(hex) as RGB | null) ?? fallback;

export function buildPracticeReportPdf(r: PracticeReport, compress = true): Uint8Array {
  const colors = reportColors(r.brand);
  const brand = colors.b;
  const P = rgb(colors.primary, INK);
  const A = rgb(colors.accent, MUTED);
  const SOFT = rgb(colors.soft, [238, 243, 249]);
  const SOFTER = rgb(colors.softer, [246, 249, 252]);
  const ON_A = rgb(colors.onAccent, WHITE);
  const A_TEXT = rgb(colors.accentText, MUTED);
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const CW = W - 2 * M;
  const TOP = M + 6;
  const bottom = H - 58;
  let y = 0;

  type TextOpts = { size?: number; bold?: boolean; italic?: boolean; color?: RGB; space?: number; right?: boolean };
  const font = (o: TextOpts) => { doc.setFont('helvetica', o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal'); doc.setFontSize(o.size ?? 10); };
  const widthOf = (s: string, o: TextOpts = {}) => { font(o); return doc.getTextWidth(pdfSafe(s)) + (o.space ?? 0) * Math.max(0, s.length - 1); };
  /** One line of text. With `right`, x is the right edge. Returns its width. */
  const text = (raw: string, x: number, yy: number, o: TextOpts = {}) => {
    const s = pdfSafe(raw);
    const w = widthOf(s, o);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(s, o.right ? x - w : x, yy, o.space ? { charSpace: o.space } : undefined);
    return w;
  };
  const fill = (c: RGB, x: number, yy: number, w: number, h: number, rad = 0) => { doc.setFillColor(...c); if (rad) doc.roundedRect(x, yy, w, h, rad, rad, 'F'); else doc.rect(x, yy, w, h, 'F'); };
  const colorBar = () => { fill(P, 0, 0, W, 12); fill(A, 0, 12, W, 4); };
  const newPage = () => { doc.addPage(); colorBar(); y = TOP; };
  const need = (h: number) => { if (y + h > bottom) newPage(); };
  const wrap = (s: string, width: number, o: TextOpts = {}): string[] => { font(o); return doc.splitTextToSize(pdfSafe(s), width); };
  /**
   * Layout is done in blocks: a block knows its height before it is drawn, so two columns can sit
   * side by side when they fit and fall back to one under the other when they do not.
   */
  type Block = { h: number; draw: (x: number, yy: number) => void };
  const headingBlock = (label: string, w: number): Block => ({
    h: 26,
    draw: (x, yy) => { text(label.toUpperCase(), x, yy + 10, { size: 10, bold: true, color: P, space: 1.8 }); fill(A, x, yy + 15, w, 2); }
  });
  /** A bulleted item. `lead` is drawn bold in the team color and the rest wraps after it. */
  const bulletBlock = (lead: string, body: string, w: number, o: { size?: number; after?: number; sub?: string } = {}): Block => {
    const size = o.size ?? 10.5;
    const lh = size * 1.38;
    const leadW = lead ? widthOf(`${lead} `, { size, bold: true }) : 0;
    // The first line is shorter by the width of the lead: wrap it on its own, then the rest at full width.
    const firstFit = wrap(body, w - 14 - leadW, { size });
    const firstLine = firstFit[0] ?? '';
    const rest = firstFit.length > 1 ? wrap(pdfSafe(body).slice(firstLine.length).trim(), w - 14, { size }) : [];
    const sub = o.sub ? wrap(o.sub, w - 14, { size: 9.5, italic: true }) : [];
    return {
      h: lh * (1 + rest.length) + sub.length * 13 + (sub.length ? 2 : 0) + (o.after ?? 4),
      draw: (x, yy) => {
        fill(A, x + 3, yy + size * 0.42, 4, 4, 2);
        if (lead) text(lead, x + 14, yy + size, { size, bold: true, color: P });
        text(firstLine, x + 14 + leadW, yy + size, { size });
        let ly = yy + lh;
        for (const line of rest) { text(line, x + 14, ly + size, { size }); ly += lh; }
        for (const line of sub) { text(line, x + 14, ly + 9.5, { size: 9.5, italic: true, color: A_TEXT }); ly += 13; }
      }
    };
  };
  const spacer = (h: number): Block => ({ h, draw: () => undefined });
  /** Blocks one under another at x, moving to a new page when one does not fit. */
  const flow = (blocks: Block[], x: number) => { for (const bl of blocks) { need(bl.h); bl.draw(x, y); y += bl.h; } };
  const heightOf = (blocks: Block[]) => blocks.reduce((sum, bl) => sum + bl.h, 0);
  const GAP = 24;
  /** Two columns side by side when both fit on a page together; otherwise one after the other at full width. */
  const row = (make: (w: number) => Block[], makeRight: (w: number) => Block[], share = 0.5) => {
    const lw = (CW - GAP) * share;
    const rw = CW - GAP - lw;
    const left = make(lw);
    const right = makeRight(rw);
    if (!left.length || !right.length) { flow(left.length ? make(CW) : makeRight(CW), M); return; }
    const h = Math.max(heightOf(left), heightOf(right));
    if (h > bottom - TOP) { flow(make(CW), M); y += 6; flow(makeRight(CW), M); return; }
    need(h);
    const top = y;
    let ly = top; for (const bl of left) { bl.draw(M, ly); ly += bl.h; }
    let ry = top; for (const bl of right) { bl.draw(M + lw + GAP, ry); ry += bl.h; }
    y = top + h;
  };

  // ---- Letterhead -------------------------------------------------------------------------
  colorBar();
  y = 30;
  const headH = 52;
  const title = 'PRACTICE REPORT';
  const titleOpts = { size: 18, bold: true, space: 2.2 };
  if (brand?.wordmark) {
    try { doc.addImage(brand.wordmark.src, 'PNG', M, y, headH * brand.wordmark.ratio, headH); } catch { text(brand.name.toUpperCase(), M, y + 36, { size: 22, bold: true, color: P }); }
  } else if (brand) {
    let x = M;
    if (brand.logo && /^data:image\/(png|jpe?g)/i.test(brand.logo)) {
      try { doc.addImage(brand.logo, /^data:image\/png/i.test(brand.logo) ? 'PNG' : 'JPEG', M, y + 4, 50, 50); x = M + 60; } catch { /* a logo the PDF cannot read is left off; the report still prints */ }
    }
    const room = W - M - widthOf(title, titleOpts) - 18 - x;
    const name = brand.name.toUpperCase();
    let size = 21;
    while (size > 13 && widthOf(name, { size, bold: true }) > room) size -= 1;
    const lines = wrap(name, room, { size, bold: true }).slice(0, 2);
    lines.forEach((line, i) => text(line, x, y + (lines.length > 1 ? 26 : 37) + i * (size + 3), { size, bold: true, color: P }));
  }
  text(title, W - M, y + 21, { ...titleOpts, color: P, right: true });
  text(r.dateLabel, W - M, y + 37, { size: 11, bold: true, color: A_TEXT, right: true });
  if (r.practiceTitle) text(r.practiceTitle, W - M, y + 50, { size: 9, color: MUTED, right: true });
  y += headH + 12;

  // The band
  fill(P, 0, y, W, 26);
  text(brand?.tagline || brand?.name || 'Practice report', M, y + 17, { size: 10, bold: true, color: WHITE, space: 0.3 });
  {
    const label = `FOR ${r.firstName.toUpperCase()}'S FAMILY`;
    const w = widthOf(label, { size: 8, bold: true, space: 1.2 }) + 20;
    fill(A, W - M - w, y + 5, w, 16, 8);
    text(label, W - M - w + 10, y + 16, { size: 8, bold: true, color: ON_A, space: 1.2 });
  }
  y += 26;

  if (r.sample) {
    fill(SAMPLE_BG, 0, y, W, 20);
    const s = 'SAMPLE REPORT. The notes and numbers below are made up to show what a family receives.';
    text(s, W / 2 - widthOf(s, { size: 9, bold: true }) / 2, y + 13.5, { size: 9, bold: true, color: SAMPLE_INK });
    y += 20;
  }
  y += 14;

  // ---- The kid ----------------------------------------------------------------------------
  {
    const h = 48;
    fill(P, M, y, CW, h, 6);
    fill(A, M, y + h - 5, CW, 5);
    fill(P, M, y + h - 9, CW, 4); // square off the rounded bar where the accent strip sits under it
    text(`${r.playerName}${r.number ? `  #${r.number}` : ''}`, M + 16, y + 26, { size: 20, bold: true, color: WHITE });
    text(`What ${r.firstName} worked on and what the coaches saw`, M + 16, y + 39, { size: 9, color: [214, 224, 238] });
    y += h + 12;
  }

  // ---- A note from the coach, first, because it is the part a parent reads twice ------------------
  if (r.coachNote?.text.trim()) {
    const lines = wrap(r.coachNote.text, CW - 34, { size: 10.5, italic: true });
    const h = lines.length * 14.5 + 30;
    need(h);
    fill(SOFTER, M, y, CW, h, 6);
    fill(A, M, y, 4, h);
    lines.forEach((line, i) => text(line, M + 18, y + 19 + i * 14.5, { size: 10.5, italic: true }));
    text(r.coachNote.by, M + CW - 14, y + h - 9, { size: 9.5, bold: true, color: P, right: true });
    y += h + 12;
  }

  // ---- What we worked on: one short paragraph, because the notes matter more than the drill list ----
  if (r.worked.length) {
    const label = 'TONIGHT';
    const lw = widthOf(label, { size: 9, bold: true, space: 1.6 }) + 10;
    const body = r.worked.map((it) => `${it.area}: ${it.what}`).join('.  ') + '.';
    const first = wrap(body, CW - lw, { size: 9.5 });
    const rest = first.length > 1 ? wrap(pdfSafe(body).slice(first[0].length).trim(), CW, { size: 9.5 }) : [];
    need(13 * (1 + rest.length) + 8);
    text(label, M, y + 9.5, { size: 9, bold: true, color: P, space: 1.6 });
    text(first[0] ?? '', M + lw, y + 9.5, { size: 9.5, color: MUTED });
    y += 13;
    for (const line of rest) { text(line, M, y + 9.5, { size: 9.5, color: MUTED }); y += 13; }
    y += 12;
  }

  // ---- What the coaches saw, next to the numbers -----------------------------------------------------
  /** Effort and attitude as chips under the notes; they say what they are, so they carry no heading. */
  const effortBlocks = (w: number): Block[] => {
    if (!r.effort.length) return [];
    const chips: Array<{ label: string; x: number; yy: number; w: number }> = [];
    let cx = 0; let cy = 0;
    for (const e of r.effort) {
      const cw = Math.min(w, widthOf(e, { size: 9.5, bold: true }) + 22);
      if (cx + cw > w && cx > 0) { cx = 0; cy += 24; }
      chips.push({ label: e, x: cx, yy: cy, w: cw });
      cx += cw + 8;
    }
    return [spacer(6), { h: cy + 19 + 4, draw: (x, yy) => chips.forEach((c) => { fill(SOFT, x + c.x, yy + c.yy, c.w, 19, 9.5); text(c.label, x + c.x + 11, yy + c.yy + 13, { size: 9.5, bold: true, color: P }); }) }];
  };
  const winsBlocks = (w: number): Block[] => {
    const chips = effortBlocks(w);
    if (!r.wins.length && !chips.length) return [];
    return [headingBlock('What the coaches saw', w), ...r.wins.map((x) => bulletBlock(x.by ? `${x.by}:` : '', x.text, w, { size: 10.2 })), ...chips];
  };
  const countsBlocks = (w: number): Block[] => {
    if (!r.counts.length) return [];
    const bars = r.counts.map((c): Block => ({
      h: c.before && c.before.of > 0 ? 39 : 30,
      draw: (x, yy) => {
        text(c.skill, x, yy + 10, { size: 10, bold: true });
        text(`${c.good} of ${c.of}${c.word ? ` ${c.word}` : ''}`, x + w, yy + 10, { size: 10, bold: true, color: P, right: true });
        if (c.before && c.before.of > 0) text(`Last practice: ${c.before.good} of ${c.before.of}`, x, yy + 32, { size: 8, color: MUTED });
        fill(SOFT, x, yy + 15, w, 8, 4);
        const share = c.of > 0 ? Math.max(0, Math.min(1, c.good / c.of)) : 0;
        if (share > 0) fill(A, x, yy + 15, Math.max(8, w * share), 8, 4);
      }
    }));
    const cap = wrap('Reps the coaches counted during drills. Small counts move around from night to night, so read them next to the notes.', w, { size: 8.5 });
    return [headingBlock('By the numbers', w), ...bars, { h: cap.length * 11 + 4, draw: (x, yy) => cap.forEach((line, i) => text(line, x, yy + 9 + i * 11, { size: 8.5, color: MUTED })) }];
  };
  if (!r.wins.length && !r.effort.length && !r.counts.length) {
    const lines = wrap(`The coaches did not write notes on ${r.firstName} at this practice. That is not a comment on him: on a busy night they get to some kids and not others.`, CW, { size: 10 });
    need(lines.length * 14 + 8);
    lines.forEach((line, i) => text(line, M, y + 10 + i * 14, { size: 10, color: MUTED }));
    y += lines.length * 14 + 14;
  } else {
    row(winsBlocks, countsBlocks, 0.56);
    y += 14;
  }

  // ---- Working on next, next to what to do at home ------------------------------------------------------
  const focusBlocks = (w: number): Block[] => (r.workingOn.length ? [headingBlock('Working on next', w), ...r.workingOn.map((f) => bulletBlock('', f.text, w, { size: 10.2, sub: f.cue ? `What we say to him: "${f.cue}"` : undefined, after: 7 }))] : []);
  const homeBlocks = (w: number): Block[] => {
    if (!r.home.length) return [];
    const pad = 12;
    const items = r.home.map((d) => ({ d, lines: wrap(d.how, w - 2 * pad, { size: 9.5 }) }));
    const total = r.home.reduce((sum, d) => sum + (d.minutes ?? 0), 0);
    const h = 34 + items.reduce((sum, it) => sum + 14 + it.lines.length * 12.5 + 6, 0) + (total ? 14 : 0);
    return [{
      h: h + 4,
      draw: (x, yy) => {
        fill(SOFTER, x, yy, w, h, 6);
        fill(A, x, yy, 4, h);
        let ly = yy + 19;
        text('AT HOME THIS WEEK', x + pad, ly, { size: 10, bold: true, color: P, space: 1.8 });
        ly += 10;
        for (const it of items) {
          text(it.d.name, x + pad, ly + 10, { size: 10, bold: true });
          if (it.d.minutes) text(`${it.d.minutes} min`, x + w - pad, ly + 10, { size: 9, bold: true, color: A_TEXT, right: true });
          ly += 14;
          it.lines.forEach((line) => { text(line, x + pad, ly + 9.5, { size: 9.5 }); ly += 12.5; });
          ly += 6;
        }
        if (total) text(`About ${total} minutes, two or three times this week.`, x + pad, ly + 9, { size: 8.5, color: MUTED });
      }
    }];
  };
  row(focusBlocks, homeBlocks, 0.5);

  // ---- Every page: who to ask, and whose it is ----------------------------------------------------
  const pages = doc.getNumberOfPages();
  const ask = r.coaches.length ? `Questions? Ask ${r.coaches.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(' or ')}.` : '';
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    fill(P, M, H - 50, CW, 1.6);
    if (ask) text(ask, M, H - 36, { size: 8.5, bold: true, color: P });
    text('These are the coaches\' notes from one practice, meant to help at home. Nothing here is a ranking.', M, H - 24, { size: 8, color: MUTED });
    if (brand) text(brand.footer || brand.name, W - M, H - 36, { size: 8.5, bold: true, color: P, right: true });
    if (pages > 1) text(`Page ${i} of ${pages}`, W - M, H - 24, { size: 8, color: MUTED, right: true });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
