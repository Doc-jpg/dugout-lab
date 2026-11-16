/**
 * Drill diagrams: a small picture language for "who stands where, who moves, where the ball goes".
 *
 * A diagram is data, not a drawing. The same data is checked by rules (so a picture cannot show a throw
 * from an empty spot, a runner going the wrong way round the bases, or a shortstop on the wrong side of
 * second), drawn by the DrillDiagram component, and played step by step.
 *
 * Field pictures use feet, measured the way a coach sees the field from behind home plate:
 *   home plate is (0, 0), second base is straight up the middle, FIRST BASE IS ON THE RIGHT (x > 0),
 *   third base is on the left (x < 0). Bases are drawn 60 ft apart. Pictures are not to scale for every
 *   age; the drill's own words carry the real distances.
 * Open-space pictures (a patch of grass, a gym, a cage) use a plain 100 by 60 box.
 */
export type Pt = [number, number];
/** A spot: a point, a named place on the field ("first", "SS"), or "@id" for wherever that person is now. */
export type Where = Pt | string;
export type FieldKind = 'infield' | 'full' | 'open';
/** base = a loose base in an open-space picture. gear = a net or a bucket. screen = an L-screen, seen from above. waiting = the line of kids waiting their turn. */
export type ActorKind = 'fielder' | 'runner' | 'coach' | 'cone' | 'gear' | 'screen' | 'waiting' | 'base';
export interface DiagramActor {
  id: string;
  kind: ActorKind;
  /** What is written on the marker. Fielders, runners, coaches and gear need one. */
  label?: string;
  at: Where;
}
/** run = a person moves. throw / toss = ball in the air on a line. ground = ball rolled, bunted or hit on the ground. fly = ball hit or thrown high. */
export type MoveKind = 'run' | 'throw' | 'toss' | 'ground' | 'fly';
export interface DiagramMove {
  kind: MoveKind;
  /** For a run: who moves. */
  who?: string;
  /** Where it starts. A run starts where the person is; a ball starts where the ball is. Give it only for a new ball. */
  from?: Where;
  to: Where;
  /** A fresh ball comes into play (the coach hits the next one). */
  newBall?: boolean;
  /** Bend the line: positive bends to the mover's left. Fly balls bend by themselves. */
  curve?: number;
  /** A runner going back to the base he came from. */
  back?: boolean;
  /** People this line is meant to pass: a cutoff man the throw goes through, a pitcher the throw to second goes over. */
  past?: string[];
}
export interface DiagramStep {
  /** One plain sentence: what happens in this step. */
  say: string;
  moves: DiagramMove[];
}
/** One version of the drill, always starting from the starting spots. */
export interface DiagramPlay {
  name: string;
  /** Who or where the ball starts. */
  ball?: Where;
  /** People who are not part of this version (a runner in "nobody on"). */
  hide?: string[];
  /** People who start somewhere else in this version (a first baseman holding a runner on). */
  start?: Record<string, Where>;
  steps: DiagramStep[];
}
export interface DrillDiagram {
  field: FieldKind;
  /** Show a different part of the field than the usual one: [minX, maxX, minY, maxY] in feet. */
  view?: [number, number, number, number];
  actors: DiagramActor[];
  plays: DiagramPlay[];
  /** Small words on the picture, such as a distance. */
  marks?: { at: Pt; text: string }[];
  /** One line under the picture. */
  note?: string;
}

const B = 42.4; // 60 ft bases: 60 / sqrt(2)
/** Named places on a field picture. Bases are spelled out; fielding positions use the scorebook letters. */
export const PLACES: Record<string, Pt> = {
  home: [0, 0], first: [B, B], second: [0, 84.9], third: [-B, B], mound: [0, 46],
  P: [0, 46], C: [0, -9.5], '1B': [39, 60], '2B': [22, 80], SS: [-22, 80], '3B': [-39, 60],
  LF: [-88, 150], CF: [0, 188], RF: [88, 150],
  /** A coach hitting or rolling from beside home plate: third base side, first base side, and farther off for the small-scale pictures. */
  coachHome: [-19, -6], coachHomeR: [19, -6], coachHomeFar: [-30, -9],
  /** Third and first base coaching boxes, in foul ground. */
  box3: [-62, 26], box1: [62, 26]
};
export const BASE_ORDER = ['home', 'first', 'second', 'third'] as const;

/** The part of the world each picture shows: [minX, maxX, minY, maxY]. */
export const VIEW: Record<FieldKind, [number, number, number, number]> = {
  infield: [-80, 80, -24, 120],
  full: [-165, 165, -28, 222],
  open: [0, 100, 0, 60]
};

/** The part of the world this diagram shows, and how big a marker is in it. */
export function viewOf(d: Pick<DrillDiagram, 'field' | 'view'>): { box: [number, number, number, number]; scale: number; r: number } {
  const box = d.view ?? VIEW[d.field];
  const scale = 360 / (box[1] - box[0]);
  return { box, scale, r: scale >= 1.6 ? 10 : 8.5 };
}
/** Things that stand still and cannot hold a ball. */
const PROP = new Set<ActorKind>(['cone', 'waiting', 'base', 'screen']);
/** Small things a line or another marker may sit close to. */
const SMALL = new Set<ActorKind>(['cone', 'base']);

export interface ResolvedMove { step: number; kind: MoveKind; a: Pt; b: Pt; curve: number; who?: string; past?: string[] }
export interface PlayState {
  /** Where everyone is after the steps so far. */
  pos: Record<string, Pt>;
  ball: Pt | null;
  moves: ResolvedMove[];
  /** Where everyone stands at the start (frames[0]) and after each step. */
  frames: Record<string, Pt>[];
  errors: string[];
}

/** Half the width and half the height of a marker, in picture pixels. The drawing and the rules share this. */
export function markerBox(a: Pick<DiagramActor, 'kind' | 'label'>, r: number): { hw: number; hh: number } {
  if (a.kind === 'cone' || a.kind === 'base') return { hw: 6, hh: 6 };
  if (a.kind === 'waiting') return { hw: 13, hh: 5 };
  if (a.kind === 'screen') return { hw: 3, hh: r * 1.5 };
  const font = r < 10 ? 8 : 9;
  return { hw: Math.max(2 * r, (a.label ?? '').length * font * 0.6 + 8) / 2, hh: r };
}
/** Half the width and height of a line of words on the picture, in pixels. */
export const wordsBox = (text: string): { hw: number; hh: number } => ({ hw: text.length * 8.5 * 0.27 + 2, hh: 6 });

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Turn a Where into a point, given where everyone is right now. */
export function resolve(w: Where, pos: Record<string, Pt>, field: FieldKind): Pt | null {
  if (Array.isArray(w)) return w;
  if (w.startsWith('@')) return pos[w.slice(1)] ?? null;
  if (field === 'open') return null; // open pictures have no named places
  return PLACES[w] ?? null;
}

/** Starting spots for everyone. */
export function startPositions(d: DrillDiagram): { pos: Record<string, Pt>; errors: string[] } {
  const pos: Record<string, Pt> = {}; const errors: string[] = [];
  for (const a of d.actors) {
    const p = resolve(a.at, pos, d.field);
    if (!p) errors.push(`${a.id}: unknown starting spot ${JSON.stringify(a.at)}`); else pos[a.id] = [p[0], p[1]];
  }
  return { pos, errors };
}

/** Run one play up to (not including) step `upTo`, and report anything that could not really happen. */
export function simulate(d: DrillDiagram, playIndex: number, upTo = Infinity): PlayState {
  const { pos, errors } = startPositions(d);
  const play = d.plays[playIndex];
  const moves: ResolvedMove[] = [];
  if (!play) return { pos, ball: null, moves, frames: [], errors: [...errors, `no play ${playIndex}`] };
  const kinds = new Map(d.actors.map((a) => [a.id, a.kind]));
  const hidden = new Set(play.hide ?? []);
  for (const h of hidden) { if (!kinds.has(h)) errors.push(`${play.name}: hides ${h}, who is not in the picture`); delete pos[h]; }
  for (const [id, w] of Object.entries(play.start ?? {})) {
    const p = kinds.has(id) ? resolve(w, pos, d.field) : null;
    if (!p) errors.push(`${play.name}: cannot place ${id} at ${JSON.stringify(w)}`); else pos[id] = [p[0], p[1]];
  }
  const people = d.actors.filter((a) => !hidden.has(a.id) && !PROP.has(a.kind));
  let ball: Pt | null = play.ball ? resolve(play.ball, pos, d.field) : null;
  if (play.ball && !ball) errors.push(`${play.name}: unknown ball start`);
  const someoneAt = (p: Pt, tol = 2.5) => people.some((a) => pos[a.id] && dist(pos[a.id], p) <= tol);
  const snap = () => Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, [v[0], v[1]] as Pt]));
  const frames: Record<string, Pt>[] = [snap()];
  /** A coach standing by the plate hits or rolls the ball from the plate itself. */
  const hitFromHome = (p: Pt) => d.field !== 'open' && dist(p, PLACES.home) < 1 && d.actors.some((a) => a.kind === 'coach' && !hidden.has(a.id) && pos[a.id] && dist(pos[a.id], PLACES.home) <= 40);
  const baseAt = (p: Pt) => BASE_ORDER.findIndex((b) => dist(PLACES[b], p) <= 1);
  play.steps.forEach((step, si) => {
    if (si >= upTo) return;
    const where = `${play.name}, step ${si + 1}`;
    if (!step.say.trim()) errors.push(`${where}: no sentence`);
    // Balls first resolve against where people stood at the start of the step, then everyone runs, then arrivals are checked.
    const startPos: Record<string, Pt> = Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, [v[0], v[1]] as Pt]));
    const ballMoves: { m: DiagramMove; a: Pt; b: Pt }[] = [];
    const carriers: string[] = [];
    for (const m of step.moves) {
      if (m.kind === 'run') {
        if (!m.who || !pos[m.who]) { errors.push(`${where}: a run needs a known person`); continue; }
        const k = kinds.get(m.who);
        if (!k || PROP.has(k) || k === 'gear') { errors.push(`${where}: ${m.who} cannot run`); continue; }
        const a = pos[m.who]; const b = resolve(m.to, startPos, d.field);
        if (!b) { errors.push(`${where}: unknown spot ${JSON.stringify(m.to)}`); continue; }
        if (dist(a, b) < 1.5) errors.push(`${where}: ${m.who} runs nowhere`);
        if (d.field !== 'open' && k === 'runner') {
          const i = baseAt(a), j = baseAt(b);
          if (i >= 0 && j >= 0) {
            const forward = j === (i + 1) % 4;
            if (m.back ? forward : !forward) errors.push(`${where}: ${m.who} runs the bases the wrong way (${BASE_ORDER[i]} to ${BASE_ORDER[j]})`);
          }
        }
        if (ball && dist(a, ball) <= 2.5 && !step.moves.some((x) => x.kind !== 'run' && !x.newBall)) carriers.push(m.who);
        moves.push({ step: si, kind: 'run', a: [a[0], a[1]], b: [b[0], b[1]], curve: m.curve ?? 0, who: m.who, past: m.past });
        pos[m.who] = [b[0], b[1]];
      }
    }
    for (const m of step.moves) {
      if (m.kind === 'run') continue;
      let a: Pt | null;
      if (m.newBall) {
        a = m.from ? resolve(m.from, startPos, d.field) : null;
        if (!a) { errors.push(`${where}: a new ball needs a starting spot`); continue; }
      } else {
        if (!ball) { errors.push(`${where}: there is no ball to ${m.kind}`); continue; }
        a = ball;
        if (m.from) { const f = resolve(m.from, startPos, d.field); if (!f || dist(f, ball) > 2.5) errors.push(`${where}: the ball is not where this ${m.kind} starts`); }
      }
      // Someone has to be holding it: at the start of the step, or arriving there during it (a fielder who runs to the ball).
      const held = hitFromHome(a) || people.some((x) => (startPos[x.id] && dist(startPos[x.id], a!) <= 2.5) || (pos[x.id] && dist(pos[x.id], a!) <= 2.5));
      if (!held) errors.push(`${where}: nobody is at the spot this ${m.kind} starts from`);
      const b = resolve(m.to, pos, d.field) ?? resolve(m.to, startPos, d.field);
      if (!b) { errors.push(`${where}: unknown spot ${JSON.stringify(m.to)}`); continue; }
      if (dist(a, b) < 3) errors.push(`${where}: the ball goes nowhere`);
      moves.push({ step: si, kind: m.kind, a: [a[0], a[1]], b: [b[0], b[1]], curve: m.curve ?? (m.kind === 'fly' ? 0.22 : 0), past: m.past });
      ballMoves.push({ m, a, b });
      ball = [b[0], b[1]];
    }
    if (!ballMoves.length && ball && carriers.length) ball = [pos[carriers[0]][0], pos[carriers[0]][1]]; // he ran with it
    if (ballMoves.length && ball && !someoneAt(ball)) errors.push(`${where}: the ball ends where nobody is`);
    frames.push(snap());
  });
  // Nothing may leave the picture.
  const [x0, x1, y0, y1] = viewOf(d).box;
  const inside = (p: Pt) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  for (const [id, p] of Object.entries(pos)) if (!inside(p)) errors.push(`${play.name}: ${id} ends outside the picture`);
  for (const m of moves) if (!inside(m.a) || !inside(m.b)) errors.push(`${play.name}, step ${m.step + 1}: a line leaves the picture`);
  // Two lines on top of each other cannot be read.
  for (let i = 0; i < moves.length; i++) for (let j = i + 1; j < moves.length; j++) {
    const p = moves[i], q = moves[j];
    const same = dist(p.a, q.a) < 2 && dist(p.b, q.b) < 2 && Math.abs(p.curve - q.curve) < 0.05;
    const flipped = dist(p.a, q.b) < 2 && dist(p.b, q.a) < 2 && Math.abs(p.curve + q.curve) < 0.05;
    if (same || flipped) errors.push(`${play.name}: steps ${p.step + 1} and ${q.step + 1} draw the same line`);
  }
  return { pos, ball, moves, frames, errors };
}

/** Everything wrong with a diagram, in plain words. Empty means it can be drawn and played. */
export function validateDiagram(d: DrillDiagram): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const a of d.actors) {
    if (ids.has(a.id)) errors.push(`two people share the id ${a.id}`);
    ids.add(a.id);
    if ((a.kind === 'fielder' || a.kind === 'runner' || a.kind === 'coach' || a.kind === 'gear') && !a.label) errors.push(`${a.id} has no label`);
  }
  const { pos, errors: e0 } = startPositions(d);
  errors.push(...e0);
  const { box: [x0, x1, y0, y1], scale, r } = viewOf(d);
  const list = d.actors.filter((a) => pos[a.id]);
  for (const a of list) { const p = pos[a.id]; if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) errors.push(`${a.id} starts outside the picture`); }
  const kindOf = new Map(d.actors.map((a) => [a.id, a]));
  const toPx = (p: Pt): Pt => [(p[0] - x0) * scale, (y1 - p[1]) * scale];
  const W = (x1 - x0) * scale, H = (y1 - y0) * scale;
  /** Is this pixel point inside a box (centre c, half sizes hw and hh, grown by `pad`)? */
  const inBox = (p: Pt, c: Pt, b: { hw: number; hh: number }, pad = 0) => Math.abs(p[0] - c[0]) < b.hw + pad && Math.abs(p[1] - c[1]) < b.hh + pad;
  const words = (d.marks ?? []).map((m) => { const c = toPx(m.at); return { text: m.text, c: [c[0], c[1] - 3] as Pt, box: wordsBox(m.text) }; });
  for (const w of words) if (w.c[0] - w.box.hw < 2 || w.c[0] + w.box.hw > W - 2 || w.c[1] - w.box.hh < 2 || w.c[1] + w.box.hh > H - 2) errors.push(`the words "${w.text}" run off the picture`);
  if (!d.plays.length) errors.push('no plays');
  d.plays.forEach((p, i) => {
    if (!p.name.trim()) errors.push(`play ${i + 1} has no name`);
    if (!p.steps.length) errors.push(`${p.name}: no steps`);
    if (!p.steps.some((s) => s.moves.length)) errors.push(`${p.name}: nothing moves`);
    const sim = simulate(d, i);
    errors.push(...sim.errors);
    const shown = d.actors.filter((a) => !(p.hide ?? []).includes(a.id));
    // 1. At the start and after every step, no two markers sit on top of each other. Cones and loose bases are small and may sit close.
    sim.frames.forEach((f, fi) => {
      const when = fi === 0 ? 'at the start' : `after step ${fi}`;
      for (let a = 0; a < shown.length; a++) for (let b = a + 1; b < shown.length; b++) {
        const A = shown[a], B = shown[b];
        if (SMALL.has(A.kind) || SMALL.has(B.kind) || !f[A.id] || !f[B.id]) continue;
        const pa = toPx(f[A.id]), pb = toPx(f[B.id]); const ba = markerBox(A, r), bb = markerBox(B, r);
        // Two round markers are compared as circles; anything wider as boxes.
        const round = ba.hw <= ba.hh + 1.5 && bb.hw <= bb.hh + 1.5;
        const clash = round ? Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < ba.hw + bb.hw - 2 : Math.abs(pa[0] - pb[0]) < ba.hw + bb.hw - 2 && Math.abs(pa[1] - pb[1]) < ba.hh + bb.hh - 2;
        if (clash) errors.push(`${p.name}: ${A.id} and ${B.id} are on top of each other ${when}`);
      }
      // Words on the picture must not sit on a person.
      for (const w of words) for (const A of shown) {
        if (!f[A.id]) continue;
        const pa = toPx(f[A.id]); const ba = markerBox(A, r);
        if (Math.abs(pa[0] - w.c[0]) < ba.hw + w.box.hw && Math.abs(pa[1] - w.c[1]) < ba.hh + w.box.hh) errors.push(`${p.name}: the words "${w.text}" sit on ${A.id} ${when}`);
      }
    });
    // 2. A line must not run through a person it has nothing to do with, or through the words.
    for (const m of sim.moves) {
      const before = sim.frames[m.step], after = sim.frames[m.step + 1] ?? before;
      const pts: Pt[] = []; for (let t = 0.1; t <= 0.901; t += 0.04) pts.push(toPx(along(m.a, m.b, m.curve, t)));
      const ends = [toPx(m.a), toPx(m.b)];
      for (const A of shown) {
        if (SMALL.has(A.kind) || A.id === m.who || m.past?.includes(A.id)) continue;
        const box = markerBox(A, r);
        for (const where of [before[A.id], after[A.id]]) {
          if (!where) continue;
          const c = toPx(where);
          // The people at each end of the line belong to it.
          if (ends.some((e) => Math.hypot(e[0] - c[0], e[1] - c[1]) < r + 6)) continue;
          if (pts.some((q) => inBox(q, c, box, -1))) { errors.push(`${p.name}, step ${m.step + 1}: a ${m.kind === 'run' ? 'run' : 'ball'} line goes through ${A.id}`); break; }
        }
      }
      for (const w of words) if (pts.some((q) => inBox(q, w.c, w.box, 1))) errors.push(`${p.name}, step ${m.step + 1}: a line crosses the words "${w.text}"`);
      for (const id of m.past ?? []) if (!kindOf.has(id)) errors.push(`${p.name}, step ${m.step + 1}: passes ${id}, who is not in the picture`);
    }
  });
  return [...new Set(errors)];
}

/** A point part-way along a move, for drawing and for playing. `t` runs 0 to 1. */
export function along(a: Pt, b: Pt, curve: number, t: number): Pt {
  if (!curve) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const c = controlPoint(a, b, curve); const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}
/** The bend point of a curved move: off to the mover's left by `curve` times the length. */
export function controlPoint(a: Pt, b: Pt, curve: number): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return [(a[0] + b[0]) / 2 - dy * curve, (a[1] + b[1]) / 2 + dx * curve];
}
