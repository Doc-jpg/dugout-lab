/**
 * Practice generator.
 *
 * Pure functions: give it the team, players, drills, saved variants, recent practices and
 * the inputs for today, get back a station-based practice with a per-player objective at
 * every station. Deterministic for a given seed so tests are stable.
 *
 * Rules the generator keeps:
 *  - nobody stands around: stations run in parallel and groups rotate
 *  - every present player has an objective at every station, and a reason for it
 *  - a saved player-specific variant of a drill always wins over the generic objective
 *  - recently used drills are discouraged, not banned (retention checks are real)
 *  - throwing load respects the coach's no-throwing list; unknown workload is never "cleared"
 *  - the coach can change anything afterwards; the plan is a draft, not an order
 */
import type {
  Block, BlockKind, Category, Drill, DrillVariant, Equipment, Group, Level, Observation, Player, PlayerObjective,
  Practice, PracticeInputs, Settings, Space, Station, Team, ThrowingEntry, ISODate
} from './types';
import { BLOCK_LABEL, CATEGORY_LABEL, ageOf, newId, nowIso, today, teamAgeGroup } from './types';
import { throwingFlags } from './pitchsmart';

export interface GeneratorContext {
  team: Team;
  players: Player[];
  drills: Drill[];
  variants: DrillVariant[];
  /** Most recent first. */
  recentPractices: Practice[];
  observations: Observation[];
  throwing: ThrowingEntry[];
  settings: Settings;
  seed?: number;
  date?: ISODate;
}

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Time budget
// ---------------------------------------------------------------------------

const SPACE_RANK: Record<Space, number> = { tight: 0, half: 1, full: 2 };
/** Equipment every team has; never a reason to exclude a drill. */
const ALWAYS: Equipment[] = ['balls', 'gloves', 'bats', 'helmets'];

export interface BlockBudget {
  kind: BlockKind;
  minutes: number;
}

/** Split the practice into blocks. Short practices drop the compete block; very short ones drop reflection. */
export function blockBudget(durationMin: number): BlockBudget[] {
  const d = Math.max(20, Math.round(durationMin));
  const parts: Array<[BlockKind, number]> = [
    ['warmup', 0.12],
    ['fundamentals', 0.22],
    ['focus', 0.3],
    ['gamelike', 0.2],
    ['compete', 0.11],
    ['reflect', 0.05]
  ];
  let kinds = parts;
  if (d < 45) kinds = parts.filter(([k]) => k !== 'compete');
  if (d < 30) kinds = kinds.filter(([k]) => k !== 'reflect');
  const total = kinds.reduce((s, [, w]) => s + w, 0);
  const out: BlockBudget[] = kinds.map(([kind, w]) => ({ kind, minutes: Math.round((d * w) / total) }));
  // Clamp warm-up and reflection to sensible sizes, give the remainder to focus.
  for (const b of out) {
    if (b.kind === 'warmup') b.minutes = Math.min(15, Math.max(6, b.minutes));
    if (b.kind === 'reflect') b.minutes = Math.min(6, Math.max(3, b.minutes));
  }
  const sum = out.reduce((s, b) => s + b.minutes, 0);
  const focus = out.find((b) => b.kind === 'focus') ?? out[1];
  focus.minutes += d - sum;
  return out;
}

// ---------------------------------------------------------------------------
// Players, levels and groups
// ---------------------------------------------------------------------------

export function playerLevel(p: Player, category: Category): Level {
  return p.levels[category] ?? (averageLevel(p) as Level);
}

export function averageLevel(p: Player): number {
  const vals = Object.values(p.levels).filter((v): v is Level => !!v);
  if (!vals.length) return 3;
  return Math.max(1, Math.min(5, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)));
}

/** How many stations to run: enough that groups are 3-5 kids, never more than coaches + one player-led station, max 4. */
export function stationCount(present: number, coaches: number): number {
  if (present <= 0) return 1;
  const byGroups = Math.ceil(present / 4);
  return Math.max(1, Math.min(4, byGroups, Math.max(1, coaches) + 1));
}

/** Snake-draft players into n groups by level so groups are balanced (mixed). */
export function balancedGroups(players: Player[], n: number, category?: Category): Group[] {
  const sorted = [...players].sort((a, b) => (category ? playerLevel(b, category) : averageLevel(b)) - (category ? playerLevel(a, category) : averageLevel(a)) || a.lastName.localeCompare(b.lastName));
  const groups: Group[] = Array.from({ length: n }, (_, i) => ({ id: newId(), name: `Group ${String.fromCharCode(65 + i)}`, playerIds: [] }));
  sorted.forEach((p, i) => {
    const round = Math.floor(i / n);
    const idx = round % 2 === 0 ? i % n : n - 1 - (i % n);
    groups[idx].playerIds.push(p.id);
  });
  return groups.filter((g) => g.playerIds.length > 0);
}

/** Group players with similar level together (for the focus block, so a station can run one progression). */
export function similarGroups(players: Player[], n: number, category?: Category): Group[] {
  const sorted = [...players].sort((a, b) => (category ? playerLevel(b, category) : averageLevel(b)) - (category ? playerLevel(a, category) : averageLevel(a)) || a.lastName.localeCompare(b.lastName));
  const size = Math.ceil(sorted.length / n);
  const groups: Group[] = [];
  for (let i = 0; i < n; i++) {
    const ids = sorted.slice(i * size, (i + 1) * size).map((p) => p.id);
    if (ids.length) groups.push({ id: newId(), name: `Group ${String.fromCharCode(65 + i)}`, playerIds: ids });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Category weights and drill scoring
// ---------------------------------------------------------------------------

export function categoryWeights(inputs: PracticeInputs, players: Player[], recent: Practice[]): Map<Category, number> {
  const w = new Map<Category, number>();
  const bump = (c: Category, n: number) => w.set(c, (w.get(c) ?? 0) + n);
  inputs.teamPriorities.forEach((c, i) => bump(c, Math.max(1, 3 - i)));
  for (const p of players) {
    for (const c of inputs.playerPriorities[p.id] ?? []) bump(c, 0.6);
    for (const [c, s] of Object.entries(p.statuses)) if (s === 'review') bump(c as Category, 0.8);
    for (const g of p.goals) if (g.status === 'active' && g.kind === 'technical') bump(g.category, 0.3);
  }
  // Something for everyone: a small floor so a category is never impossible.
  for (const c of Object.keys(CATEGORY_LABEL) as Category[]) bump(c, 0.2);
  // Last practice's heavy categories get a little less so the week has a mix.
  const last = recent[0];
  if (last) {
    const used = new Set<Category>();
    for (const b of last.blocks) for (const s of b.stations) used.add(categoryOfStation(s, last));
    for (const c of used) w.set(c, (w.get(c) ?? 0) * 0.75);
  }
  for (const c of inputs.avoid ?? []) w.set(c, 0);
  return w;
}

function categoryOfStation(s: Station, p: Practice): Category {
  // Drills are not stored on the practice; the category is remembered in notes by the generator.
  const m = /^category:(\w+)/.exec(s.notes ?? '');
  return (m?.[1] as Category) ?? 'hitting';
}

const BLOCK_STYLE: Record<BlockKind, Drill['style'][]> = {
  warmup: ['blocked', 'variable', 'game'],
  fundamentals: ['blocked', 'variable'],
  focus: ['variable', 'blocked', 'decision'],
  gamelike: ['random', 'decision', 'game', 'variable'],
  compete: ['game', 'random'],
  reflect: ['blocked', 'variable', 'game', 'random', 'decision']
};

export interface DrillFilter {
  kind: BlockKind;
  inputs: PracticeInputs;
  groupSize: number;
  coachAvailable: boolean;
  levelRange: [Level, Level];
  ageGroup: Team['ageGroup'];
  anyNoThrow: boolean;
}


export function drillFits(d: Drill, f: DrillFilter): boolean {
  if (d.archived) return false;
  if (!d.blocks.includes(f.kind)) return false;
  if (f.inputs.indoor && !d.indoorOk) return false;
  if (SPACE_RANK[d.space] > SPACE_RANK[f.inputs.space]) return false;
  if (d.ageMin && ageOf(d.ageMin) > ageOf(f.ageGroup)) return false;
  const have = new Set<Equipment>([...ALWAYS, ...f.inputs.equipment]);
  for (const e of d.equipment) if (!have.has(e)) return false;
  if (d.coaches >= 1 && !f.coachAvailable && f.kind !== 'warmup' && f.kind !== 'compete' && f.kind !== 'reflect') return false;
  if (f.kind !== 'warmup' && f.kind !== 'compete' && f.kind !== 'reflect') {
    if (f.groupSize < d.playersMin - 1 || f.groupSize > d.playersMax + 2) return false;
  }
  // Level overlap with the group
  if (d.levelMax < f.levelRange[0] - 1 || d.levelMin > f.levelRange[1] + 1) return false;
  if (f.anyNoThrow && d.throwingLoad === 'high') return false;
  return true;
}

/** Hard rules never relax: indoors, space, equipment, no high load for resting arms. Soft ones (group size, coach, level) relax step by step. */
export function candidatePool(drills: Drill[], f: DrillFilter, exclude: Set<string>): Drill[] {
  const hard = (d: Drill) => {
    if (d.archived || exclude.has(d.id)) return false;
    if (f.inputs.indoor && !d.indoorOk) return false;
    if (SPACE_RANK[d.space] > SPACE_RANK[f.inputs.space]) return false;
    const have = new Set<Equipment>([...ALWAYS, ...f.inputs.equipment]);
    for (const e of d.equipment) if (!have.has(e)) return false;
    if (f.anyNoThrow && d.throwingLoad === 'high') return false;
    return true;
  };
  let pool = drills.filter((d) => hard(d) && drillFits(d, f));
  if (!pool.length) pool = drills.filter((d) => hard(d) && d.blocks.includes(f.kind));
  if (!pool.length) pool = drills.filter(hard);
  return pool;
}

export function scoreDrill(d: Drill, kind: BlockKind, weights: Map<Category, number>, recentDrillIds: Map<string, number>, rnd: () => number, usedCategories: Category[]): number {
  let s = (weights.get(d.category) ?? 0) * 2;
  for (const c of d.also ?? []) s += (weights.get(c) ?? 0) * 0.5;
  const styles = BLOCK_STYLE[kind];
  const si = styles.indexOf(d.style);
  s += si >= 0 ? (styles.length - si) * 0.5 : -1;
  const ago = recentDrillIds.get(d.id);
  if (ago !== undefined) s *= ago === 0 ? 0.3 : 0.6; // used last practice / the one before
  // Spread categories across stations in the same block
  if (usedCategories.includes(d.category)) s *= 0.5;
  if (kind === 'focus' && d.mentalHook) s += 0.2;
  if (kind === 'gamelike' && d.decisionHook) s += 0.4;
  s += rnd() * 0.8;
  return s;
}

/** Drill ids used in the last two practices, with 0 = last practice, 1 = the one before. */
export function recentDrillMap(recent: Practice[]): Map<string, number> {
  const m = new Map<string, number>();
  recent.slice(0, 2).forEach((p, i) => {
    for (const b of p.blocks) for (const s of b.stations) if (!m.has(s.drillId)) m.set(s.drillId, i);
  });
  return m;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export function objectiveFor(p: Player, drill: Drill, variants: DrillVariant[], opts: { noThrow: boolean; progression?: Station['progression']; kind: BlockKind }): PlayerObjective {
  const variant = variants.find((v) => v.drillId === drill.id && v.playerId === p.id);
  const mentalGoal = p.goals.find((g) => g.status === 'active' && g.kind === 'mental');
  const noThrowPrefix = opts.noThrow && drill.throwingLoad !== 'none' ? 'No throws today (arm rest): field it, flip underhand or hand it to a partner. ' : '';
  if (variant) {
    return {
      playerId: p.id,
      technical: noThrowPrefix + (variant.objective || drill.objective) + (variant.reps ? ` (${variant.reps})` : ''),
      mental: variant.mental ?? mentalGoal?.text,
      variantId: variant.id,
      from: 'variant'
    };
  }
  const cats = [drill.category, ...(drill.also ?? [])];
  const goal = p.goals.find((g) => g.status === 'active' && g.kind === 'technical' && cats.includes(g.category));
  if (goal) {
    return { playerId: p.id, technical: noThrowPrefix + goal.text, mental: mentalGoal?.text ?? (opts.kind === 'focus' ? drill.mentalHook : undefined), from: 'goal' };
  }
  const lvl = playerLevel(p, drill.category);
  const prog = opts.progression ?? (lvl <= 2 ? 'easier' : lvl >= 4 ? 'harder' : 'base');
  const text = prog === 'easier' ? drill.easier : prog === 'harder' ? drill.harder : drill.objective;
  return { playerId: p.id, technical: noThrowPrefix + text, mental: mentalGoal?.text ?? (opts.kind === 'focus' ? drill.mentalHook : undefined), from: prog === 'base' ? 'drill' : 'level' };
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

export function generatePractice(inputs: PracticeInputs, ctx: GeneratorContext, opts: { date?: ISODate; time?: string; title?: string } = {}): Practice {
  const rnd = mulberry32(ctx.seed ?? Date.now());
  const rationale: string[] = [];
  const present = ctx.players.filter((p) => inputs.presentIds.includes(p.id));
  const flags = throwingFlags(ctx.players, ctx.throwing, teamAgeGroup(ctx.team), opts.date ?? ctx.date ?? today());
  const noThrow = new Set(inputs.noThrowingIds);
  for (const p of present) {
    const f = flags.get(p.id);
    if (f && f.status !== 'ok' && !noThrow.has(p.id)) rationale.push(`${p.firstName}: ${f.message} (not on today's no-throwing list; add him if you are not sure).`);
  }
  if (noThrow.size) rationale.push(`No throwing today for ${present.filter((p) => noThrow.has(p.id)).map((p) => p.firstName).join(', ')}: high-load drills were skipped and their station objectives say so.`);

  const weights = categoryWeights(inputs, present, ctx.recentPractices);
  const recent = recentDrillMap(ctx.recentPractices);
  const budget = blockBudget(inputs.durationMin);
  const nStations = stationCount(present.length, inputs.coaches);
  const usedDrills = new Set<string>();
  const blocks: Block[] = [];
  let clock = 0;

  const pickDrill = (kind: BlockKind, groupSize: number, coachAvailable: boolean, levelRange: [Level, Level], usedCats: Category[], exclude: Set<string>): Drill | undefined => {
    const filter: DrillFilter = { kind, inputs, groupSize, coachAvailable, levelRange, ageGroup: teamAgeGroup(ctx.team), anyNoThrow: noThrow.size > 0 };
    const pool = candidatePool(ctx.drills, filter, exclude);
    if (!pool.length) return undefined;
    let best: Drill | undefined;
    let bestScore = -Infinity;
    for (const d of pool) {
      const s = scoreDrill(d, kind, weights, recent, rnd, usedCats);
      if (s > bestScore) {
        bestScore = s;
        best = d;
      }
    }
    return best;
  };

  const levelRangeOf = (ids: string[], cat?: Category): [Level, Level] => {
    const lv = ids.map((id) => ctx.players.find((p) => p.id === id)).filter((p): p is Player => !!p).map((p) => (cat ? playerLevel(p, cat) : (averageLevel(p) as Level)));
    if (!lv.length) return [1, 5];
    return [Math.min(...lv) as Level, Math.max(...lv) as Level];
  };

  for (const b of budget) {
    const wholeTeam = b.kind === 'warmup' || b.kind === 'compete' || b.kind === 'reflect';
    const block: Block = { id: newId(), kind: b.kind, title: BLOCK_LABEL[b.kind], startMin: clock, minutes: b.minutes, stations: [], groups: [], rotationMin: b.minutes, wholeTeam };
    if (wholeTeam) {
      block.groups = [{ id: newId(), name: 'Everyone', playerIds: present.map((p) => p.id) }];
      const count = b.kind === 'warmup' && b.minutes >= 10 ? 2 : 1;
      const cats: Category[] = [];
      for (let i = 0; i < count; i++) {
        const d = pickDrill(b.kind, present.length, inputs.coaches > 0, levelRangeOf(present.map((p) => p.id)), cats, usedDrills);
        if (!d) continue;
        usedDrills.add(d.id);
        cats.push(d.category);
        block.stations.push(makeStation(d, present, ctx.variants, noThrow, b.kind));
      }
      // Whole-team drills run one after another, not in parallel.
      block.rotationMin = block.stations.length ? Math.floor(b.minutes / block.stations.length) : b.minutes;
    } else {
      const n = Math.min(nStations, Math.max(1, Math.ceil(present.length / 3)));
      block.groups = b.kind === 'focus' ? similarGroups(present, n) : balancedGroups(present, n);
      block.rotationMin = Math.max(4, Math.floor(b.minutes / Math.max(1, block.groups.length)));
      const usedCats: Category[] = [];
      for (let i = 0; i < block.groups.length; i++) {
        const coachAvailable = i < inputs.coaches; // the last station may be player-led
        const groupSize = Math.max(...block.groups.map((g) => g.playerIds.length));
        const levelRange: [Level, Level] = b.kind === 'focus' ? levelRangeOf(block.groups[i].playerIds) : levelRangeOf(present.map((p) => p.id));
        const d = pickDrill(b.kind, groupSize, coachAvailable, levelRange, usedCats, usedDrills);
        if (!d) continue;
        usedDrills.add(d.id);
        usedCats.push(d.category);
        const st = makeStation(d, present, ctx.variants, noThrow, b.kind);
        st.coach = coachAvailable ? `Coach ${i + 1}` : 'Player-led (bucket and a task)';
        block.stations.push(st);
      }
    }
    blocks.push(block);
    clock += b.minutes;
  }

  const prioritiesText = inputs.teamPriorities.map((c) => CATEGORY_LABEL[c]).join(', ');
  rationale.unshift(`${present.length} players, ${inputs.coaches} coach${inputs.coaches === 1 ? '' : 'es'}, ${inputs.durationMin} minutes${inputs.indoor ? ', indoors' : ''}. Team priorities: ${prioritiesText || 'none set'}.`);
  rationale.push('Focus block groups kids by similar level so each station can run one progression; the other blocks mix levels so everyone sees everyone.');
  const recentlyAvoided = [...recent.keys()].filter((id) => !usedDrills.has(id)).length;
  if (ctx.recentPractices.length) rationale.push(`Drills from the last two practices were discouraged (not banned); ${recentlyAvoided} of them stayed out this time.`);
  if (inputs.absentIds.length) rationale.push(`Absent: ${inputs.absentIds.map((id) => ctx.players.find((p) => p.id === id)?.firstName ?? '?').join(', ')}. Their objectives roll forward to the next practice.`);

  const ts = nowIso();
  return {
    id: newId(),
    teamId: inputs.teamId,
    date: opts.date ?? ctx.date ?? today(),
    time: opts.time,
    title: opts.title,
    status: 'planned',
    inputs,
    blocks,
    rationale,
    createdAt: ts,
    updatedAt: ts
  };
}

function makeStation(d: Drill, present: Player[], variants: DrillVariant[], noThrow: Set<string>, kind: BlockKind): Station {
  return {
    id: newId(),
    drillId: d.id,
    notes: `category:${d.category}`,
    progression: 'base',
    objectives: present.map((p) => objectiveFor(p, d, variants, { noThrow: noThrow.has(p.id), kind }))
  };
}

// ---------------------------------------------------------------------------
// Edits that keep the rest of the plan
// ---------------------------------------------------------------------------

/** Swap one station's drill for another that fits, keeping every other station exactly as it was. */
export function regenerateStation(practice: Practice, blockId: string, stationId: string, ctx: GeneratorContext, opts: { category?: Category; easier?: boolean } = {}): Practice {
  const rnd = mulberry32(ctx.seed ?? Date.now());
  const block = practice.blocks.find((b) => b.id === blockId);
  if (!block) return practice;
  const st = block.stations.find((s) => s.id === stationId);
  if (!st) return practice;
  const present = ctx.players.filter((p) => practice.inputs.presentIds.includes(p.id));
  const noThrow = new Set(practice.inputs.noThrowingIds);
  const exclude = new Set<string>();
  for (const b of practice.blocks) for (const s of b.stations) exclude.add(s.drillId);
  const groupSize = Math.max(1, ...block.groups.map((g) => g.playerIds.length));
  const coachAvailable = !/Player-led/.test(st.coach ?? '') || block.wholeTeam;
  const weights = categoryWeights(practice.inputs, present, ctx.recentPractices);
  if (opts.category) weights.set(opts.category, (weights.get(opts.category) ?? 0) + 10);
  const recent = recentDrillMap(ctx.recentPractices);
  const filter: DrillFilter = {
    kind: block.kind,
    inputs: practice.inputs,
    groupSize,
    coachAvailable,
    levelRange: [1, 5],
    ageGroup: teamAgeGroup(ctx.team),
    anyNoThrow: noThrow.size > 0
  };
  let pool = candidatePool(ctx.drills, filter, exclude);
  if (opts.category) pool = pool.filter((d) => d.category === opts.category || d.also?.includes(opts.category!)).concat(pool.filter((d) => d.category !== opts.category));
  if (!pool.length) return practice;
  const usedCats = block.stations.filter((s) => s.id !== stationId).map((s) => categoryOfStation(s, practice));
  let best = pool[0];
  let bestScore = -Infinity;
  for (const d of pool) {
    const s = scoreDrill(d, block.kind, weights, recent, rnd, usedCats);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  const next = makeStation(best, present, ctx.variants, noThrow, block.kind);
  next.id = st.id;
  next.coach = st.coach;
  if (opts.easier) {
    next.progression = 'easier';
    next.objectives = present.map((p) => objectiveFor(p, best, ctx.variants, { noThrow: noThrow.has(p.id), progression: 'easier', kind: block.kind }));
  }
  return {
    ...practice,
    blocks: practice.blocks.map((b) => (b.id !== blockId ? b : { ...b, stations: b.stations.map((s) => (s.id === stationId ? next : s)) })),
    rationale: [...practice.rationale, `Station changed: ${best.name} replaced the previous drill in ${block.title}.`],
    updatedAt: nowIso()
  };
}

/** Put a specific drill on a station (coach's pick). Objectives are rebuilt for the new drill; coach-set ones are kept. */
export function setStationDrill(practice: Practice, blockId: string, stationId: string, drill: Drill, ctx: GeneratorContext): Practice {
  const block = practice.blocks.find((b) => b.id === blockId);
  const st = block?.stations.find((s) => s.id === stationId);
  if (!block || !st) return practice;
  const noThrow = new Set(practice.inputs.noThrowingIds);
  const present = ctx.players.filter((p) => practice.inputs.presentIds.includes(p.id));
  const next = makeStation(drill, present, ctx.variants, noThrow, block.kind);
  next.id = st.id;
  next.coach = st.coach;
  next.objectives = next.objectives.map((o) => {
    const prev = st.objectives.find((x) => x.playerId === o.playerId);
    return prev?.from === 'coach' ? prev : o;
  });
  return {
    ...practice,
    blocks: practice.blocks.map((b) => (b.id !== blockId ? b : { ...b, stations: b.stations.map((s) => (s.id === stationId ? next : s)) })),
    rationale: [...practice.rationale, `Station changed by the coach: ${drill.name} in ${block.title}.`],
    updatedAt: nowIso()
  };
}

/** Make a station easier (or back to base / harder) without changing the drill. Saved variants are kept. */
export function setStationProgression(practice: Practice, blockId: string, stationId: string, progression: NonNullable<Station['progression']>, ctx: GeneratorContext): Practice {
  const block = practice.blocks.find((b) => b.id === blockId);
  const st = block?.stations.find((s) => s.id === stationId);
  const drill = st && ctx.drills.find((d) => d.id === st.drillId);
  if (!block || !st || !drill) return practice;
  const noThrow = new Set(practice.inputs.noThrowingIds);
  const present = ctx.players.filter((p) => practice.inputs.presentIds.includes(p.id));
  const objectives = present.map((p) => {
    const existing = st.objectives.find((o) => o.playerId === p.id);
    if (existing?.from === 'variant' || existing?.from === 'coach') return existing;
    return objectiveFor(p, drill, ctx.variants, { noThrow: noThrow.has(p.id), progression, kind: block.kind });
  });
  return {
    ...practice,
    blocks: practice.blocks.map((b) => (b.id !== blockId ? b : { ...b, stations: b.stations.map((s) => (s.id === stationId ? { ...s, progression, objectives } : s)) })),
    updatedAt: nowIso()
  };
}

export type Adjustment =
  | { kind: 'duration'; minutes: number }
  | { kind: 'coaches'; coaches: number }
  | { kind: 'remove_player'; playerId: string }
  | { kind: 'add_player'; playerId: string }
  | { kind: 'indoor' }
  | { kind: 'equipment'; equipment: Equipment[] }
  | { kind: 'no_throwing'; playerId: string };

/**
 * One-tap adjustments. Each keeps every personalized objective it can and only
 * regenerates the stations that no longer fit.
 */
export function adjustPractice(practice: Practice, change: Adjustment, ctx: GeneratorContext): Practice {
  let p: Practice = { ...practice, inputs: { ...practice.inputs }, blocks: practice.blocks.map((b) => ({ ...b, stations: b.stations.map((s) => ({ ...s })), groups: b.groups.map((g) => ({ ...g, playerIds: [...g.playerIds] })) })) };
  const note = (t: string) => (p.rationale = [...p.rationale, t]);

  switch (change.kind) {
    case 'duration': {
      const budget = blockBudget(change.minutes);
      const keep = new Set(budget.map((b) => b.kind));
      const dropped = p.blocks.filter((b) => !keep.has(b.kind)).map((b) => b.title);
      p.blocks = p.blocks.filter((b) => keep.has(b.kind));
      let clock = 0;
      for (const b of p.blocks) {
        const minutes = budget.find((x) => x.kind === b.kind)?.minutes ?? b.minutes;
        b.minutes = minutes;
        b.startMin = clock;
        b.rotationMin = b.wholeTeam ? Math.floor(minutes / Math.max(1, b.stations.length)) : Math.max(4, Math.floor(minutes / Math.max(1, b.groups.length)));
        clock += minutes;
      }
      p.inputs.durationMin = change.minutes;
      note(`Practice set to ${change.minutes} minutes; every station kept its drill and each player's objective${dropped.length ? `; dropped: ${dropped.join(', ')}` : ''}.`);
      break;
    }
    case 'coaches': {
      p.inputs.coaches = change.coaches;
      const present = ctx.players.filter((x) => p.inputs.presentIds.includes(x.id));
      const n = stationCount(present.length, change.coaches);
      for (const b of p.blocks) {
        if (b.wholeTeam) continue;
        if (b.stations.length > n) {
          // Merge: keep the first n stations, re-split the groups among them.
          b.stations = b.stations.slice(0, n);
          b.groups = b.kind === 'focus' ? similarGroups(present, n) : balancedGroups(present, n);
          b.rotationMin = Math.max(4, Math.floor(b.minutes / Math.max(1, b.groups.length)));
        }
        b.stations.forEach((s, i) => (s.coach = i < change.coaches ? `Coach ${i + 1}` : 'Player-led (bucket and a task)'));
      }
      note(`${change.coaches} coach${change.coaches === 1 ? '' : 'es'} now: stations merged to ${n} per block; objectives kept.`);
      break;
    }
    case 'remove_player': {
      const pl = ctx.players.find((x) => x.id === change.playerId);
      p.inputs.presentIds = p.inputs.presentIds.filter((id) => id !== change.playerId);
      if (!p.inputs.absentIds.includes(change.playerId)) p.inputs.absentIds = [...p.inputs.absentIds, change.playerId];
      for (const b of p.blocks) {
        for (const g of b.groups) g.playerIds = g.playerIds.filter((id) => id !== change.playerId);
        b.groups = b.groups.filter((g) => g.playerIds.length > 0);
        for (const s of b.stations) s.objectives = s.objectives.filter((o) => o.playerId !== change.playerId);
        if (!b.wholeTeam && b.stations.length > b.groups.length) b.stations = b.stations.slice(0, Math.max(1, b.groups.length));
      }
      note(`${pl?.firstName ?? 'Player'} removed from today; his objectives roll forward.`);
      break;
    }
    case 'add_player': {
      const pl = ctx.players.find((x) => x.id === change.playerId);
      if (!pl) break;
      if (!p.inputs.presentIds.includes(pl.id)) p.inputs.presentIds = [...p.inputs.presentIds, pl.id];
      p.inputs.absentIds = p.inputs.absentIds.filter((id) => id !== pl.id);
      const noThrow = new Set(p.inputs.noThrowingIds);
      for (const b of p.blocks) {
        const smallest = [...b.groups].sort((a, c) => a.playerIds.length - c.playerIds.length)[0];
        if (smallest && !smallest.playerIds.includes(pl.id)) smallest.playerIds.push(pl.id);
        else if (!smallest) b.groups.push({ id: newId(), name: 'Group A', playerIds: [pl.id] });
        for (const s of b.stations) {
          const d = ctx.drills.find((x) => x.id === s.drillId);
          if (d && !s.objectives.some((o) => o.playerId === pl.id)) s.objectives.push(objectiveFor(pl, d, ctx.variants, { noThrow: noThrow.has(pl.id), progression: s.progression, kind: b.kind }));
        }
      }
      note(`${pl.firstName} added (arrived late); joined the smallest group at each block with his own objectives.`);
      break;
    }
    case 'indoor': {
      p.inputs.indoor = true;
      let swapped = 0;
      for (const b of p.blocks) {
        for (const s of b.stations) {
          const d = ctx.drills.find((x) => x.id === s.drillId);
          if (d && !d.indoorOk) {
            p = regenerateStation(p, b.id, s.id, { ...ctx, seed: (ctx.seed ?? Date.now()) + swapped }, {});
            swapped += 1;
          }
        }
      }
      note(`Moved indoors: ${swapped} station${swapped === 1 ? '' : 's'} swapped for drills that work inside.`);
      break;
    }
    case 'equipment': {
      p.inputs.equipment = change.equipment;
      const have = new Set<Equipment>([...ALWAYS, ...change.equipment]);
      let swapped = 0;
      for (const b of p.blocks) {
        for (const s of b.stations) {
          const d = ctx.drills.find((x) => x.id === s.drillId);
          if (d && d.equipment.some((e) => !have.has(e))) {
            p = regenerateStation(p, b.id, s.id, { ...ctx, seed: (ctx.seed ?? Date.now()) + swapped }, {});
            swapped += 1;
          }
        }
      }
      note(`Equipment changed: ${swapped} station${swapped === 1 ? '' : 's'} swapped.`);
      break;
    }
    case 'no_throwing': {
      if (!p.inputs.noThrowingIds.includes(change.playerId)) p.inputs.noThrowingIds = [...p.inputs.noThrowingIds, change.playerId];
      const pl = ctx.players.find((x) => x.id === change.playerId);
      for (const b of p.blocks) {
        for (const s of b.stations) {
          const d = ctx.drills.find((x) => x.id === s.drillId);
          if (!d || !pl) continue;
          if (d.throwingLoad === 'high') {
            p = regenerateStation(p, b.id, s.id, ctx, {});
          } else {
            s.objectives = s.objectives.map((o) => (o.playerId === pl.id ? objectiveFor(pl, d, ctx.variants, { noThrow: true, progression: s.progression, kind: b.kind }) : o));
          }
        }
      }
      note(`${pl?.firstName ?? 'Player'} is not throwing today; high-load stations swapped, his objectives updated.`);
      break;
    }
  }
  // Recompute start times in case blocks changed.
  let clock = 0;
  for (const b of p.blocks) {
    b.startMin = clock;
    clock += b.minutes;
  }
  p.updatedAt = nowIso();
  return p;
}

/** Everyone present must be in a group in every rotating block and have an objective at every station. */
export function validatePractice(practice: Practice): string[] {
  const problems: string[] = [];
  const present = new Set(practice.inputs.presentIds);
  for (const b of practice.blocks) {
    const inGroups = new Set(b.groups.flatMap((g) => g.playerIds));
    for (const id of present) if (!inGroups.has(id)) problems.push(`${b.title}: player ${id} is not in a group`);
    if (!b.stations.length) problems.push(`${b.title}: no station`);
    for (const s of b.stations) {
      for (const id of present) if (!s.objectives.some((o) => o.playerId === id)) problems.push(`${b.title}: no objective for ${id} at station ${s.id}`);
    }
    if (!b.wholeTeam && b.stations.length !== b.groups.length) problems.push(`${b.title}: ${b.stations.length} stations for ${b.groups.length} groups`);
  }
  const total = practice.blocks.reduce((s, b) => s + b.minutes, 0);
  if (Math.abs(total - practice.inputs.durationMin) > 2) problems.push(`blocks add up to ${total}, practice is ${practice.inputs.durationMin}`);
  return problems;
}
