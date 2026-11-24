/**
 * Tryouts: several coaches mark the same kids at the same stations, each on his own phone, and the
 * board puts the marks side by side.
 *
 * This is the one place in Dugout Lab that compares kids with each other, because a tryout is a
 * selection decision. It is for coaches only: nothing here feeds a parent page, a scorecard or a
 * player's profile, and a kid trying out is not a player on the team.
 *
 * Rules this file keeps:
 *  - A kid's number at a station is the average of the coaches, where each coach counts once
 *    however many nights he scored (his own nights are averaged first).
 *  - A station nobody scored is left out of a kid's overall, not counted as a zero. A pitcher who
 *    never caught is not marked down for catching.
 *  - Where two coaches are 2 or more apart, the board says so instead of hiding it in an average.
 */
import type { Candidate, Tryout, TryoutScore, TryoutStation, ISODate } from './types';
import { LEAN_STATION, NOTE_STATION } from './types';
import { brandOf, brandHeader, brandFooter, type BrandContext } from './home';

/** Matt's plan for the Warriors tryout nights, plus the two things a drill does not show by itself. */
export const DEFAULT_STATIONS = ['Catch play', 'Ground balls', 'Fly balls', 'Pitching', 'Catching', 'Hitting', 'Speed and athleticism', 'Coachability and effort'];

/**
 * What each number means. 5 is best, 1 is lowest, and 3 is about our own average player, so two
 * coaches mean the same thing by a 3. `cap` is the word printed on the button itself.
 */
export const SCALE: Array<{ value: number; label: string; cap?: string }> = [
  { value: 1, label: 'Well below our team', cap: 'lowest' },
  { value: 2, label: 'Below our average' },
  { value: 3, label: 'About our average player', cap: 'average' },
  { value: 4, label: 'Above our average' },
  { value: 5, label: 'One of our best', cap: 'best' }
];
/** The one sentence every screen and printout uses, so nobody reads the scale upside down. */
export const SCALE_RULE = '5 is best. 1 is lowest. 3 is about our average player.';

export const LEANS: Array<{ value: number; label: string }> = [{ value: 3, label: 'Yes' }, { value: 2, label: 'Maybe' }, { value: 1, label: 'No' }];
export const DECISION_LABEL = { offer: 'Offer', waitlist: 'Waitlist', pass: 'Pass' } as const;

/** Coaches this far apart at a station get flagged. */
export const SPLIT_AT = 2;

export const visibleStations = (t: Tryout): TryoutStation[] => t.stations.filter((s) => !s.hidden);

/** What he has on that night; with no night given, the latest night anyone wrote it down. */
export function wearingOn(c: Candidate, t: Tryout, sessionId?: string): string | undefined {
  if (sessionId) return c.wearing?.[sessionId] || undefined;
  for (const s of [...t.sessions].reverse()) if (c.wearing?.[s.id]) return c.wearing[s.id];
  return undefined;
}

/** Number first when it is a number ("7" before "12"), then name. */
export function sortCandidates(list: Candidate[]): Candidate[] {
  const num = (c: Candidate) => { const n = parseInt(c.number ?? '', 10); return Number.isFinite(n) ? n : Infinity; };
  return [...list].sort((a, b) => num(a) - num(b) || a.name.localeCompare(b.name));
}

/** The session to score in right now: today's if there is one, else the latest not in the future, else the first. */
export function currentSession(t: Tryout, today: ISODate): string | undefined {
  const exact = t.sessions.find((s) => s.date === today);
  if (exact) return exact.id;
  const past = t.sessions.filter((s) => s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  return (past[past.length - 1] ?? t.sessions[0])?.id;
}

// ---------------------------------------------------------------------------
// Pasting a list of kids
// ---------------------------------------------------------------------------

export interface ParsedCandidate { name: string; number?: string; positions?: string; team?: string; note?: string }

const cleanCell = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Turn pasted text into kids. Two shapes work:
 *  - one kid per line, "Name, positions, current team" (commas or tabs; a leading "#12" or "12" is his number)
 *  - rows copied from a sign-up sheet with a header line; the columns are found by their headings.
 * Birthdays, parents and phone numbers in a pasted sheet are dropped on purpose.
 */
export function parseCandidateList(text: string): ParsedCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.split(',')).map(cleanCell);
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const out: ParsedCandidate[] = [];
  const push = (c: ParsedCandidate) => { if (c.name && !out.some((o) => o.name.toLowerCase() === c.name.toLowerCase())) out.push(c); };
  if (head.includes('name')) {
    const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
    const iName = col('name');
    const iNum = col('number', '#', 'jersey');
    const iTeam = col('team', 'current team');
    const iPos = head.map((h, i) => (/position|^pos\b/.test(h) ? i : -1)).filter((i) => i >= 0);
    const iGrade = col('grade');
    for (const l of lines.slice(1)) {
      const cells = split(l);
      const positions = iPos.map((i) => cells[i]).filter(Boolean).join(', ');
      push({ name: cells[iName] ?? '', number: iNum >= 0 ? cells[iNum] || undefined : undefined, positions: positions || undefined, team: iTeam >= 0 ? cells[iTeam] || undefined : undefined, note: iGrade >= 0 && cells[iGrade] ? `Grade ${cells[iGrade]}` : undefined });
    }
    return out;
  }
  for (const l of lines) {
    const cells = split(l);
    let name = cells[0] ?? '';
    let number: string | undefined;
    const m = name.match(/^#?(\d{1,3})[\s.)-]+(.+)$/);
    if (m) { number = m[1]; name = m[2].trim(); }
    push({ name, number, positions: cells[1] || undefined, team: cells[2] || undefined, note: cells.slice(3).filter(Boolean).join(', ') || undefined });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

export interface StationCell {
  stationId: string;
  /** Average of the coaches, or undefined when nobody scored it. */
  avg?: number;
  /** One number per coach (his own nights averaged). */
  byCoach: Array<{ by: string; value: number }>;
  /** Coaches at least SPLIT_AT apart. */
  split: boolean;
}

export interface BoardRow {
  candidate: Candidate;
  cells: StationCell[];
  /** Average of the stations that were scored. */
  overall?: number;
  stationsScored: number;
  coaches: string[];
  leans: { yes: string[]; maybe: string[]; no: string[] };
  notes: Array<{ by: string; sessionId: string; stationId: string; text: string }>;
  anySplit: boolean;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Everyone's marks, side by side. `sessionId` narrows to one night; without it every night counts.
 * Hidden kids and hidden stations are left out.
 */
export function buildBoard(t: Tryout, candidates: Candidate[], scores: TryoutScore[], opts: { sessionId?: string } = {}): BoardRow[] {
  const stations = visibleStations(t);
  const inScope = scores.filter((s) => s.tryoutId === t.id && (!opts.sessionId || s.sessionId === opts.sessionId));
  const sessionOrder = new Map(t.sessions.map((s, i) => [s.id, i]));
  return sortCandidates(candidates.filter((c) => c.tryoutId === t.id && !c.hidden)).map((candidate) => {
    const mine = inScope.filter((s) => s.candidateId === candidate.id);
    const coaches = new Set<string>();
    const cells: StationCell[] = stations.map((st) => {
      const perCoach = new Map<string, number[]>();
      for (const s of mine) {
        if (s.stationId !== st.id || typeof s.value !== 'number') continue;
        perCoach.set(s.by, [...(perCoach.get(s.by) ?? []), s.value]);
      }
      const byCoach = [...perCoach.entries()].map(([by, vals]) => ({ by, value: mean(vals) })).sort((a, b) => a.by.localeCompare(b.by));
      for (const b of byCoach) coaches.add(b.by);
      const vals = byCoach.map((b) => b.value);
      return { stationId: st.id, avg: vals.length ? mean(vals) : undefined, byCoach, split: vals.length > 1 && Math.max(...vals) - Math.min(...vals) >= SPLIT_AT };
    });
    const scored = cells.filter((c) => c.avg !== undefined);
    // A coach's lean is his latest one (the later night wins), so a changed mind after night two counts once.
    const latestLean = new Map<string, TryoutScore>();
    for (const s of mine) {
      if (s.stationId !== LEAN_STATION || typeof s.value !== 'number') continue;
      const cur = latestLean.get(s.by);
      const newer = !cur || (sessionOrder.get(s.sessionId) ?? 0) > (sessionOrder.get(cur.sessionId) ?? 0) || ((sessionOrder.get(s.sessionId) ?? 0) === (sessionOrder.get(cur.sessionId) ?? 0) && s.updatedAt > cur.updatedAt);
      if (newer) latestLean.set(s.by, s);
    }
    const leans = { yes: [] as string[], maybe: [] as string[], no: [] as string[] };
    for (const [by, s] of latestLean) { coaches.add(by); (s.value === 3 ? leans.yes : s.value === 2 ? leans.maybe : leans.no).push(by); }
    const notes = mine.filter((s) => s.note).map((s) => ({ by: s.by, sessionId: s.sessionId, stationId: s.stationId, text: s.note! })).sort((a, b) => (sessionOrder.get(a.sessionId) ?? 0) - (sessionOrder.get(b.sessionId) ?? 0) || a.by.localeCompare(b.by));
    for (const n of notes) coaches.add(n.by);
    return { candidate, cells, overall: scored.length ? mean(scored.map((c) => c.avg!)) : undefined, stationsScored: scored.length, coaches: [...coaches].sort(), leans, notes, anySplit: cells.some((c) => c.split) };
  });
}

export type BoardSort = 'overall' | 'name' | 'number' | string;

/** Sort the board. Kids with nothing to sort on go last, in number order. */
export function sortBoard(rows: BoardRow[], by: BoardSort): BoardRow[] {
  if (by === 'number') return rows; // buildBoard already returns number order
  if (by === 'name') return [...rows].sort((a, b) => a.candidate.name.localeCompare(b.candidate.name));
  const val = (r: BoardRow) => (by === 'overall' ? r.overall : r.cells.find((c) => c.stationId === by)?.avg);
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return y - x;
  });
}

/** 3.5 for a number, a dash for nothing. */
export const fmt = (n?: number) => (n === undefined ? '–' : (Math.round(n * 10) / 10).toFixed(1));

/** How many of the visible stations this coach has marked for this kid tonight. */
export function myProgress(t: Tryout, candidateId: string, sessionId: string, by: string, scores: TryoutScore[]): { done: number; of: number } {
  const ids = new Set(visibleStations(t).map((s) => s.id));
  const done = new Set(scores.filter((s) => s.candidateId === candidateId && s.sessionId === sessionId && s.by === by && typeof s.value === 'number' && ids.has(s.stationId)).map((s) => s.stationId));
  return { done: done.size, of: ids.size };
}

/** Every coach who has marked anything in this tryout, with how many marks. */
export function coachCounts(t: Tryout, scores: TryoutScore[], sessionId?: string): Array<{ by: string; marks: number }> {
  const m = new Map<string, number>();
  for (const s of scores) {
    if (s.tryoutId !== t.id || (sessionId && s.sessionId !== sessionId)) continue;
    if (typeof s.value !== 'number' && !s.note) continue;
    m.set(s.by, (m.get(s.by) ?? 0) + 1);
  }
  return [...m.entries()].map(([by, marks]) => ({ by, marks })).sort((a, b) => a.by.localeCompare(b.by));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stationName = (t: Tryout, id: string) => (id === LEAN_STATION ? 'Lean' : id === NOTE_STATION ? 'Overall' : t.stations.find((s) => s.id === id)?.label ?? 'Station');
const sessionName = (t: Tryout, id: string) => t.sessions.find((s) => s.id === id)?.label ?? '';

/**
 * The printable tryout report for the coaches' talk afterward. Coach-only, and it says so on the page.
 * It shows only what happened: kids nobody marked and stations nobody scored are left out and named
 * at the bottom. A summary table first, then each kid with every coach's marks side by side and
 * every coach's notes under his own name. With a team it carries the team's header. It prints sideways
 * only when more than five stations were run.
 */
export function renderBoardHtml(t: Tryout, rows: BoardRow[], opts: { sessionLabel: string; coaches: string[]; asOf: string; sessionId?: string; brand?: BrandContext }): string {
  const b = opts.brand?.team ? brandOf(opts.brand) : undefined;
  const allStations = visibleStations(t);
  const seen = (r: BoardRow) => r.stationsScored > 0 || r.notes.length > 0 || r.leans.yes.length + r.leans.maybe.length + r.leans.no.length > 0;
  const shown = rows.filter(seen);
  const absent = rows.length - shown.length;
  // A station is in the report when at least one kid in it has a mark there.
  const ran = allStations.map((st, i) => ({ st, i })).filter(({ i }) => shown.some((r) => r.cells[i]?.avg !== undefined));
  const skipped = allStations.filter((st) => !ran.some((x) => x.st.id === st.id));
  const kidName = (c: Candidate) => `${c.number ? `#${esc(c.number)} ` : ''}${esc(c.name)}`;
  const leanWords = (r: BoardRow) => [r.leans.yes.length ? `Yes: ${r.leans.yes.map(esc).join(', ')}` : '', r.leans.maybe.length ? `Maybe: ${r.leans.maybe.map(esc).join(', ')}` : '', r.leans.no.length ? `No: ${r.leans.no.map(esc).join(', ')}` : ''].filter(Boolean).join(' · ');

  const head = `<tr><th>Kid</th><th>Overall</th>${ran.map(({ st }) => `<th>${esc(st.label)}</th>`).join('')}<th>Yes / Maybe / No</th><th>Decision</th></tr>`;
  const body = shown.map((r) => {
    const c = r.candidate;
    const cells = ran.map(({ i }) => r.cells[i]).map((x) => `<td class="${x.split ? 'split' : ''}">${fmt(x.avg)}</td>`).join('');
    const scoredHere = ran.filter(({ i }) => r.cells[i].avg !== undefined).length;
    return `<tr><td><strong>${kidName(c)}</strong></td><td><strong>${fmt(r.overall)}</strong><div class="m">${scoredHere} of ${ran.length} stations</div></td>${cells}<td class="c">${r.leans.yes.length} / ${r.leans.maybe.length} / ${r.leans.no.length}</td><td>${c.decision ? esc(DECISION_LABEL[c.decision]) : ''}</td></tr>`;
  }).join('');

  const kids = shown.map((r) => {
    const c = r.candidate;
    const wearing = wearingOn(c, t, opts.sessionId);
    const scorers = [...new Set(ran.flatMap(({ i }) => r.cells[i].byCoach.map((x) => x.by)))].sort((x, y) => x.localeCompare(y));
    const marks = scorers.length ? `<table class="k"><thead><tr><th>Station</th>${scorers.map((by) => `<th>${esc(by)}</th>`).join('')}<th>Average</th></tr></thead><tbody>${ran.filter(({ i }) => r.cells[i].avg !== undefined).map(({ st, i }) => {
      const cell = r.cells[i];
      return `<tr class="${cell.split ? 'split' : ''}"><td>${esc(st.label)}</td>${scorers.map((by) => { const v = cell.byCoach.find((x) => x.by === by); return `<td>${v ? fmt(v.value) : '–'}</td>`; }).join('')}<td><strong>${fmt(cell.avg)}</strong></td></tr>`;
    }).join('')}<tr><td><strong>Overall</strong></td>${scorers.map(() => '<td></td>').join('')}<td><strong>${fmt(r.overall)}</strong></td></tr></tbody></table>` : '<div class="m">No station marks.</div>';
    const lean = leanWords(r);
    const decision = c.decision ? `<div class="line"><strong>Decision:</strong> ${esc(DECISION_LABEL[c.decision])}${c.decisionNote ? `. ${esc(c.decisionNote)}` : ''}</div>` : '';
    // Every note, grouped under the coach who wrote it.
    const writers = [...new Set(r.notes.map((n) => n.by))].sort((x, y) => x.localeCompare(y));
    const notes = writers.length ? `<div class="notes"><div class="nh">What the coaches wrote</div>${writers.map((by) => `<div class="w"><strong>${esc(by)}</strong><ul>${r.notes.filter((n) => n.by === by).map((n) => `<li>${n.stationId === NOTE_STATION ? '' : `<span class="st">${esc(stationName(t, n.stationId))}:</span> `}${esc(n.text)}${!opts.sessionId && t.sessions.length > 1 && sessionName(t, n.sessionId) ? ` <span class="m">(${esc(sessionName(t, n.sessionId))})</span>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>` : '<div class="m" style="margin-top:6px">No written notes.</div>';
    return `<section class="kid"><h3>${kidName(c)}</h3><div class="m">${esc([c.positions, c.team, c.note].filter(Boolean).join(' · '))}${wearing ? `${c.positions || c.team || c.note ? ' · ' : ''}Wearing: ${esc(wearing)}` : ''}</div><div class="kb"><div>${marks}${lean ? `<div class="line"><strong>Take him?</strong> ${lean}</div>` : ''}${decision}</div><div>${notes}</div></div></section>`;
  }).join('');

  const left = [skipped.length ? `Stations nobody scored, left out: ${skipped.map((x) => esc(x.label)).join(', ')}.` : '', absent ? `${absent} ${absent === 1 ? 'kid' : 'kids'} on the list had no marks and ${absent === 1 ? 'is' : 'are'} left out.` : ''].filter(Boolean).join(' ');
  const p = b?.primary ?? '#16202e';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.name)} report</title><style>
body{font:14px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16202e;margin:20px}h1{font-size:22px;margin:0 0 2px}h2{font-size:16px;margin:22px 0 6px;border-bottom:2px solid ${p};padding-bottom:3px}h3{font-size:16px;margin:0 0 2px;color:${p}}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #d5dbe6;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:12px;color:#44506a}
.m{color:#5b6680;font-size:11px}.c{white-space:nowrap}.split,tr.split td{background:#fff3d6}.warn{background:#f4f6fa;border-left:4px solid #b4530a;padding:8px 12px;border-radius:4px;font-size:13px}ul{margin:2px 0 0 18px;padding:0}
.kid{border:1px solid #d5dbe6;border-radius:8px;padding:12px 14px;margin:12px 0;break-inside:avoid}.kb{display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start}.kb>div{flex:1 1 280px}table.k{width:100%;margin-top:8px}table.k td,table.k th{padding:4px 14px 4px 0}.line{margin-top:8px}.notes{margin-top:8px}.nh{font-size:12px;color:#44506a;font-weight:700;text-transform:none}.w{margin-top:6px}.st{color:#44506a}
.brandbar{display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:3px solid ${p}}.brandbar img{height:48px;width:48px;object-fit:contain}.brandbar .n{font-weight:800;font-size:18px;color:${p}}.brandbar .t{color:#5b6680;font-size:13px}.foot{margin-top:18px;color:#5b6680;font-size:12px}
@page{size:${ran.length > 5 ? 'landscape' : 'portrait'};margin:10mm}@media print{body{margin:0}h2{break-after:avoid}tr{break-inside:avoid}thead{display:table-header-group}.split,tr.split td,.warn{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
${b ? brandHeader(opts.brand) : ''}<h1>${esc(t.name)}</h1>
<div class="m">${esc(opts.sessionLabel)} · as of ${esc(opts.asOf)} · scored by ${esc(opts.coaches.join(', ') || 'no one yet')}</div>
<p class="warn"><strong>For coaches only.</strong> Do not share with families or players. <strong>${SCALE_RULE}</strong> Each number in the summary is the average of the coaches who scored it, so higher is better. A shaded box means two coaches were ${SPLIT_AT} or more apart: talk about that one. A dash means that coach did not score it.</p>
${shown.length ? `<h2>Summary</h2><table><thead>${head}</thead><tbody>${body}</tbody></table><h2>Kid by kid</h2>${kids}` : '<p>No marks yet.</p>'}
${left ? `<p class="m" style="margin-top:14px">${left}</p>` : ''}
${b ? `<div class="foot">${brandFooter(opts.brand)}</div>` : ''}
</body></html>`;
}
