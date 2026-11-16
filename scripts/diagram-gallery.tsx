/**
 * Draws every diagram, every version, to plain HTML pages so a person can look at each one next to the drill's own words.
 * Run: npm run diagrams            (whole pictures, into scripts/shots/diagrams)
 * Or:  node <bundle> <outDir> steps td-001,br-003   (one picture per step, only those drills)
 * The rules in tests/diagrams.test.ts catch what cannot happen; this is for what only eyes can judge.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { DIAGRAMS } from '../src/data/diagrams';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { DrillDiagram } from '../src/ui/components/DrillDiagram';

const out = process.argv[2] ?? 'gallery';
const withSteps = process.argv[3] === 'steps';
const only = process.argv[4]?.split(',');
mkdirSync(out, { recursive: true });
const css = `body{font:13px system-ui;margin:0;padding:10px;background:#f3f4f6;color:#102033}
.grid{display:grid;grid-template-columns:repeat(${withSteps ? 4 : 2},${withSteps ? 380 : 560}px);gap:10px}
.cell{background:#fff;border-radius:8px;padding:8px;break-inside:avoid}
.cell h4{margin:0 0 4px;font-size:12px}.words{font-size:10.5px;color:#444;margin-top:4px}
.chips{display:flex;gap:4px;flex-wrap:wrap}.chip{border:1px solid #ccd;border-radius:12px;padding:1px 7px;font-size:10px;background:#fff}.chip.on{background:#102033;color:#fff}
.btn{font-size:10px}.small{font-size:10.5px}.muted{color:#667}.row{display:flex}.step-list{margin:4px 0;padding-left:16px}`;
const cells: string[] = [];
for (const [id, d] of Object.entries(DIAGRAMS)) {
  if (only && !only.some((o) => id.endsWith(o))) continue;
  const drill = LIBRARY_DRILLS.find((x) => x.id === id)!;
  d.plays.forEach((p, pi) => {
    const states: (number | null)[] = withSteps ? [null, ...p.steps.map((_, i) => i)] : [null];
    for (const st of states) {
      cells.push(`<div class="cell"><h4>${id.replace('lib-', '')} · ${drill.name} · ${p.name}${st === null ? '' : ` · after step ${st + 1}`}</h4>${renderToStaticMarkup(<DrillDiagram diagram={d} initialPlay={pi} initialStep={st} compact={withSteps} />)}${pi === 0 && st === null ? `<div class="words"><b>Setup:</b> ${drill.setup}<br>${drill.steps.map((s, i) => `${i + 1}. ${s}`).join('<br>')}</div>` : ''}</div>`);
    }
  });
}
const per = withSteps ? 8 : 4;
let n = 0;
for (let i = 0; i < cells.length; i += per) {
  writeFileSync(`${out}/page-${String(++n).padStart(2, '0')}.html`, `<!doctype html><meta charset="utf-8"><style>${css}</style><div class="grid">${cells.slice(i, i + per).join('')}</div>`);
}
console.log(`${cells.length} pictures on ${n} pages in ${out}`);
