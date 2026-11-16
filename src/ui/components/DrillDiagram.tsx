import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PLACES, along, controlPoint, markerBox, simulate, viewOf, type DrillDiagram as Diagram, type Pt, type ResolvedMove } from '../../engine/diagram';

/**
 * Draws a drill diagram and plays it step by step.
 *
 * Still picture: everyone at the starting spots, every move of the chosen version drawn and numbered.
 * Tap a step (or Play the steps): people stand where they are at that moment, that step's moves are bold,
 * earlier ones fade, later ones wait.
 *
 * The picture carries its own colors (grass, dirt, white markers) so it reads the same in light and dark mode
 * and on paper.
 */
const INK = '#102033';
const W = 360;

export function DrillDiagram({ diagram, compact, initialPlay = 0, initialStep = null }: { diagram: Diagram; compact?: boolean; initialPlay?: number; initialStep?: number | null }) {
  const [play, setPlay] = useState(initialPlay);
  /** null = the whole picture; a number = that step. */
  const [step, setStep] = useState<number | null>(initialStep);
  /** 0 to 1 through the current step while playing; 1 when standing still on a step. */
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const { box: [x0, x1, y0, y1], r } = viewOf(diagram);
  const s = W / (x1 - x0);
  const H = Math.round((y1 - y0) * s);
  const px = (p: Pt): Pt => [(p[0] - x0) * s, (y1 - p[1]) * s];
  const font = r < 10 ? 8 : 9;
  const thePlay = diagram.plays[Math.min(play, diagram.plays.length - 1)];
  const all = useMemo(() => simulate(diagram, play), [diagram, play]);
  const before = useMemo(() => simulate(diagram, play, step ?? 0).pos, [diagram, play, step]);
  const stepMoves = step === null ? [] : all.moves.filter((m) => m.step === step);
  const ballMoves = stepMoves.filter((m) => m.kind !== 'run');

  // Play: run each step's clock from 0 to 1, pause, go to the next, and finish back on the whole picture.
  useEffect(() => {
    if (!playing || step === null) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const nBalls = all.moves.filter((m) => m.step === step && m.kind !== 'run').length;
    const dur = reduce ? 1 : 1300 + 450 * Math.max(0, nBalls - 1);
    const hold = reduce ? 1600 : 900;
    const t0 = performance.now();
    const tick = (now: number) => {
      const e = now - t0;
      if (e < dur) { setT(e / dur); raf.current = requestAnimationFrame(tick); return; }
      setT(1);
      if (e < dur + hold) { raf.current = requestAnimationFrame(tick); return; }
      if (step + 1 < thePlay.steps.length) { setT(0); setStep(step + 1); } else { setPlaying(false); setStep(null); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, step, play, all, thePlay]);

  const choosePlay = (i: number) => { setPlaying(false); setStep(null); setT(1); setPlay(i); };
  const chooseStep = (i: number) => { setPlaying(false); setT(1); setStep(step === i ? null : i); };
  const start = () => { setT(0); setStep(0); setPlaying(true); };
  const stop = () => { setPlaying(false); setStep(null); setT(1); };

  // Where each person is drawn right now.
  const here: Record<string, Pt> = { ...before };
  if (step !== null) for (const m of stepMoves) if (m.kind === 'run' && m.who) here[m.who] = along(m.a, m.b, m.curve, t);
  // Where the ball is drawn right now.
  let ball: Pt | null = null;
  if (step === null) ball = thePlay.ball ? simulate(diagram, play, 0).ball : null;
  else if (ballMoves.length) {
    const k = Math.min(ballMoves.length - 1, Math.floor(t * ballMoves.length));
    const m = ballMoves[k];
    ball = along(m.a, m.b, m.curve, Math.min(1, t * ballMoves.length - k));
  } else {
    const st = simulate(diagram, play, step);
    ball = st.ball;
    const carrier = stepMoves.find((m) => m.kind === 'run' && m.who && st.ball && Math.hypot(m.a[0] - st.ball[0], m.a[1] - st.ball[1]) <= 2.5);
    if (carrier?.who) ball = here[carrier.who];
  }

  // Which arrows are drawn right now, and where each step number sits so it is not hidden by a marker or another number.
  const shown = diagram.actors.filter((a) => !(thePlay.hide ?? []).includes(a.id));
  const blocks = shown.filter((a) => before[a.id]).map((a) => ({ c: px(before[a.id]), ...markerBox(a, r) }));
  const numbers: Pt[] = [];
  const drawn = all.moves.map((m) => {
    const state = step === null ? 'all' : m.step === step ? 'now' : m.step < step ? 'done' : 'later';
    if (state === 'later') return null;
    const g = moveGeom(m, px, r);
    let badge: Pt | null = null;
    if (g.roomForNumber) {
      const free = (q: Pt) => q[0] > 7 && q[0] < W - 7 && q[1] > 7 && q[1] < H - 7 && !blocks.some((o) => Math.abs(q[0] - o.c[0]) < o.hw + 7 && Math.abs(q[1] - o.c[1]) < o.hh + 7) && !numbers.some((n) => Math.hypot(q[0] - n[0], q[1] - n[1]) < 13.5);
      badge = g.spots.find(free) ?? g.spots[0];
      numbers.push(badge);
    }
    return { g, state, badge };
  });

  const label = `Diagram: ${thePlay.steps.map((x, i) => `${i + 1}. ${x.say}`).join(' ')}`;
  return (
    <div className="diagram" data-testid="drill-diagram">
      {diagram.plays.length > 1 && (
        <div className="chips" style={{ marginBottom: 6 }}>
          {diagram.plays.map((p, i) => <button key={p.name} type="button" className={`chip sm ${i === play ? 'on' : ''}`} onClick={() => choosePlay(i)}>{p.name}</button>)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', maxWidth: 520, display: 'block', borderRadius: 10 }}>
        <Field kind={diagram.field} px={px} W={W} H={H} s={s} small={r < 10} />
        {(diagram.marks ?? []).map((m, i) => { const p = px(m.at); return <text key={i} x={p[0]} y={p[1]} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff" stroke={INK} strokeWidth={2.4} paintOrder="stroke" strokeLinejoin="round">{m.text}</text>; })}
        {all.moves.map((m, i) => drawn[i] && <Move key={i} m={m} g={drawn[i]!.g} faded={drawn[i]!.state === 'done'} bold={drawn[i]!.state === 'now'} number={m.step + 1} badge={drawn[i]!.badge} />)}
        {shown.map((a) => <Marker key={a.id} kind={a.kind} label={a.label} at={px(here[a.id] ?? [0, 0])} r={r} font={font} />)}
        {ball && (() => { const p = px(ball!); const still = step === null || !ballMoves.length || t >= 1; return <circle cx={p[0] + (still ? r * 0.85 : 0)} cy={p[1] - (still ? r * 0.85 : 0)} r={3.6} fill="#fff" stroke="#c0392b" strokeWidth={1.4} data-testid="diagram-ball" />; })()}
      </svg>
      <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {playing ? <button type="button" className="btn sm" onClick={stop}>Stop</button> : <button type="button" className="btn sm primary" onClick={start}>▶ Play the steps</button>}
        {thePlay.steps.map((_, i) => <button key={i} type="button" className={`chip sm ${step === i ? 'on' : ''}`} aria-label={`Step ${i + 1}`} onClick={() => chooseStep(i)}>{i + 1}</button>)}
      </div>
      {step !== null
        ? <div className="small" style={{ marginTop: 6 }} aria-live="polite"><strong>{step + 1}.</strong> {thePlay.steps[step].say}</div>
        : !compact && <ol className="step-list small" style={{ marginTop: 6 }}>{thePlay.steps.map((x, i) => <li key={i}>{x.say}</li>)}</ol>}
      <Legend moves={all.moves} hasBall={!!thePlay.ball} />
      {diagram.note && <div className="small muted" style={{ marginTop: 2 }}>{diagram.note}</div>}
    </div>
  );
}

/** The ground everything stands on. */
function Field({ kind, px, W, H, s, small }: { kind: Diagram['field']; px: (p: Pt) => Pt; W: number; H: number; s: number; small: boolean }) {
  const GRASS = '#3f8450', DIRT = '#cfa56e';
  if (kind === 'open') return <><rect x={0} y={0} width={W} height={H} fill={GRASS} /><rect x={5} y={5} width={W - 10} height={H - 10} fill="none" stroke="rgba(255,255,255,0.35)" strokeDasharray="4 5" rx={6} /></>;
  const P = (p: Pt) => px(p).map((v) => v.toFixed(1)).join(' ');
  const q = Math.SQRT1_2;
  const skin = 95; // dirt reaches 95 ft from home
  const fence = 205;
  const farX = kind === 'full' ? fence * q : 200;
  const diamond = (inset: number): Pt[] => [[0, inset], [42.4 - inset, 42.4], [0, 84.9 - inset], [-(42.4 - inset), 42.4]];
  const base = (p: Pt, key: string) => { const c = px(p); const b = small ? 4 : 5.5; return <rect key={key} x={c[0] - b} y={c[1] - b} width={2 * b} height={2 * b} fill="#fff" stroke={INK} strokeWidth={0.8} transform={`rotate(45 ${c[0]} ${c[1]})`} />; };
  const h = px([0, 0]); const hp = small ? 4.5 : 6;
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill={kind === 'full' ? '#2e6a3d' : GRASS} />
      {kind === 'full' && <path d={`M ${P([0, 0])} L ${P([fence * q, fence * q])} A ${fence * s} ${fence * s} 0 0 0 ${P([-fence * q, fence * q])} Z`} fill={GRASS} stroke="#fff" strokeWidth={1.2} />}
      <path d={`M ${P([0, 0])} L ${P([skin * q, skin * q])} A ${skin * s} ${skin * s} 0 0 0 ${P([-skin * q, skin * q])} Z`} fill={DIRT} />
      <circle cx={h[0]} cy={h[1]} r={13 * s} fill={DIRT} />
      <polygon points={diamond(9).map(P).join(' ')} fill={GRASS} />
      <circle cx={px(PLACES.mound)[0]} cy={px(PLACES.mound)[1]} r={7 * s} fill={DIRT} />
      <rect x={px(PLACES.mound)[0] - 4} y={px(PLACES.mound)[1] - 1.2} width={8} height={2.4} fill="#fff" />
      <path d={`M ${P([0, 0])} L ${P([farX, farX])} M ${P([0, 0])} L ${P([-farX, farX])}`} stroke="#fff" strokeWidth={1.4} />
      {base(PLACES.first, '1')}{base(PLACES.second, '2')}{base(PLACES.third, '3')}
      <polygon points={`${h[0] - hp},${h[1] - hp * 0.2} ${h[0] + hp},${h[1] - hp * 0.2} ${h[0] + hp},${h[1] + hp * 0.5} ${h[0]},${h[1] + hp * 1.2} ${h[0] - hp},${h[1] + hp * 0.5}`} fill="#fff" stroke={INK} strokeWidth={0.8} />
    </>
  );
}

const DASH: Record<ResolvedMove['kind'], string | undefined> = { run: undefined, throw: '7 4', toss: '7 4', fly: '7 4', ground: '1.5 4.5' };

/** Where one arrow is drawn: its path, its arrowhead, and the spots its step number may sit. */
function moveGeom(m: ResolvedMove, px: (p: Pt) => Pt, r: number) {
  const a = px(m.a), b = px(m.b), c = px(controlPoint(m.a, m.b, m.curve));
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Stop short of the markers at each end so the arrowhead is not hidden under a circle.
  const gapA = Math.min(r + 2, len * 0.2), gapB = Math.min(r + 4, len * 0.25);
  const bez = (t: number): Pt => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
  const tA = gapA / Math.max(len, 1), tB = 1 - gapB / Math.max(len, 1);
  const p0 = bez(tA), p1 = bez(tB), mid = bez((tA + tB) / 2);
  // Control point for the shortened piece, so the curve keeps its shape.
  const cc: Pt = [2 * mid[0] - (p0[0] + p1[0]) / 2, 2 * mid[1] - (p0[1] + p1[1]) / 2];
  const d = m.curve ? `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} Q ${cc[0].toFixed(1)} ${cc[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}` : `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} L ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  const back = bez(tB - 0.04); const ang = Math.atan2(p1[1] - back[1], p1[0] - back[0]);
  const head = (L: number, wd: number) => [[p1[0] + Math.cos(ang) * 3, p1[1] + Math.sin(ang) * 3], [p1[0] - Math.cos(ang) * L + Math.sin(ang) * wd, p1[1] - Math.sin(ang) * L - Math.cos(ang) * wd], [p1[0] - Math.cos(ang) * L - Math.sin(ang) * wd, p1[1] - Math.sin(ang) * L + Math.cos(ang) * wd]].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  // The number sits beside the line: first choice the middle, on the outside of a curve; then the other side; then nearer each end.
  const nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const nl = Math.hypot(nx, ny) || 1; const side = m.curve < 0 ? 1 : -1;
  const spots: Pt[] = [];
  for (const t of [0.5, 0.34, 0.66]) for (const sd of [side, -side]) { const q = bez(tA + (tB - tA) * t); spots.push([q[0] + (nx / nl) * 9 * sd, q[1] + (ny / nl) * 9 * sd]); }
  // A very short line has no room for a number; the step buttons still tell the order.
  return { d, head, spots, roomForNumber: len - gapA - gapB >= 16 };
}

/** One arrow: a white halo under a dark line so it reads on grass and on dirt, an arrowhead, and its step number. */
function Move({ m, g, faded, bold, number, badge }: { m: ResolvedMove; g: ReturnType<typeof moveGeom>; faded: boolean; bold: boolean; number: number; badge: Pt | null }) {
  const w = bold ? 2.8 : 2.1;
  return (
    <g opacity={faded ? 0.28 : 1} data-move={m.kind}>
      <path d={g.d} fill="none" stroke="#fff" strokeWidth={w + 2.6} strokeLinecap="round" />
      <polygon points={g.head(9, 5)} fill="#fff" />
      <path d={g.d} fill="none" stroke={INK} strokeWidth={w} strokeDasharray={DASH[m.kind]} strokeLinecap={m.kind === 'ground' ? 'round' : 'butt'} />
      <polygon points={g.head(7.5, 3.6)} fill={INK} />
      {badge && <><circle cx={badge[0]} cy={badge[1]} r={6.2} fill={INK} stroke="#fff" strokeWidth={1} />
      <text x={badge[0]} y={badge[1] + 2.7} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">{number}</text></>}
    </g>
  );
}

/** A person or a thing on the field. */
function Marker({ kind, label, at, r, font }: { kind: Diagram['actors'][number]['kind']; label?: string; at: Pt; r: number; font: number }) {
  const [x, y] = at;
  if (kind === 'base') return <rect x={x - 5} y={y - 5} width={10} height={10} fill="#fff" stroke={INK} strokeWidth={0.8} transform={`rotate(45 ${x} ${y})`} />;
  if (kind === 'cone') return <polygon points={`${x},${y - 6} ${x + 5},${y + 4} ${x - 5},${y + 4}`} fill="#ff7a1a" stroke={INK} strokeWidth={0.8} />;
  if (kind === 'waiting') return <g opacity={0.9}>{[-9, 0, 9].map((dx) => <circle key={dx} cx={x + dx} cy={y} r={3.4} fill="#fff" stroke={INK} strokeWidth={0.8} />)}{label && <text x={x} y={y + 13} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#fff" stroke={INK} strokeWidth={2.2} paintOrder="stroke">{label}</text>}</g>;
  if (kind === 'screen') { const h = markerBox({ kind }, r).hh; return <g data-actor="screen"><rect x={x - 3} y={y - h} width={6} height={2 * h} rx={1.5} fill="#e6e8eb" stroke={INK} strokeWidth={1.2} />{label && <text x={x} y={y - h - 4} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#fff" stroke={INK} strokeWidth={2.2} paintOrder="stroke">{label}</text>}</g>; }
  const text = label ?? '';
  const w = 2 * markerBox({ kind, label }, r).hw;
  const fill = kind === 'runner' ? '#f6a623' : kind === 'coach' ? INK : kind === 'gear' ? '#e6e8eb' : '#fff';
  const ink = kind === 'coach' ? '#fff' : INK;
  return (
    <g data-actor={kind}>
      <rect x={x - w / 2} y={y - r} width={w} height={2 * r} rx={kind === 'gear' ? 3 : r} fill={fill} stroke={kind === 'coach' ? '#fff' : INK} strokeWidth={1.2} strokeDasharray={kind === 'gear' ? '3 2' : undefined} />
      <text x={x} y={y + font * 0.36} textAnchor="middle" fontSize={font} fontWeight={700} fill={ink}>{text}</text>
    </g>
  );
}

/** Only the line styles this picture uses. */
function Legend({ moves, hasBall }: { moves: ResolvedMove[]; hasBall: boolean }) {
  const has = (k: ResolvedMove['kind'][]) => moves.some((m) => k.includes(m.kind));
  const item = (dash: string | undefined, words: string, curved = false) => (
    <span key={words} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10 }}>
      <svg width={30} height={10} aria-hidden="true"><path d={curved ? 'M 2 9 Q 15 -4 28 9' : 'M 2 5 L 28 5'} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={dash} strokeLinecap={dash === DASH.ground ? 'round' : 'butt'} /></svg>{words}
    </span>
  );
  return (
    <div className="small muted" style={{ marginTop: 6, lineHeight: 1.9 }}>
      {has(['run']) && item(undefined, 'player moves')}
      {has(['throw', 'toss']) && item(DASH.throw, 'throw')}
      {has(['ground']) && item(DASH.ground, 'ball on the ground')}
      {has(['fly']) && item(DASH.fly, 'ball in the air', true)}
      {hasBall && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><svg width={10} height={10} aria-hidden="true"><circle cx={5} cy={5} r={3.6} fill="#fff" stroke="#c0392b" strokeWidth={1.4} /></svg>ball</span>}
    </div>
  );
}
