/**
 * Home work and parent communication.
 *
 * Everything here is a draft the coach reads before it goes anywhere. Nothing is sent by the
 * app. The tone is a coach talking to a parent: what went well first, what we are working on,
 * and two or three things to do in the yard. Never "correction", never a list of other kids.
 *
 * The scorecard shows the player's own levels and recent reads, and the team as a band per
 * area (lowest, middle, highest, how many assessed). No rows for other players.
 */
import type { Category, Drill, DrillVariant, Equipment, Level, Observation, Player, Practice, Team, Settings } from './types';
import { CATEGORY_LABEL, LEVEL_LABEL, STATUS_LABEL, CATEGORIES, localDate } from './types';
import { playerLevel } from './generator';
import { programName as programNameOf, usableAsAccent, inkFor, hexToRgb } from './brand';

/** What a parent-facing page or draft is signed with. */
export interface BrandContext {
  team?: Team;
  settings?: Settings;
  coachName?: string;
}

function brandOf(ctx: BrandContext) {
  const b = ctx.team?.brand;
  const primary = b?.primary && hexToRgb(b.primary) ? usableAsAccent(b.primary) : '#1d4e89';
  const accent = b?.accent && hexToRgb(b.accent) ? b.accent : '#9fb8d8';
  return { name: programNameOf(ctx.team, ctx.settings), tagline: b?.tagline, logo: b?.logo, primary, accent, ink: inkFor(primary), coaches: b?.coaches ?? [], footer: b?.footer };
}

function signature(ctx: BrandContext): string {
  const b = brandOf(ctx);
  const lines: string[] = [];
  lines.push(ctx.coachName ? `Coach ${ctx.coachName}` : 'Coach');
  if (ctx.team) lines.push(b.name);
  const me = b.coaches.find((c) => ctx.coachName && c.name.toLowerCase().includes(ctx.coachName.toLowerCase()));
  const contact = [me?.phone, me?.email].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  return lines.join('\n');
}

/** Gear a family can be expected to have. */
const HOME_GEAR: Equipment[] = ['balls', 'tennis_balls', 'soft_balls', 'wiffle_balls', 'tee', 'net', 'bucket', 'cones', 'gloves', 'bats', 'helmets', 'whiteboard'];

const STOP = new Set(['with', 'then', 'that', 'this', 'from', 'into', 'before', 'after', 'every', 'when', 'what', 'your', 'ball', 'balls', 'clean', 'easy', 'reps', 'build', 'work', 'on', 'the', 'and']);

const GOOD: Observation['read'][] = ['got_it', 'confident', 'reset_worked', 'hustle', 'teammate', 'coachable'];
const ROUGH: Observation['read'][] = ['struggled', 'hesitated', 'frustrated', 'coasting'];

/** Can this drill run in a backyard or at a park with a parent, or alone? */
export function homeFriendly(d: Drill): boolean {
  if (d.archived) return false;
  if (d.space === 'full') return false;
  if (d.coaches > 1) return false;
  if (d.playersMin > 2) return false;
  if (d.throwingLoad === 'high') return false;
  return d.equipment.every((e) => HOME_GEAR.includes(e));
}

export interface HomeDrill {
  drill: Drill;
  /** Why this one, in parent words. */
  why: string;
  /** Objective for this kid (his version or goal), parent-readable. */
  objective: string;
  reps: string;
  cues: string[];
  parentTip: string;
  category: Category;
}

export interface HomePlan {
  playerId: string;
  focus: Array<{ category: Category; text: string }>;
  drills: HomeDrill[];
  mental?: string;
  minutesPerSession: number;
  sessionsPerWeek: number;
  /** Plain reasons so the coach can see where the plan came from. */
  basis: string[];
}

function recentByCategory(obs: Observation[], playerId: string, days = 30, now = new Date()): Map<Category, { good: number; rough: number }> {
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const m = new Map<Category, { good: number; rough: number }>();
  for (const o of obs) {
    if (o.playerId !== playerId || o.ts < since || !o.category) continue;
    const cur = m.get(o.category) ?? { good: 0, rough: 0 };
    if (GOOD.includes(o.read)) cur.good += 1;
    if (ROUGH.includes(o.read)) cur.rough += 1;
    m.set(o.category, cur);
  }
  return m;
}

/** Two or three home drills from the player's goals and recent notes. */
export function homePlanFor(player: Player, drills: Drill[], observations: Observation[], variants: DrillVariant[], opts: { now?: Date; max?: number } = {}): HomePlan {
  const now = opts.now ?? new Date();
  const max = opts.max ?? 3;
  const basis: string[] = [];
  const recent = recentByCategory(observations, player.id, 30, now);
  // Focus areas: active technical goals first, then areas with rough notes, then the lowest assessed level.
  const focus: Array<{ category: Category; text: string; weight: number }> = [];
  for (const g of player.goals.filter((x) => x.status === 'active' && x.kind === 'technical')) {
    focus.push({ category: g.category, text: g.text, weight: 3 });
    basis.push(`Goal: ${CATEGORY_LABEL[g.category]}, "${g.text}".`);
  }
  for (const [c, n] of recent) {
    if (n.rough >= 1 && !focus.some((f) => f.category === c)) {
      focus.push({ category: c, text: `Clean, easy reps on ${CATEGORY_LABEL[c].toLowerCase()}`, weight: 1 + n.rough });
      basis.push(`${n.rough} rough note${n.rough === 1 ? '' : 's'} on ${CATEGORY_LABEL[c].toLowerCase()} in the last 30 days.`);
    }
  }
  if (!focus.length) {
    const assessed = (Object.entries(player.levels) as Array<[Category, Level]>).sort((a, b) => a[1] - b[1]);
    if (assessed.length) {
      focus.push({ category: assessed[0][0], text: `Build ${CATEGORY_LABEL[assessed[0][0]].toLowerCase()}`, weight: 1 });
      basis.push(`Lowest assessed area: ${CATEGORY_LABEL[assessed[0][0]]}.`);
    } else {
      focus.push({ category: 'hitting', text: 'General reps', weight: 1 });
      basis.push('No goals or notes yet; general reps.');
    }
  }
  focus.sort((a, b) => b.weight - a.weight);

  const pool = drills.filter(homeFriendly);
  const picked: HomeDrill[] = [];
  const used = new Set<string>();
  for (const f of focus) {
    if (picked.length >= max) break;
    const lvl = playerLevel(player, f.category);
    // Words in the goal that also appear in a drill's name, tags or objective pull that drill forward ("drop step" finds the drop-step drill).
    const words = f.text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w));
    const overlap = (d: Drill) => {
      const hay = `${d.name} ${d.tags.join(' ')} ${d.objective}`.toLowerCase();
      return words.filter((w) => hay.includes(w)).length;
    };
    const cands = pool
      .filter((d) => !used.has(d.id) && (d.category === f.category || d.also?.includes(f.category)) && d.levelMin <= lvl + 1 && d.levelMax >= lvl - 1)
      .sort((a, b) => overlap(b) - overlap(a) || (a.category === f.category ? 0 : 1) - (b.category === f.category ? 0 : 1) || (a.style === 'blocked' ? 0 : 1) - (b.style === 'blocked' ? 0 : 1) || Math.abs(a.levelMin - lvl) - Math.abs(b.levelMin - lvl));
    const d = cands[0];
    if (!d) continue;
    used.add(d.id);
    const v = variants.find((x) => x.drillId === d.id && x.playerId === player.id);
    const prog = lvl <= 2 ? d.easier : d.objective;
    picked.push({
      drill: d,
      category: f.category,
      why: f.text,
      objective: v?.objective || prog,
      reps: v?.reps || `${Math.max(2, Math.min(4, Math.round(d.minutes / 4)))} sets of 8 to 10, stop while it still looks good`,
      cues: (v?.cues?.length ? v.cues : d.cues).slice(0, 2),
      parentTip: `${d.space === 'half' ? 'Needs a yard or a park. ' : ''}Say one cue, then let him go. Count the good ones out loud. If it falls apart, make it easier: ${d.easier}`
    });
  }
  const mentalGoal = player.goals.find((g) => g.status === 'active' && g.kind === 'mental');
  return {
    playerId: player.id,
    focus: focus.slice(0, 3).map(({ category, text }) => ({ category, text })),
    drills: picked,
    mental: mentalGoal?.text,
    minutesPerSession: Math.min(20, 8 * Math.max(1, picked.length)),
    sessionsPerWeek: 2,
    basis
  };
}

// ---------------------------------------------------------------------------
// Parent update text
// ---------------------------------------------------------------------------

export interface UpdateContext {
  player: Player;
  team?: Team;
  settings?: Settings;
  coachName?: string;
  observations: Observation[];
  practices: Practice[];
  plan: HomePlan;
  /** Window for "lately". */
  sinceDays?: number;
  now?: Date;
  /** Opening line the coach typed; optional. */
  personal?: string;
}

function first(p: Player) {
  return p.firstName || 'your player';
}

function lately(ctx: UpdateContext) {
  const now = ctx.now ?? new Date();
  const since = new Date(now.getTime() - (ctx.sinceDays ?? 14) * 86400000).toISOString();
  const obs = ctx.observations.filter((o) => o.playerId === ctx.player.id && o.ts >= since);
  const wins = obs.filter((o) => GOOD.includes(o.read));
  const rough = obs.filter((o) => ROUGH.includes(o.read));
  const effort = obs.filter((o) => o.read === 'hustle' || o.read === 'teammate' || o.read === 'coachable').length;
  const practicesSince = ctx.practices.filter((p) => p.status === 'done' && p.date >= localDate(since) && p.inputs.presentIds.includes(ctx.player.id)).length;
  return { wins, rough, effort, practicesSince };
}

function winLine(o: Observation): string {
  const area = o.category ? CATEGORY_LABEL[o.category].toLowerCase() : '';
  switch (o.read) {
    case 'got_it': return area ? `nailed a ${area} rep we have been working on` : 'nailed a rep we have been working on';
    case 'confident': return area ? `looked confident on ${area}` : 'looked confident';
    case 'reset_worked': return 'used his reset routine after a mistake and got right back in';
    case 'hustle': return 'hustled';
    case 'teammate': return 'picked up a teammate';
    case 'coachable': return 'took a cue and used it right away';
    default: return o.text ?? '';
  }
}

/** Short version for a text message. */
export function parentTextDraft(ctx: UpdateContext): string {
  const p = ctx.player;
  const { wins, effort } = lately(ctx);
  const parent = p.parents?.[0]?.name?.split(' ')[0];
  const lines: string[] = [];
  lines.push(`${parent ? `Hi ${parent}, ` : 'Hi, '}Coach ${ctx.coachName ?? ''} here with a quick ${first(p)} update.`.replace('Coach  here', 'coach here'));
  if (ctx.personal) lines.push(ctx.personal);
  const w = wins.slice(0, 2).map(winLine).filter(Boolean);
  if (w.length) lines.push(`Good stuff lately: ${first(p)} ${w.join(', and ')}.`);
  if (effort >= 2) lines.push(`Effort has been there, ${effort} times I made a note of it.`);
  if (ctx.plan.focus.length) lines.push(`What we are working on with him: ${ctx.plan.focus.map((f) => f.text.toLowerCase()).join('; ')}.`);
  if (ctx.plan.drills.length) {
    lines.push(`At home, ${ctx.plan.minutesPerSession} min, ${ctx.plan.sessionsPerWeek}x a week:`);
    for (const d of ctx.plan.drills) lines.push(`- ${d.drill.name}: ${d.objective} (${d.reps}). Cue: "${d.cues[0] ?? d.drill.cues[0]}"`);
  }
  if (ctx.plan.mental) lines.push(`One more: ${ctx.plan.mental.toLowerCase()}. Notice it when he does it.`);
  lines.push('No pressure on any of this; a few good reps beats a lot of sloppy ones. Questions anytime.');
  const b = brandOf(ctx);
  if (ctx.team?.brand?.programName) lines.push(`${ctx.coachName ? `Coach ${ctx.coachName}, ` : ''}${b.name}`);
  return lines.join('\n');
}

/** Longer version for email. */
export function parentEmailDraft(ctx: UpdateContext): { subject: string; body: string } {
  const p = ctx.player;
  const { wins, rough, effort, practicesSince } = lately(ctx);
  const parent = p.parents?.[0]?.name?.split(' ')[0];
  const b: string[] = [];
  b.push(`${parent ? `Hi ${parent},` : 'Hi,'}`);
  b.push('');
  b.push(`Quick update on ${first(p)} from the last ${practicesSince || 'few'} practice${practicesSince === 1 ? '' : 's'}.`);
  if (ctx.personal) {
    b.push('');
    b.push(ctx.personal);
  }
  b.push('');
  b.push('What went well');
  const w = wins.slice(0, 4).map(winLine).filter(Boolean);
  if (w.length) for (const x of w) b.push(`- ${first(p)} ${x}`);
  else b.push(`- ${first(p)} is showing up and getting his reps in.`);
  if (effort) b.push(`- Effort and attitude: ${effort} time${effort === 1 ? '' : 's'} I wrote down hustle, being a good teammate, or taking a cue and using it.`);
  b.push('');
  b.push('What we are working on');
  for (const f of ctx.plan.focus) b.push(`- ${CATEGORY_LABEL[f.category]}: ${f.text}`);
  if (rough.length) b.push(`- This is normal work at this age. I saw him work through a rough rep ${rough.length} time${rough.length === 1 ? '' : 's'} and keep going, which is the part that matters.`);
  if (ctx.plan.drills.length) {
    b.push('');
    b.push(`At home (${ctx.plan.minutesPerSession} minutes, ${ctx.plan.sessionsPerWeek} times a week is plenty)`);
    for (const d of ctx.plan.drills) {
      b.push(`${d.drill.name}`);
      b.push(`  Goal: ${d.objective}`);
      b.push(`  Setup: ${d.drill.setup}`);
      d.drill.steps.forEach((s, i) => b.push(`  ${i + 1}. ${s}`));
      b.push(`  Cues: ${d.cues.join(' / ')}`);
      b.push(`  Reps: ${d.reps}`);
      b.push(`  Parent tip: ${d.parentTip}`);
      if (d.drill.links?.length) for (const l of d.drill.links) b.push(`  Watch: ${l.label} ${l.url}`);
      b.push('');
    }
  }
  if (ctx.plan.mental) b.push(`One more thing: ${ctx.plan.mental}. If you see him do it, say so. That is the whole coaching.`);
  b.push('');
  b.push('None of this is homework with a grade. A few good reps beats a lot of sloppy ones, and stopping while it still looks good is the trick. Questions anytime.');
  b.push('');
  b.push(signature(ctx));
  return { subject: `${first(p)}: quick update and a few things for the yard`, body: b.join('\n') };
}

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------

export interface TeamBand {
  category: Category;
  assessed: number;
  low?: Level;
  mid?: number;
  high?: Level;
}

export function teamBands(players: Player[]): TeamBand[] {
  return CATEGORIES.map((c) => {
    const lv = players.map((p) => p.levels[c]).filter((v): v is Level => !!v).sort((a, b) => a - b);
    if (!lv.length) return { category: c, assessed: 0 };
    return { category: c, assessed: lv.length, low: lv[0], mid: lv[Math.floor(lv.length / 2)], high: lv[lv.length - 1] };
  });
}

export interface Scorecard {
  player: Player;
  teamName?: string;
  asOf: string;
  areas: Array<{ category: Category; level?: Level; status?: string; band: TeamBand; good: number; rough: number }>;
  effort: { hustle: number; teammate: number; coachable: number; coasting: number };
  attendance: { present: number; total: number };
  goalsDone: string[];
  goalsActive: string[];
  windowDays: number;
  brand?: BrandContext;
}

export function scorecardFor(player: Player, teamPlayers: Player[], observations: Observation[], practices: Practice[], opts: { sinceDays?: number; now?: Date; teamName?: string; brand?: BrandContext } = {}): Scorecard {
  const now = opts.now ?? new Date();
  const days = opts.sinceDays ?? 30;
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const bands = teamBands(teamPlayers.filter((p) => p.status === 'active'));
  const recent = recentByCategory(observations, player.id, days, now);
  const mine = observations.filter((o) => o.playerId === player.id && o.ts >= since);
  const count = (r: Observation['read']) => mine.filter((o) => o.read === r).length;
  const done = practices.filter((p) => p.status === 'done' && p.date >= localDate(since));
  return {
    player,
    teamName: opts.teamName,
    asOf: now.toISOString().slice(0, 10),
    areas: CATEGORIES.map((c) => ({ category: c, level: player.levels[c], status: player.statuses[c] ? STATUS_LABEL[player.statuses[c]!] : undefined, band: bands.find((b) => b.category === c)!, good: recent.get(c)?.good ?? 0, rough: recent.get(c)?.rough ?? 0 })),
    effort: { hustle: count('hustle'), teammate: count('teammate'), coachable: count('coachable'), coasting: count('coasting') },
    attendance: { present: done.filter((p) => p.inputs.presentIds.includes(player.id)).length, total: done.length },
    goalsDone: player.goals.filter((g) => g.status === 'done' && (g.doneAt ?? '') >= since).map((g) => g.text),
    goalsActive: player.goals.filter((g) => g.status === 'active').map((g) => g.text),
    windowDays: days,
    brand: opts.brand
  };
}

function brandHeader(ctx?: BrandContext): string {
  const b = brandOf(ctx ?? {});
  return `<div class="brandbar">${b.logo ? `<img src="${b.logo}" alt="">` : ''}<div><div class="n">${esc(b.name)}</div>${b.tagline ? `<div class="t">${esc(b.tagline)}</div>` : ''}</div></div>`;
}
function brandFooter(ctx?: BrandContext): string {
  const b = brandOf(ctx ?? {});
  const coaches = b.coaches.length ? `<div class="coaches"><strong>Coaches:</strong> ${b.coaches.map((c) => esc([c.name, c.role ? `(${c.role})` : '', c.phone, c.email].filter(Boolean).join(' '))).join(' · ')}</div>` : '';
  return `${coaches}${b.footer ? `<div class="muted small" style="margin-top:6px">${esc(b.footer)}</div>` : ''}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const pageCss = (primary: string, accent: string, ink: string) => `:root{--p:${primary};--a:${accent};--ink:${ink}}body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:24px;color:#172238;max-width:720px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:18px 0 6px;border-bottom:2px solid var(--p);padding-bottom:3px}.brandbar{display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:3px solid var(--p)}.brandbar img{height:48px;width:48px;object-fit:contain}.brandbar .n{font-weight:800;font-size:18px;color:var(--p)}.brandbar .t{color:#667;font-size:13px}.coaches{margin-top:18px;padding-top:10px;border-top:1px solid #dde;font-size:13px;color:#445}.muted{color:#667}.small{font-size:13px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #dde;padding:6px 4px;text-align:left}th{font-weight:700;color:var(--p)}.band{display:inline-block;height:10px;background:#dde6f2;border-radius:5px;position:relative;width:120px;vertical-align:middle}.band i{position:absolute;top:-3px;width:16px;height:16px;border-radius:50%;background:var(--p);margin-left:-8px}.band b{position:absolute;top:0;height:10px;background:var(--a);opacity:.7;border-radius:5px}.cue{display:inline-block;background:#eef2f7;border-radius:6px;padding:2px 8px;margin:2px 4px 2px 0;font-weight:600;font-size:13px}ol{padding-left:20px}@media print{body{margin:12px}}`;

/** Printable scorecard. The player's own numbers; the team as a band. */
export function renderScorecardHtml(card: Scorecard): string {
  const p = card.player;
  const name = `${p.firstName} ${p.lastName}`.trim();
  const rows = card.areas
    .filter((a) => a.level || a.good || a.rough || a.band.assessed)
    .map((a) => {
      const pct = (v: number) => ((v - 1) / 4) * 100;
      const band = a.band.assessed && a.band.low && a.band.high ? `<span class="band"><b style="left:${pct(a.band.low)}%;width:${Math.max(4, pct(a.band.high) - pct(a.band.low))}%"></b>${a.level ? `<i style="left:${pct(a.level)}%"></i>` : ''}</span>` : '<span class="muted small">no team data yet</span>';
      return `<tr><td><strong>${esc(CATEGORY_LABEL[a.category])}</strong>${a.status ? `<div class="muted small">${esc(a.status)}</div>` : ''}</td><td>${a.level ? `${a.level} ${esc(LEVEL_LABEL[a.level])}` : '<span class="muted">not yet assessed</span>'}</td><td>${band}<div class="muted small">team ${a.band.assessed ? `${a.band.low} to ${a.band.high}, middle ${a.band.mid}, ${a.band.assessed} assessed` : ''}</div></td><td>${a.good || a.rough ? `${a.good} good, ${a.rough} rough` : '<span class="muted">no notes</span>'}</td></tr>`;
    })
    .join('');
  const e = card.effort;
  const b = brandOf(card.brand ?? {});
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} scorecard</title><style>${pageCss(b.primary, b.accent, b.ink)}</style></head><body>
${brandHeader(card.brand)}
<h1>${esc(name)}${p.number ? ` #${esc(p.number)}` : ''}</h1>
<div class="muted">${esc(card.teamName ?? b.name)} · as of ${card.asOf} · last ${card.windowDays} days</div>
<p class="small">Levels are the coach's own assessment for planning practice: 1 introducing, 2 building, 3 steady, 4 reliable, 5 game-ready. The dot is ${esc(p.firstName)}; the bar is where the team sits in that area. Kids move at different speeds in different areas; that is normal and expected.</p>
<h2>By area</h2>
<table><thead><tr><th>Area</th><th>${esc(p.firstName)}</th><th>Team band</th><th>Practice notes</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Effort and attitude (what the coach wrote down)</h2>
<p class="small">Hustled: ${e.hustle} · Picked up a teammate: ${e.teammate} · Took a cue and used it: ${e.coachable}</p>
<h2>Attendance</h2>
<p class="small">${card.attendance.present} of ${card.attendance.total} practices in the last ${card.windowDays} days.</p>
${card.goalsDone.length ? `<h2>Goals reached</h2><ul class="small">${card.goalsDone.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
${card.goalsActive.length ? `<h2>Working on now</h2><ul class="small">${card.goalsActive.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
<p class="muted small">Nothing here is a ranking; it is one coach's notes from limited time with the team, meant to help at home.</p>
${brandFooter(card.brand)}
<p class="muted small">Made with Dugout Lab.</p>
</body></html>`;
}

/** Printable home plan. */
export function renderHomePlanHtml(player: Player, plan: HomePlan, opts: { coachName?: string; teamName?: string; brand?: BrandContext } = {}): string {
  const b = brandOf(opts.brand ?? {});
  const name = `${player.firstName} ${player.lastName}`.trim();
  const drills = plan.drills
    .map((d) => `<h2>${esc(d.drill.name)} <span class="muted small">(${esc(CATEGORY_LABEL[d.category])})</span></h2>
<p class="small"><strong>Why:</strong> ${esc(d.why)}<br><strong>Goal for ${esc(player.firstName)}:</strong> ${esc(d.objective)}<br><strong>Setup:</strong> ${esc(d.drill.setup)}</p>
<ol class="small">${d.drill.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<div>${d.cues.map((c) => `<span class="cue">${esc(c)}</span>`).join('')}</div>
<p class="small"><strong>Reps:</strong> ${esc(d.reps)}<br><strong>Looks right when:</strong> ${esc(d.drill.success)}<br><strong>Parent tip:</strong> ${esc(d.parentTip)}</p>
${d.drill.links?.length ? `<p class="small">Watch: ${d.drill.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</p>` : ''}`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} home plan</title><style>${pageCss(b.primary, b.accent, b.ink)}</style></head><body>
${brandHeader(opts.brand)}
<h1>${esc(player.firstName)}'s yard work</h1>
<div class="muted">${esc(opts.teamName ?? b.name)} · ${plan.minutesPerSession} minutes, ${plan.sessionsPerWeek} times a week · from ${opts.coachName ? `Coach ${esc(opts.coachName)}` : 'your coach'}</div>
<p class="small">What we are working on: ${plan.focus.map((f) => esc(f.text)).join('; ')}.${plan.mental ? ` And one more: ${esc(plan.mental)}.` : ''}</p>
${drills}
<p class="small">Rules of the yard: one cue at a time, count the good ones out loud, stop while it still looks good. If it falls apart, make it easier, not longer.</p>
${brandFooter(opts.brand)}
<p class="muted small">Made with Dugout Lab.</p>
</body></html>`;
}

/** Players who have had `every` finished practices since their last update (or never had one). */
export function dueForUpdate(players: Player[], practices: Practice[], updates: Array<{ playerId: string; ts: string }>, every: number): Array<{ player: Player; practicesSince: number; last?: string }> {
  const done = practices.filter((p) => p.status === 'done').sort((a, b) => a.date.localeCompare(b.date));
  return players
    .filter((p) => p.status === 'active' && p.share !== 'none')
    .map((p) => {
      const last = updates.filter((u) => u.playerId === p.id).sort((a, b) => b.ts.localeCompare(a.ts))[0]?.ts;
      const since = done.filter((x) => x.inputs.presentIds.includes(p.id) && (!last || x.date > localDate(last))).length;
      return { player: p, practicesSince: since, last };
    })
    .filter((x) => x.practicesSince >= every)
    .sort((a, b) => b.practicesSince - a.practicesSince);
}

/** sms: and mailto: links that open the phone's own apps with the draft filled in. Nothing is sent until the coach taps send. */
export function smsLink(phone: string, body: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `sms:${digits}?&body=${encodeURIComponent(body)}`;
}
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
