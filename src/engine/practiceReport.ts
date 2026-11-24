/**
 * The practice report: one kid, one practice, written for his family.
 *
 * This file holds what the report says (a plain object). How it looks lives in the PDF builder
 * (src/io/practiceReportPdf.ts) and the page renderer below. Building one from a real practice
 * (practiceReportFor) comes from the same notes the coaches already take: quick reads, narrated
 * reps, goals, cues and the home plan.
 *
 * Rules that hold for everything in it (see docs/DECISIONS.md, parent communication):
 * wins first; what he is working on is said with the cue the coaches use; never another kid,
 * never a ranking or a team comparison, never a private note or a raw coach note.
 */
import type { Category, Drill, Observation, Player, Practice, Settings, Team } from './types';
import { CATEGORY_LABEL, localDate } from './types';
import { brandOf, esc, type BrandContext, type HomePlan } from './home';
import { SKILLS, tally, sessionDates } from './progress';
import { reportColors } from './tryout';

export interface ReportWin { text: string; by?: string }
export interface ReportCount { skill: string; /** The word after the count: "10 of 12 clean". */ word?: string; good: number; of: number; before?: { good: number; of: number } }
export interface ReportFocus { text: string; cue?: string }
export interface ReportHomeDrill { name: string; how: string; minutes?: number }

export interface PracticeReport {
  /** As the family should see it: "Sam R." or "Sam Rivers". */
  playerName: string;
  firstName: string;
  number?: string;
  /** "Thursday, December 3, 2026" */
  dateLabel: string;
  /** "Infield and hitting" */
  practiceTitle?: string;
  /** A made-up report to show a family the format. Says so on the page. */
  sample?: boolean;
  /** What the team did: area and drill, in practice order. */
  worked: Array<{ area: string; what: string }>;
  wins: ReportWin[];
  counts: ReportCount[];
  /** "Hustled", "Picked up a teammate", "Took a cue and used it right away". */
  effort: string[];
  workingOn: ReportFocus[];
  home: ReportHomeDrill[];
  /** A few sentences the coach typed for this family. */
  coachNote?: { text: string; by: string };
  /** Who a family can ask. */
  coaches: Array<{ name: string; role?: string }>;
  brand?: BrandContext;
}

/** "Sam-R-practice-report-Dec-3.pdf" */
export function practiceReportFileName(r: PracticeReport): string {
  const slug = `${r.playerName} practice report ${r.dateLabel.replace(/^[A-Za-z]+,\s*/, '').replace(/,\s*\d{4}$/, '')}`.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'practice-report'}.pdf`;
}

// ---------------------------------------------------------------------------
// Building one from a real practice
// ---------------------------------------------------------------------------


const WIN_READS: Observation['read'][] = ['got_it', 'confident', 'reset_worked', 'hustle', 'teammate', 'coachable'];
const EFFORT_WORDS: Array<[Observation['read'], string]> = [['hustle', 'Hustled'], ['teammate', 'Picked up a teammate'], ['coachable', 'Took a cue and used it']];
/** A note with one of these reads never goes home as written; the coach can say it his own way in his note. */
const NEVER_HOME: Observation['read'][] = ['struggled', 'hesitated', 'frustrated', 'coasting'];

/** One thing a coach wrote about this kid at this practice, and whether it is in the report. */
export interface ReportLine {
  /** The observation it came from. */
  id: string;
  text: string;
  by?: string;
  /** 'win': a good read, in by default. 'note': a plain note, out until the coach puts it in. */
  kind: 'win' | 'note';
  included: boolean;
}

export interface ReportChoices {
  /** Lines the coach turned on or off, by observation id. */
  include?: string[];
  exclude?: string[];
  /** What the coach typed for this family. */
  note?: string;
}

export interface PracticeReportDraft {
  report: PracticeReport;
  /** Everything that could be a line, for the review screen. */
  lines: ReportLine[];
  /** How many notes each coach wrote about this kid at this practice. */
  notesByCoach: Array<{ by: string; n: number }>;
  /** Nothing was written about him: the report would be a drill list and a home plan. */
  empty: boolean;
}

export interface PracticeReportContext {
  player: Player;
  practice: Practice;
  team?: Team;
  settings?: Settings;
  coachName?: string;
  observations: Observation[];
  practices: Practice[];
  drills: Drill[];
  plan: HomePlan;
  choices?: ReportChoices;
}

const sentence = (s: string) => { const t = s.trim(); if (!t) return ''; const up = t.charAt(0).toUpperCase() + t.slice(1); return /[.!?]$/.test(up) ? up : `${up}.`; };

/** How a parent would say each area: the rep ("an infield rep") and the place ("in the infield"). */
const AREA_WORDS: Record<Category, [rep: string, where: string]> = {
  hitting: ['a hitting', 'at the plate'], throwing: ['a throwing', 'throwing'], catching: ['a catching', 'behind the plate'], pitching: ['a pitching', 'on the mound'],
  infield: ['an infield', 'in the infield'], outfield: ['an outfield', 'in the outfield'], baserunning: ['a baserunning', 'on the bases'], team_defense: ['a team defense', 'in team defense'],
  situations: ['a game situation', 'in game situations'], athletic: ['a movement', 'moving'], baseball_iq: ['a baseball IQ', 'reading the game'], mental: ['a mental game', 'between reps']
};

function readWords(o: Observation): string {
  const w = o.category ? AREA_WORDS[o.category] : undefined;
  switch (o.read) {
    case 'got_it': return w ? `Nailed ${w[0]} rep we have been working on.` : 'Nailed a rep we have been working on.';
    case 'confident': return w ? `Looked confident ${w[1]}.` : 'Looked confident.';
    case 'reset_worked': return 'Used his reset routine after a mistake and got right back in.';
    default: return '';
  }
}

/** "Thursday, December 3, 2026" from "2026-12-03", with no time zone surprises. */
export function longDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, day || 1));
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[dt.getUTCDay()]}, ${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

/** The notes written about this player at this practice: tied to it, or written that day with no practice named. */
export function practiceNotes(player: Player, practice: Practice, observations: Observation[]): Observation[] {
  return observations
    .filter((o) => o.playerId === player.id && (o.practiceId === practice.id || (!o.practiceId && o.source !== 'game' && localDate(o.ts) === practice.date)))
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

export function practiceReportFor(ctx: PracticeReportContext): PracticeReportDraft {
  const { player, practice } = ctx;
  const mine = practiceNotes(player, practice, ctx.observations);
  const on = new Set(ctx.choices?.include ?? []);
  const off = new Set(ctx.choices?.exclude ?? []);

  // Lines: what a coach wrote, never the counted reps (those are the numbers) and never a rough read as written.
  const lines: ReportLine[] = [];
  const seen = new Set<string>();
  for (const o of mine) {
    if (o.tags?.length || NEVER_HOME.includes(o.read)) continue;
    const isWin = WIN_READS.includes(o.read);
    const text = sentence(o.text ?? '') || (isWin ? readWords(o) : '');
    if (!text) continue;
    const key = `${o.by ?? ''}|${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = isWin ? 'win' : 'note';
    lines.push({ id: o.id, text, by: o.by, kind, included: off.has(o.id) ? false : on.has(o.id) ? true : kind === 'win' });
  }

  const effort = EFFORT_WORDS.filter(([read]) => mine.some((o) => o.read === read)).map(([, words]) => words);

  // Counted reps tonight, next to the session before.
  const days = sessionDates(player.id, ctx.observations, ctx.practices);
  const prevDay = days.filter((d) => d < practice.date).pop();
  const prev = prevDay ? ctx.observations.filter((o) => o.playerId === player.id && localDate(o.ts) === prevDay) : [];
  const all = SKILLS.map((skill) => ({ skill, now: tally(mine, skill), before: tally(prev, skill) })).filter((x) => x.now.total >= 3);
  const general = all.find((x) => x.skill.id === 'field_clean');
  const counts: ReportCount[] = all
    // A side row that says the same thing as the general fielding row is left out.
    .filter((x) => !(general && (x.skill.id === 'backhand' || x.skill.id === 'forehand') && x.now.total === general.now.total && x.now.good === general.now.good))
    .sort((a, b) => b.now.total - a.now.total)
    .slice(0, 4)
    .map((x) => ({ skill: x.skill.label, word: x.skill.word, good: x.now.good, of: x.now.total, before: x.before.total >= 3 ? { good: x.before.good, of: x.before.total } : undefined }));

  // What the team did, by area, in practice order.
  const byId = new Map(ctx.drills.map((d) => [d.id, d]));
  const worked: PracticeReport['worked'] = [];
  const seenAreas = new Map<string, { area: string; names: string[] }>();
  for (const b of practice.blocks) {
    for (const st of b.stations) {
      const drill = byId.get(st.drillId);
      const category = st.category ?? drill?.category;
      const name = (st.nameOverride || drill?.name || '').trim();
      if (!category || !name) continue;
      const area = CATEGORY_LABEL[category];
      const row = seenAreas.get(area);
      if (!row) { const fresh = { area, names: [name] }; seenAreas.set(area, fresh); }
      else if (!row.names.some((n) => n.toLowerCase() === name.toLowerCase())) row.names.push(name);
    }
  }
  // A short list a parent will read: five areas, two drills each, drill names as the coach wrote them.
  for (const row of [...seenAreas.values()].slice(0, 5)) worked.push({ area: row.area, what: row.names.slice(0, 2).join(', ') + (row.names.length > 2 ? ', and more' : '') });

  const workingOn: ReportFocus[] = ctx.plan.focus.slice(0, 2).map((f) => {
    const cue = ctx.plan.drills.find((d) => d.category === f.category)?.cues[0];
    return { text: sentence(f.text), cue };
  });
  const home: ReportHomeDrill[] = ctx.plan.drills.slice(0, 2).map((d) => ({ name: d.drill.name, how: sentence(`${d.objective} (${d.reps})`), minutes: Math.max(3, Math.round(ctx.plan.minutesPerSession / Math.max(1, Math.min(2, ctx.plan.drills.length)))) }));

  const b = brandOf({ team: ctx.team, settings: ctx.settings, coachName: ctx.coachName });
  const coaches = b.coaches.length ? b.coaches.map((c) => ({ name: c.name, role: c.role })) : ctx.coachName ? [{ name: `Coach ${ctx.coachName}` }] : [];
  const note = ctx.choices?.note?.trim();
  const report: PracticeReport = {
    playerName: `${player.firstName} ${player.lastName ?? ''}`.trim(),
    firstName: player.firstName || 'your player',
    number: player.number || undefined,
    dateLabel: longDate(practice.date),
    practiceTitle: practice.title || undefined,
    worked,
    wins: lines.filter((l) => l.included).slice(0, 6).map((l) => ({ text: l.text, by: l.by ? `Coach ${l.by}` : undefined })),
    counts,
    effort,
    workingOn,
    home,
    coachNote: note ? { text: note, by: ctx.coachName ? `Coach ${ctx.coachName}` : 'Your coach' } : undefined,
    coaches,
    brand: { team: ctx.team, settings: ctx.settings, coachName: ctx.coachName }
  };
  const tallyBy = new Map<string, number>();
  for (const o of mine) tallyBy.set(o.by ?? 'A coach', (tallyBy.get(o.by ?? 'A coach') ?? 0) + 1);
  return {
    report,
    lines,
    notesByCoach: [...tallyBy].map(([by, n]) => ({ by, n })).sort((a, c) => a.by.localeCompare(c.by)),
    empty: mine.length === 0
  };
}

/** The few words that go with the PDF in a text or an email. */
export function practiceReportMessage(r: PracticeReport, parentName?: string): string {
  const hi = parentName?.trim() ? `Hi ${parentName.trim().split(' ')[0]}, ` : 'Hi, ';
  return `${hi}here is ${r.firstName}'s practice report from ${r.dateLabel.replace(/,\s*\d{4}$/, '')}: what we worked on, what we saw, and a couple of things for home. Questions anytime.`;
}

// ---------------------------------------------------------------------------
// The page: what the coach looks at before he shares, and the fallback when a PDF cannot be made
// ---------------------------------------------------------------------------

export function renderPracticeReportHtml(r: PracticeReport): string {
  const { b, primary: p, accent: a, soft, softer, onAccent, accentText } = reportColors(r.brand);
  const mark = b?.wordmark ? `<img class="wm" src="${b.wordmark.src}" alt="${esc(b.name)}">` : b ? `<div class="lm">${b.logo ? `<img src="${b.logo}" alt="">` : ''}<div class="ln">${esc(b.name)}</div></div>` : '';
  const wins = r.wins.length || r.effort.length ? `<div><h2>What the coaches saw</h2><ul class="w">${r.wins.map((w) => `<li>${w.by ? `<b>${esc(w.by)}:</b> ` : ''}${esc(w.text)}</li>`).join('')}</ul>${r.effort.length ? `<div class="chips">${r.effort.map((e) => `<span>${esc(e)}</span>`).join('')}</div>` : ''}</div>` : '';
  const counts = r.counts.length ? `<div><h2>By the numbers</h2>${r.counts.map((c) => `<div class="bar"><div class="bl"><b>${esc(c.skill)}</b><b class="n">${c.good} of ${c.of}${c.word ? ` ${esc(c.word)}` : ''}</b></div><div class="track"><i style="width:${c.of > 0 ? Math.round((c.good / c.of) * 100) : 0}%"></i></div>${c.before && c.before.of > 0 ? `<div class="m">Last practice: ${c.before.good} of ${c.before.of}</div>` : ''}</div>`).join('')}<div class="m">Reps the coaches counted during drills. Small counts move around from night to night, so read them next to the notes.</div></div>` : '';
  const focus = r.workingOn.length ? `<div><h2>Working on next</h2><ul class="w">${r.workingOn.map((f) => `<li>${esc(f.text)}${f.cue ? `<div class="cue">What we say to him: "${esc(f.cue)}"</div>` : ''}</li>`).join('')}</ul></div>` : '';
  const total = r.home.reduce((s, d) => s + (d.minutes ?? 0), 0);
  const home = r.home.length ? `<div class="home"><h2 class="plain">At home this week</h2>${r.home.map((d) => `<div class="hd2"><b>${esc(d.name)}</b>${d.minutes ? `<span>${d.minutes} min</span>` : ''}</div><div class="how">${esc(d.how)}</div>`).join('')}${total ? `<div class="m">About ${total} minutes, two or three times this week.</div>` : ''}</div>` : '';
  const ask = r.coaches.length ? `Questions? Ask ${r.coaches.map((c) => `${esc(c.name)}${c.role ? ` (${esc(c.role)})` : ''}`).join(' or ')}.` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.playerName)} practice report</title><style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:14px/1.42 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16202e;margin:0;background:#fff}
.top{height:12px;background:${p};border-bottom:4px solid ${a}}.page{padding:16px 20px 22px}
.hd{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}.wm{height:66px;width:auto;max-width:60%}
.lm{display:flex;align-items:center;gap:12px;max-width:60%}.lm img{height:60px;width:60px;object-fit:contain}.ln{font-size:24px;font-weight:900;color:${p};text-transform:uppercase;letter-spacing:.5px;line-height:1.05}
.ttl{text-align:right;margin-left:auto}.ttl .k{font-size:21px;font-weight:900;letter-spacing:2.4px;text-transform:uppercase;color:${p};line-height:1.1}.ttl .n{font-size:14px;font-weight:700;color:${accentText};margin-top:3px}.ttl .d{font-size:12px;color:#5b6680}
.band{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:${p};color:#fff;margin:12px -20px 0;padding:9px 20px;font-size:13px;font-weight:600;letter-spacing:.4px}
.pill{background:${a};color:${onAccent};border-radius:999px;padding:3px 12px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;white-space:nowrap}
.sample{background:#fff3d6;color:#7a4e00;font-weight:700;font-size:12px;text-align:center;margin:0 -20px;padding:6px 20px}
.kid{background:${p};color:#fff;border-radius:8px 8px 0 0;border-bottom:5px solid ${a};padding:10px 16px;margin-top:16px}.kid h1{font-size:24px;margin:0;line-height:1.15}.kid div{font-size:12px;opacity:.85}
.note{background:${softer};border-left:4px solid ${a};border-radius:0 6px 6px 0;padding:11px 16px;margin-top:12px;font-style:italic}.note b{display:block;text-align:right;font-style:normal;color:${p};font-size:13px;margin-top:4px}
.tonight{margin:12px 0 0;color:#5b6680;font-size:13px}.tonight b{color:${p};letter-spacing:1.6px;font-size:12px;margin-right:8px}.tonight i{font-style:normal;font-weight:600;color:#2b3852}
h2{font-size:12.5px;letter-spacing:2px;text-transform:uppercase;color:${p};margin:0 0 8px;padding-bottom:5px;border-bottom:3px solid ${a}}h2.plain{border:0;padding:0;margin-bottom:6px}
.two{display:flex;gap:26px;flex-wrap:wrap;margin-top:18px;align-items:flex-start}.two>div{flex:1 1 280px;min-width:0}
ul.w{list-style:none;margin:0;padding:0}ul.w li{position:relative;padding-left:16px;margin-bottom:7px}ul.w li:before{content:"";position:absolute;left:3px;top:.55em;width:5px;height:5px;border-radius:50%;background:${a}}ul.w b{color:${p}}
.cue{color:${accentText};font-style:italic;font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.chips span{background:${soft};color:${p};font-weight:700;font-size:12.5px;border-radius:999px;padding:4px 13px}
.bar{margin-bottom:9px}.bl{display:flex;justify-content:space-between;gap:10px}.bl .n{color:${p};white-space:nowrap}.track{height:9px;border-radius:5px;background:${soft};margin-top:4px;overflow:hidden}.track i{display:block;height:100%;border-radius:5px;background:${a}}
.m{color:#5b6680;font-size:11.5px;margin-top:3px}
.home{background:${softer};border-left:4px solid ${a};border-radius:0 6px 6px 0;padding:12px 14px}.hd2{display:flex;justify-content:space-between;gap:10px;margin-top:6px}.hd2 span{color:${accentText};font-weight:700;font-size:12.5px;white-space:nowrap}.how{font-size:13px}
.foot{margin-top:20px;padding-top:9px;border-top:3px solid ${p};display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:11.5px;color:#5b6680}.foot b{color:${p}}
@page{size:portrait;margin:8mm}@media print{.two{break-inside:avoid}}</style></head><body>
<div class="top"></div><div class="page">
<div class="hd">${mark}<div class="ttl"><div class="k">Practice report</div><div class="n">${esc(r.dateLabel)}</div>${r.practiceTitle ? `<div class="d">${esc(r.practiceTitle)}</div>` : ''}</div></div>
<div class="band"><span>${esc(b?.tagline || b?.name || 'Practice report')}</span><span class="pill">For ${esc(r.firstName)}'s family</span></div>
${r.sample ? '<div class="sample">SAMPLE REPORT. The notes and numbers below are made up to show what a family receives.</div>' : ''}
<div class="kid"><h1>${esc(r.playerName)}${r.number ? ` #${esc(r.number)}` : ''}</h1><div>What ${esc(r.firstName)} worked on and what the coaches saw</div></div>
${r.coachNote?.text.trim() ? `<div class="note">${esc(r.coachNote.text)}<b>${esc(r.coachNote.by)}</b></div>` : ''}
${r.worked.length ? `<p class="tonight"><b>TONIGHT</b>${r.worked.map((w) => `<i>${esc(w.area)}:</i> ${esc(w.what)}`).join('. &nbsp;')}.</p>` : ''}
${wins || counts ? `<div class="two">${wins}${counts}</div>` : ''}
${focus || home ? `<div class="two">${focus}${home}</div>` : ''}
${!wins && !counts ? `<p class="m" style="margin-top:16px;font-size:13px">The coaches did not write notes on ${esc(r.firstName)} at this practice. That is not a comment on him: on a busy night they get to some kids and not others.</p>` : ''}
<div class="foot"><span>${ask ? `<b>${ask}</b><br>` : ''}These are the coaches' notes from one practice, meant to help at home. Nothing here is a ranking.</span><span>${b ? `<b>${esc(b.footer || b.name)}</b>` : ''}</span></div>
</div></body></html>`;
}
