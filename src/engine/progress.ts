/**
 * Progress over time for one player: counted reps by skill, the coach's quick reads by area,
 * levels then and now, goals, attendance and logged pitches.
 *
 * Where the numbers come from: narrated reps carry details ("Fielded clean", "Throw on target").
 * A skill is a pair of those: what went right and what went wrong. "Backhand side: 3 of 5 clean"
 * means five reps were called out with a backhand, and three of them were clean.
 *
 * Rules this file keeps:
 *  - The kid against himself only. No teammate appears here in any form.
 *  - Counts are always shown as they are. A change ("up", "down") is only named when both
 *    stretches have enough reps AND the difference is bigger than chance would give with that
 *    many reps. Otherwise it says "about the same" or "not enough reps yet".
 *  - No raw note text, no private profile fields. This feeds a page a parent reads.
 */
import type { Category, ISODate, Level, Observation, Player, Practice, ThrowingEntry } from './types';
import { CATEGORIES, CATEGORY_LABEL, LEVEL_LABEL, STATUS_LABEL, localDate } from './types';
import type { BrandContext } from './home';
import { pageCss, brandOf, brandHeader, brandFooter, esc } from './home';

export type Period = 'last' | 'five' | 'ten' | 'all';
export const PERIODS: Period[] = ['last', 'five', 'ten', 'all'];
export const PERIOD_LABEL: Record<Period, string> = { last: 'Last practice', five: 'Last 5', ten: 'Last 10', all: 'Everything' };
const PERIOD_SIZE: Record<Period, number> = { last: 1, five: 5, ten: 10, all: Infinity };

export interface SkillDef {
  id: string;
  /** What the row is called. */
  label: string;
  /** The word after the count: "14 of 20 clean". */
  word: string;
  good: string[];
  bad: string[];
  /** A detail the rep must also carry to count here ("Backhand"). */
  requires?: string;
  area: 'fielding' | 'throwing' | 'hitting' | 'pitching';
}

/** Every pair of details the narration word lists can produce. Tag names match engine/narrate.ts. */
export const SKILLS: SkillDef[] = [
  { id: 'field_clean', label: 'Fielding the ball', word: 'clean', good: ['Fielded clean'], bad: ['Bobbled', 'Missed it'], area: 'fielding' },
  { id: 'backhand', label: 'Backhand side', word: 'clean', good: ['Fielded clean'], bad: ['Bobbled', 'Missed it'], requires: 'Backhand', area: 'fielding' },
  { id: 'forehand', label: 'Forehand side', word: 'clean', good: ['Fielded clean'], bad: ['Bobbled', 'Missed it'], requires: 'Forehand', area: 'fielding' },
  { id: 'approach', label: 'Getting to the ball', word: 'charged it', good: ['Charged it'], bad: ['Sat back'], area: 'fielding' },
  { id: 'transfer', label: 'Glove to hand', word: 'quick', good: ['Quick transfer'], bad: ['Slow transfer'], area: 'throwing' },
  { id: 'throw_target', label: 'Throws', word: 'on target', good: ['Throw on target'], bad: ['Throw off target'], area: 'throwing' },
  { id: 'timing', label: 'Timing at the plate', word: 'on time', good: ['On time'], bad: ['Late', 'Early'], area: 'hitting' },
  { id: 'contact', label: 'Contact', word: 'hard contact', good: ['Hard contact'], bad: ['Weak contact', 'Swing and miss'], area: 'hitting' },
  { id: 'decisions', label: 'Swing decisions', word: 'good takes', good: ['Good take'], bad: ['Chased'], area: 'hitting' },
  { id: 'strikes', label: 'Pitches', word: 'strikes', good: ['Strike'], bad: ['Missed the zone'], area: 'pitching' },
  { id: 'delivery', label: 'Delivery', word: 'balanced', good: ['Balanced'], bad: ['Rushed'], area: 'pitching' }
];

export interface Tally { good: number; total: number }
export type Trend = 'up' | 'down' | 'same' | 'not_enough' | 'none';

/** Reps each stretch needs before a change is named at all. */
export const MIN_REPS_FOR_TREND = 8;
/** How sure the change has to be: about 19 in 20 against chance (two-proportion z of 1.96). */
const Z_NEEDED = 1.96;

const GOOD_READS: Observation['read'][] = ['got_it', 'confident', 'reset_worked'];
const ROUGH_READS: Observation['read'][] = ['struggled', 'hesitated', 'frustrated'];

/** How one rep counts for one skill: good, not good, or not about this skill at all. */
export function repOutcome(tags: string[] | undefined, skill: SkillDef): 'good' | 'bad' | undefined {
  if (!tags?.length) return undefined;
  if (skill.requires && !tags.includes(skill.requires)) return undefined;
  const g = skill.good.some((t) => tags.includes(t));
  const b = skill.bad.some((t) => tags.includes(t));
  // Both said in one breath ("on time, then late") cannot be counted either way.
  if (g === b) return undefined;
  return g ? 'good' : 'bad';
}

export function tally(obs: Observation[], skill: SkillDef): Tally {
  let good = 0;
  let total = 0;
  for (const o of obs) {
    const r = repOutcome(o.tags, skill);
    if (!r) continue;
    total += 1;
    if (r === 'good') good += 1;
  }
  return { good, total };
}

/**
 * Is the recent stretch really different from the one before it? Both need enough reps, and the
 * gap has to beat chance. Seven of eight against three of eight passes; five of eight against
 * four of eight does not.
 */
export function trendOf(recent: Tally, before: Tally, min = MIN_REPS_FOR_TREND): Trend {
  if (!before.total) return 'none';
  if (recent.total < min || before.total < min) return 'not_enough';
  const p1 = recent.good / recent.total;
  const p2 = before.good / before.total;
  const pooled = (recent.good + before.good) / (recent.total + before.total);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / recent.total + 1 / before.total));
  if (se === 0) return 'same';
  const z = (p1 - p2) / se;
  return z >= Z_NEEDED ? 'up' : z <= -Z_NEEDED ? 'down' : 'same';
}

export const TREND_WORD: Record<Trend, string> = { up: 'Up', down: 'Down lately', same: 'About the same', not_enough: 'Too few reps to say', none: '' };

/**
 * The days this player was coached: every finished practice he was at, and every day a note was
 * written about him (a game, a lesson, a quick note). Oldest first.
 */
export function sessionDates(playerId: string, observations: Observation[], practices: Practice[]): ISODate[] {
  const days = new Set<ISODate>();
  for (const o of observations) if (o.playerId === playerId) days.add(localDate(o.ts));
  for (const p of practices) if (p.status === 'done' && p.inputs.presentIds.includes(playerId)) days.add(p.date);
  return [...days].sort();
}

export interface SkillRow { skill: SkillDef; recent: Tally; before: Tally; trend: Trend }
export interface AreaRow { category: Category; good: number; rough: number; beforeGood: number; beforeRough: number }
export interface LevelRow { category: Category; level: Level; status?: string; was?: Level; wasWhen?: ISODate; /** The day the coach set the level he is at now, when the log has it. */ changedWhen?: ISODate }

export interface ProgressReport {
  player: Player;
  period: Period;
  /** Sessions in the stretch, and all sessions on record. */
  sessions: number;
  sessionsOnRecord: number;
  from?: ISODate;
  to?: ISODate;
  /** True when there is an earlier stretch to compare with. */
  hasBefore: boolean;
  skills: SkillRow[];
  areas: AreaRow[];
  levels: LevelRow[];
  effort: { hustle: number; teammate: number; coachable: number };
  attendance?: { present: number; total: number };
  goalsDone: string[];
  goalsActive: string[];
  throwing: Array<{ date: ISODate; kind: ThrowingEntry['kind']; pitches: number | null }>;
  /** Counted reps and notes in the stretch. */
  repsCounted: number;
  notes: number;
  /** Too little written down to read much into. */
  thin: boolean;
  asOf: ISODate;
  brand?: BrandContext;
}

export function progressFor(
  player: Player,
  observations: Observation[],
  practices: Practice[],
  throwing: ThrowingEntry[],
  opts: { period?: Period; now?: Date; brand?: BrandContext } = {}
): ProgressReport {
  const period = opts.period ?? 'five';
  const now = opts.now ?? new Date();
  const mine = observations.filter((o) => o.playerId === player.id);
  const dates = sessionDates(player.id, mine, practices);
  const size = PERIOD_SIZE[period];
  const recentDates = new Set(size === Infinity ? dates : dates.slice(-size));
  const beforeDates = new Set(size === Infinity ? [] : dates.slice(0, Math.max(0, dates.length - size)));
  const from = [...recentDates][0];
  const to = dates[dates.length - 1];
  const inRecent = mine.filter((o) => recentDates.has(localDate(o.ts)));
  const inBefore = mine.filter((o) => beforeDates.has(localDate(o.ts)));

  const skills: SkillRow[] = SKILLS.map((skill) => {
    const recent = tally(inRecent, skill);
    const before = tally(inBefore, skill);
    return { skill, recent, before, trend: recent.total ? trendOf(recent, before) : 'none' };
  }).filter((r) => r.recent.total > 0);
  // A drill of nothing but backhands makes "Fielding the ball" and "Backhand side" the same row twice; keep the exact one.
  const general = skills.find((r) => r.skill.id === 'field_clean');
  const sides = skills.filter((r) => r.skill.id === 'backhand' || r.skill.id === 'forehand');
  const sameAs = (x: SkillRow, y: SkillRow) => x.recent.good === y.recent.good && x.recent.total === y.recent.total && x.before.good === y.before.good && x.before.total === y.before.total;
  if (general && sides.length === 1 && sameAs(general, sides[0])) skills.splice(skills.indexOf(general), 1);
  // Wins first: what moved up, then the highest share, with rows of only a rep or two last.
  const share = (t: Tally) => (t.total ? t.good / t.total : 0);
  const rank = (r: SkillRow) => (r.trend === 'up' ? 0 : r.recent.total < 3 ? 2 : 1);
  skills.sort((a, b) => rank(a) - rank(b) || share(b.recent) - share(a.recent) || b.recent.total - a.recent.total);

  // Quick reads are the taps and typed notes. A narrated rep is already in the counts above, so it stays out of here.
  const countedRep = (o: Observation) => SKILLS.some((s) => repOutcome(o.tags, s));
  const reads = (list: Observation[], c: Category) => ({
    good: list.filter((o) => o.category === c && !countedRep(o) && GOOD_READS.includes(o.read)).length,
    rough: list.filter((o) => o.category === c && !countedRep(o) && ROUGH_READS.includes(o.read)).length
  });
  const areas: AreaRow[] = CATEGORIES.map((c) => {
    const r = reads(inRecent, c);
    const b = reads(inBefore, c);
    return { category: c, good: r.good, rough: r.rough, beforeGood: b.good, beforeRough: b.rough };
  }).filter((a) => a.good + a.rough > 0);

  const levels: LevelRow[] = CATEGORIES.filter((c) => player.levels[c]).map((c) => {
    const level = player.levels[c]!;
    // The earliest logged level in this area is where he started, as far as this phone knows.
    const log = (player.levelLog ?? []).filter((e) => e.category === c && e.level).sort((a, b) => (a.ts ?? '').localeCompare(b.ts ?? ''));
    const first = log.find((e) => e.level !== level) && log[0];
    const row: LevelRow = { category: c, level, status: player.statuses[c] ? STATUS_LABEL[player.statuses[c]!] : undefined };
    if (first && first.level && first.level !== level) {
      row.was = first.level;
      if (first.ts && !first.approx) row.wasWhen = localDate(first.ts);
      const latest = log[log.length - 1];
      if (latest.level === level && !latest.approx) row.changedWhen = localDate(latest.ts);
    }
    return row;
  });

  const count = (r: Observation['read']) => inRecent.filter((o) => o.read === r).length;
  const fromIso = from ?? localDate(now);
  const teamDone = practices.filter((p) => p.status === 'done' && p.date >= fromIso);
  const repsCounted = inRecent.filter((o) => SKILLS.some((s) => repOutcome(o.tags, s))).length;
  return {
    player,
    period,
    sessions: recentDates.size,
    sessionsOnRecord: dates.length,
    from,
    to,
    hasBefore: beforeDates.size > 0,
    skills,
    areas,
    levels,
    effort: { hustle: count('hustle'), teammate: count('teammate'), coachable: count('coachable') },
    attendance: period === 'last' || !teamDone.length ? undefined : { present: teamDone.filter((p) => p.inputs.presentIds.includes(player.id)).length, total: teamDone.length },
    goalsDone: player.goals.filter((g) => g.status === 'done' && g.doneAt && localDate(g.doneAt) >= fromIso).map((g) => g.text),
    goalsActive: player.goals.filter((g) => g.status === 'active').map((g) => g.text),
    throwing: throwing.filter((t) => t.playerId === player.id && t.date >= fromIso).sort((a, b) => b.date.localeCompare(a.date)).map((t) => ({ date: t.date, kind: t.kind, pitches: t.pitches })),
    repsCounted,
    notes: inRecent.length,
    thin: repsCounted < 5 && inRecent.length < 3,
    asOf: localDate(now),
    brand: opts.brand
  };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 20" from 2026-11-20, with no timezone arithmetic. */
export function shortDate(d: ISODate): string {
  const [, m, day] = d.split('-').map((x) => parseInt(x, 10));
  return `${MONTHS[m - 1]} ${day}`;
}

/** The stretch in plain words: "his last 5 sessions, Oct 28 to Nov 20". */
export function stretchWords(r: ProgressReport): string {
  if (!r.sessions || !r.from || !r.to) return 'nothing recorded yet';
  const range = r.from === r.to ? shortDate(r.from) : `${shortDate(r.from)} to ${shortDate(r.to)}`;
  if (r.period === 'last') return `his last session, ${shortDate(r.to)}`;
  if (r.period === 'all') return `everything recorded, ${r.sessions} session${r.sessions === 1 ? '' : 's'}, ${range}`;
  // Asked for five, only three on record: say three.
  return `his last ${r.sessions} session${r.sessions === 1 ? '' : 's'}, ${range}`;
}

export function countWords(t: Tally, word: string): string {
  return `${t.good} of ${t.total} ${word}`;
}

function levelWords(l: LevelRow): string {
  return `${CATEGORY_LABEL[l.category]}: ${l.level} ${LEVEL_LABEL[l.level]}${l.was ? ` (was ${l.was} ${LEVEL_LABEL[l.was]}${l.wasWhen ? ` on ${shortDate(l.wasWhen)}` : ''})` : ''}`;
}

const KIND_WORD: Record<ThrowingEntry['kind'], string> = { game: 'game', bullpen: 'bullpen', practice: 'practice', other_team: 'other team' };

export interface ProgressDraftContext {
  report: ProgressReport;
  coachName?: string;
  /** Opening line the coach typed; optional. */
  personal?: string;
}

/** Short version for a text message: the two best counts, anything that moved up, and what is next. */
export function progressTextDraft(ctx: ProgressDraftContext): string {
  const r = ctx.report;
  const p = r.player;
  const first = p.firstName || 'your player';
  const parent = p.parents?.[0]?.name?.split(' ')[0];
  const lines: string[] = [];
  lines.push(`${parent ? `Hi ${parent}, ` : 'Hi, '}${ctx.coachName ? `Coach ${ctx.coachName}` : 'coach'} here with where ${first} is, from ${stretchWords(r)}.`);
  if (ctx.personal) lines.push(ctx.personal);
  if (r.thin) lines.push('I have not written much down for this stretch yet, so take the counts as a first look.');
  const readable = r.skills.filter((s) => s.recent.total >= 3);
  const best = readable.slice(0, 2);
  if (best.length) lines.push(`Counted reps: ${best.map((s) => `${s.skill.label.toLowerCase()} ${countWords(s.recent, s.skill.word)}${s.trend === 'up' ? ` (up from ${s.before.good} of ${s.before.total})` : ''}`).join('; ')}.`);
  // Only a level the coach raised inside this stretch is news; an older move is on the full page.
  const moved = r.levels.filter((l) => l.was && l.level > l.was && l.changedWhen && r.from && l.changedWhen >= r.from);
  if (moved.length) lines.push(`Moved up: ${moved.map((l) => `${CATEGORY_LABEL[l.category].toLowerCase()} to ${l.level} ${LEVEL_LABEL[l.level].toLowerCase()}`).join(', ')}.`);
  if (r.goalsDone.length) lines.push(`Goal reached: ${r.goalsDone.slice(0, 2).join('; ')}.`);
  const work = readable.filter((s) => !best.includes(s) && s.recent.total >= 5 && s.recent.good / s.recent.total < 0.5).slice(-1)[0];
  if (work) lines.push(`Still working on: ${work.skill.label.toLowerCase()}, ${countWords(work.recent, work.skill.word)}.`);
  if (r.goalsActive.length) lines.push(`What we are working on now: ${r.goalsActive.slice(0, 2).join('; ')}.`);
  lines.push('These are counts from the reps I called out loud, not every rep he took. I can send the full page if you want it.');
  return lines.join('\n');
}

/** Longer version for email: every count, levels, goals, attendance. */
export function progressEmailDraft(ctx: ProgressDraftContext): { subject: string; body: string } {
  const r = ctx.report;
  const p = r.player;
  const first = p.firstName || 'your player';
  const parent = p.parents?.[0]?.name?.split(' ')[0];
  const b: string[] = [];
  b.push(parent ? `Hi ${parent},` : 'Hi,');
  b.push('');
  b.push(`Here is where ${first} is, from ${stretchWords(r)}.`);
  if (ctx.personal) { b.push(''); b.push(ctx.personal); }
  if (r.thin) { b.push(''); b.push('I have not written much down for this stretch yet, so take the counts as a first look.'); }
  if (r.skills.length) {
    b.push('');
    b.push('Counted reps');
    for (const s of r.skills) {
      const beforeBit = s.before.total ? `; before that ${s.before.good} of ${s.before.total}` : '';
      const trendBit = s.trend === 'up' || s.trend === 'down' || s.trend === 'same' ? `. ${TREND_WORD[s.trend]}.` : s.trend === 'not_enough' ? '. Too few reps to call a change.' : '';
      b.push(`- ${s.skill.label}: ${countWords(s.recent, s.skill.word)}${beforeBit}${trendBit}`);
    }
  }
  if (r.levels.length) {
    b.push('');
    b.push('Where I have him by area (1 introducing to 5 game-ready)');
    for (const l of r.levels) b.push(`- ${levelWords(l)}`);
  }
  const e = r.effort;
  if (e.hustle + e.teammate + e.coachable) {
    b.push('');
    b.push(`Effort and attitude I wrote down: hustled ${e.hustle}, picked up a teammate ${e.teammate}, took a cue and used it ${e.coachable}.`);
  }
  if (r.attendance) { b.push(''); b.push(`Team practices since ${shortDate(r.from ?? r.asOf)}: at ${r.attendance.present} of ${r.attendance.total}.`); }
  if (r.goalsDone.length) { b.push(''); b.push('Goals reached'); for (const g of r.goalsDone) b.push(`- ${g}`); }
  if (r.goalsActive.length) { b.push(''); b.push('Working on now'); for (const g of r.goalsActive) b.push(`- ${g}`); }
  b.push('');
  b.push('How to read this: the counts come from the reps I called out loud during drills, not every rep he took. I only call something up or down when the gap is bigger than luck would explain with that many reps. Nothing here compares him with anyone else.');
  b.push('');
  b.push(ctx.coachName ? `Coach ${ctx.coachName}` : 'Coach');
  return { subject: `${first}: how things are going`, body: b.join('\n') };
}

// ---------------------------------------------------------------------------
// Printable page
// ---------------------------------------------------------------------------

const progressCss = `.bar{display:block;width:110px;max-width:100%;height:10px;background:#dde6f2;border-radius:5px;overflow:hidden;margin:2px 0 4px}.ct{white-space:nowrap}.bar b{display:block;height:10px;background:var(--p);border-radius:5px}.tw{font-weight:700}.tw.up{color:#14632d}.tw.down{color:#8a4b00}.note{background:#f4f6fa;border-left:4px solid var(--a);padding:8px 12px;border-radius:4px}`;

/** Printable progress page. The player's own counts, then and now. No teammates anywhere. */
export function renderProgressHtml(r: ProgressReport, opts: { coachName?: string } = {}): string {
  const p = r.player;
  const name = `${p.firstName} ${p.lastName}`.trim();
  const b = brandOf(r.brand ?? {});
  const bar = (t: Tally) => `<span class="bar"><b style="width:${t.total ? Math.round((t.good / t.total) * 100) : 0}%"></b></span>`;
  const skillRows = r.skills
    .map((s) => `<tr><td><strong>${esc(s.skill.label)}</strong></td><td>${bar(s.recent)}<span class="ct">${esc(countWords(s.recent, s.skill.word))}</span></td>${r.hasBefore ? `<td>${s.before.total ? esc(`${s.before.good} of ${s.before.total}`) : '<span class="muted">none counted</span>'}</td><td>${s.trend === 'none' ? '' : `<span class="tw ${s.trend}">${esc(TREND_WORD[s.trend])}</span>`}</td>` : ''}</tr>`)
    .join('');
  const areaRows = r.areas
    .map((a) => `<tr><td><strong>${esc(CATEGORY_LABEL[a.category])}</strong></td><td>${a.good} good, ${a.rough} rough</td>${r.hasBefore ? `<td>${a.beforeGood + a.beforeRough ? `${a.beforeGood} good, ${a.beforeRough} rough` : '<span class="muted">no notes</span>'}</td>` : ''}</tr>`)
    .join('');
  const levelRows = r.levels
    .map((l) => `<tr><td><strong>${esc(CATEGORY_LABEL[l.category])}</strong>${l.status ? `<div class="muted small">${esc(l.status)}</div>` : ''}</td><td>${l.level} ${esc(LEVEL_LABEL[l.level])}</td><td>${l.was ? `was ${l.was} ${esc(LEVEL_LABEL[l.was])}${l.wasWhen ? ` on ${esc(shortDate(l.wasWhen))}` : ''}` : '<span class="muted">no earlier level on record</span>'}</td></tr>`)
    .join('');
  const e = r.effort;
  const stretch = stretchWords(r);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} progress</title><style>${pageCss(b.primary, b.accent, b.ink)}${progressCss}</style></head><body>
${brandHeader(r.brand)}
<h1>${esc(p.firstName)}'s progress${p.number ? ` <span class="muted" style="font-size:16px">#${esc(p.number)}</span>` : ''}</h1>
<div class="muted">${esc(b.name)} · as of ${esc(shortDate(r.asOf))} · ${esc(stretch.replace(/^his /, ''))}</div>
${r.thin ? `<p class="small note"><strong>Not much written down yet.</strong> The counts below are real, but there are too few of them to read much into. This page fills in as the season goes.</p>` : ''}
${r.skills.length ? `<h2>Counted reps</h2>
<p class="small">Reps the coach called out loud during drills, counted. This is ${esc(p.firstName)} measured against ${esc(p.firstName)}, not against anyone else.</p>
<table><thead><tr><th>Skill</th><th>${r.period === 'last' ? 'Last session' : r.period === 'all' ? 'All reps counted' : 'This stretch'}</th>${r.hasBefore ? '<th>Before that</th><th>Change</th>' : ''}</tr></thead><tbody>${skillRows}</tbody></table>` : `<h2>Counted reps</h2><p class="small muted">No reps have been counted for ${esc(p.firstName)} in this stretch yet.</p>`}
${areaRows ? `<h2>The coach's quick reads, by area</h2>
<table><thead><tr><th>Area</th><th>${r.period === 'last' ? 'Last session' : r.period === 'all' ? 'All notes' : 'This stretch'}</th>${r.hasBefore ? '<th>Before that</th>' : ''}</tr></thead><tbody>${areaRows}</tbody></table>` : ''}
${levelRows ? `<h2>Where the coach has him, by area</h2>
<p class="small">The coach's own read for planning practice: 1 introducing, 2 building, 3 steady, 4 reliable, 5 game-ready. Kids move at different speeds in different areas; that is normal and expected.</p>
<table><thead><tr><th>Area</th><th>Now</th><th>Earlier</th></tr></thead><tbody>${levelRows}</tbody></table>` : ''}
${e.hustle + e.teammate + e.coachable ? `<h2>Effort and attitude (what the coach wrote down)</h2><p class="small">Hustled: ${e.hustle} · Picked up a teammate: ${e.teammate} · Took a cue and used it: ${e.coachable}</p>` : ''}
${r.attendance ? `<h2>Team practices</h2><p class="small">At ${r.attendance.present} of the team's ${r.attendance.total} finished practice${r.attendance.total === 1 ? '' : 's'} since ${esc(shortDate(r.from ?? r.asOf))}.</p>` : ''}
${r.throwing.length ? `<h2>Pitches logged</h2><ul class="small">${r.throwing.slice(0, 8).map((t) => `<li>${esc(shortDate(t.date))}, ${esc(KIND_WORD[t.kind])}: ${t.pitches == null ? 'threw, count unknown' : `${t.pitches} pitches`}</li>`).join('')}</ul>` : ''}
${r.goalsDone.length ? `<h2>Goals reached</h2><ul class="small">${r.goalsDone.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
${r.goalsActive.length ? `<h2>Working on now</h2><ul class="small">${r.goalsActive.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
<h2>How to read this</h2>
<p class="small">The counts are only the reps the coach called out, not every rep ${esc(p.firstName)} took, so a small count is a small sample. A change is called "up" or "down" only when both stretches have at least ${MIN_REPS_FOR_TREND} counted reps and the gap is bigger than luck would explain. Otherwise it says about the same, or that there are not enough reps yet. At this age a lot of improvement is also just growing.</p>
<p class="muted small">Nothing here is a ranking or compares ${esc(p.firstName)} with a teammate. It is one coach's notes from limited time with the team${opts.coachName ? `, from Coach ${esc(opts.coachName)}` : ''}.</p>
${brandFooter(r.brand)}
<p class="muted small">Made with Dugout Lab.</p>
</body></html>`;
}
