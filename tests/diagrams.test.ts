import { describe, it, expect } from 'vitest';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { DIAGRAMS, diagramFor } from '../src/data/diagrams';
import { PLACES, simulate, validateDiagram, viewOf, type DrillDiagram } from '../src/engine/diagram';
import { DugoutLabDB, seedLibrary, duplicateDrill } from '../src/db/db';

describe('the field is drawn the right way round', () => {
  it('puts first base on the right and third on the left, seen from behind home plate', () => {
    expect(PLACES.first[0]).toBeGreaterThan(0);
    expect(PLACES.third[0]).toBeLessThan(0);
    expect(PLACES.second[0]).toBe(0);
    expect(PLACES.second[1]).toBeGreaterThan(PLACES.first[1]);
    // 60 ft between bases
    expect(Math.hypot(PLACES.first[0], PLACES.first[1])).toBeCloseTo(60, 0);
    expect(Math.hypot(PLACES.second[0] - PLACES.first[0], PLACES.second[1] - PLACES.first[1])).toBeCloseTo(60, 0);
  });
  it('puts every fielder on his own side', () => {
    expect(PLACES.SS[0]).toBeLessThan(0);
    expect(PLACES['2B'][0]).toBeGreaterThan(0);
    expect(PLACES['3B'][0]).toBeLessThan(0);
    expect(PLACES['1B'][0]).toBeGreaterThan(0);
    expect(PLACES.LF[0]).toBeLessThan(0);
    expect(PLACES.RF[0]).toBeGreaterThan(0);
    expect(PLACES.CF[0]).toBe(0);
    expect(PLACES.C[1]).toBeLessThan(0);
    expect(PLACES.P[1]).toBeGreaterThan(0);
    expect(PLACES.box3[0]).toBeLessThan(PLACES.third[0]);
    expect(PLACES.box1[0]).toBeGreaterThan(PLACES.first[0]);
  });
  it('keeps the corner infielders off the base paths', () => {
    // Distance from the first-to-second and second-to-third base lines.
    const off = (p: number[], sign: 1 | -1) => (sign * p[0] + p[1] - PLACES.second[1]) / Math.SQRT2;
    expect(off(PLACES['1B'], 1)).toBeGreaterThan(8);
    expect(off(PLACES['3B'], -1)).toBeGreaterThan(8);
    expect(off(PLACES['2B'], 1)).toBeGreaterThan(8);
    expect(off(PLACES.SS, -1)).toBeGreaterThan(8);
  });
});

describe('every drill diagram can really happen', () => {
  const ids = Object.keys(DIAGRAMS);
  it('belongs to a real library drill', () => {
    const known = new Set(LIBRARY_DRILLS.map((d) => d.id));
    for (const id of ids) expect(known.has(id), id).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(28);
  });
  it.each(ids)('%s passes every rule', (id) => {
    expect(validateDiagram(DIAGRAMS[id])).toEqual([]);
  });
  it('uses a field picture only for drills that need a field', () => {
    for (const id of ids) {
      const drill = LIBRARY_DRILLS.find((d) => d.id === id)!;
      if (DIAGRAMS[id].field === 'full') expect(drill.space, id).not.toBe('tight');
    }
  });
  it('keeps position labels on the right side of the field at the start', () => {
    const side: Record<string, -1 | 1> = { SS: -1, '3B': -1, LF: -1, '2B': 1, '1B': 1, RF: 1 };
    for (const id of ids) {
      const d = DIAGRAMS[id];
      if (d.field === 'open') continue;
      for (const a of d.actors) {
        const want = side[a.label ?? ''];
        if (!want || a.kind !== 'fielder') continue;
        const at = typeof a.at === 'string' ? PLACES[a.at] : a.at;
        // A fielder may start ON his base (x = 0 for second) but never on the other half.
        expect(at[0] * want, `${id}: ${a.label}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('keeps sentences short enough to read out loud, with no em dashes', () => {
    for (const id of ids) for (const p of DIAGRAMS[id].plays) for (const s of p.steps) {
      expect(s.say.length, `${id}: ${s.say}`).toBeLessThanOrEqual(230);
      expect(/[—–]/.test(s.say + (DIAGRAMS[id].note ?? '')), id).toBe(false);
    }
  });
});

describe('the rules catch pictures that could not happen', () => {
  const base: DrillDiagram = {
    field: 'infield',
    actors: [{ id: 'Co', kind: 'coach', label: 'Coach', at: 'coachHome' }, { id: 'SS', kind: 'fielder', label: 'SS', at: 'SS' }, { id: '1B', kind: 'fielder', label: '1B', at: 'first' }, { id: 'R', kind: 'runner', label: 'R', at: 'first' }],
    plays: [{ name: 'p', ball: '@Co', steps: [{ say: 'Ground ball.', moves: [{ kind: 'ground', to: '@SS' }] }, { say: 'Throw.', moves: [{ kind: 'throw', to: '@1B' }] }] }]
  };
  const withPlay = (steps: DrillDiagram['plays'][number]['steps'], extra: Partial<DrillDiagram> = {}): DrillDiagram => ({ ...base, ...extra, actors: extra.actors ?? base.actors.filter((a) => a.id !== 'R'), plays: [{ name: 'p', ball: '@Co', steps }] });
  it('accepts a plain ground ball and throw', () => {
    expect(validateDiagram(withPlay(base.plays[0].steps))).toEqual([]);
  });
  it('rejects a throw to an empty spot', () => {
    expect(validateDiagram(withPlay([{ say: 'x', moves: [{ kind: 'throw', to: 'third' }] }])).join(' ')).toMatch(/ends where nobody is/);
  });
  it('rejects a ball that starts where nobody is', () => {
    const d = withPlay([{ say: 'x', moves: [{ kind: 'throw', to: '@SS' }] }]);
    d.plays[0].ball = 'second';
    expect(validateDiagram(d).join(' ')).toMatch(/nobody is at the spot/);
  });
  it('rejects a runner going the wrong way round the bases', () => {
    const d: DrillDiagram = { ...base, plays: [{ name: 'p', steps: [{ say: 'x', moves: [{ kind: 'run', who: 'R', to: 'home' }] }] }] };
    expect(validateDiagram(d).join(' ')).toMatch(/wrong way/);
  });
  it('rejects two markers on top of each other and anything off the picture', () => {
    const d: DrillDiagram = { ...base, actors: [...base.actors.filter((a) => a.id !== 'R'), { id: 'X', kind: 'fielder', label: 'X', at: [-21, 80] }, { id: 'Y', kind: 'fielder', label: 'Y', at: [0, 300] }] };
    const e = validateDiagram(d).join(' ');
    expect(e).toMatch(/on top of each other/);
    expect(e).toMatch(/outside the picture/);
  });
  it('rejects a throw that runs through a bystander, unless the picture says it is meant to', () => {
    const through = (past?: string[]): DrillDiagram => ({
      field: 'infield',
      actors: [{ id: 'C', kind: 'fielder', label: 'C', at: 'C' }, { id: 'P', kind: 'fielder', label: 'P', at: 'P' }, { id: 'SS', kind: 'fielder', label: 'SS', at: 'second' }],
      plays: [{ name: 'p', ball: '@C', steps: [{ say: 'Throw.', moves: [{ kind: 'throw', to: '@SS', past }] }] }]
    });
    expect(validateDiagram(through()).join(' ')).toMatch(/goes through P/);
    expect(validateDiagram(through(['P']))).toEqual([]);
  });
  it('rejects two people ending a step on the same spot, and words that sit on a line or run off the picture', () => {
    const d = withPlay([{ say: 'x', moves: [{ kind: 'ground', to: '@SS' }, { kind: 'run', who: '1B', to: '@SS' }] }]);
    expect(validateDiagram(d).join(' ')).toMatch(/on top of each other after step 1/);
    const w = withPlay(base.plays[0].steps, { marks: [{ at: [-20, 40], text: 'forty feet' }, { at: [70, 100], text: 'this line of words is far too long to fit' }] });
    const e = validateDiagram(w).join(' ');
    expect(e).toMatch(/crosses the words "forty feet"/);
    expect(e).toMatch(/run off the picture/);
  });
  it('lets a coach beside the plate hit from the plate, and nobody else', () => {
    const hit = withPlay([{ say: 'x', moves: [{ kind: 'ground', to: '@SS' }] }]);
    hit.plays[0].ball = 'home';
    expect(validateDiagram(hit)).toEqual([]);
    const noCoach: DrillDiagram = { ...hit, actors: hit.actors.filter((a) => a.kind !== 'coach') };
    expect(validateDiagram(noCoach).join(' ')).toMatch(/nobody is at the spot/);
  });
  it('lets a version move a player before it starts', () => {
    const d = withPlay(base.plays[0].steps);
    d.plays[0].start = { SS: [-10, 70] };
    expect(simulate(d, 0, 0).pos.SS).toEqual([-10, 70]);
    d.plays[0].start = { Nobody: [0, 0] };
    expect(validateDiagram(d).join(' ')).toMatch(/cannot place Nobody/);
  });
  it('lets a fielder who runs to the ball carry it', () => {
    const d = withPlay([{ say: 'x', moves: [{ kind: 'ground', to: [-10, 60] }, { kind: 'run', who: 'SS', to: [-10, 60] }] }, { say: 'y', moves: [{ kind: 'run', who: 'SS', to: 'second' }] }]);
    expect(validateDiagram(d)).toEqual([]);
    expect(simulate(d, 0).ball).toEqual(PLACES.second);
  });
});

describe('finding the picture for a drill', () => {
  it('gives a library drill its own picture and a copy the original picture', () => {
    expect(diagramFor({ id: 'lib-inf-005' })).toBe(DIAGRAMS['lib-inf-005']);
    expect(diagramFor({ id: 'abc', diagramId: 'lib-inf-005' })).toBe(DIAGRAMS['lib-inf-005']);
    expect(diagramFor({ id: 'abc' })).toBeUndefined();
  });
  it('keeps the original picture on a coach\'s own copy of a drill', async () => {
    const db = new DugoutLabDB(`dia-${Math.random().toString(36).slice(2)}`);
    await seedLibrary(db);
    const copy = await duplicateDrill('lib-inf-005', db);
    expect(copy.diagramId).toBe('lib-inf-005');
    expect(diagramFor(copy)).toBe(DIAGRAMS['lib-inf-005']);
    const copyOfCopy = await duplicateDrill(copy.id, db);
    expect(copyOfCopy.diagramId).toBe('lib-inf-005');
    db.close();
  });
  it('fits a phone: every picture is at most 1.2 times as tall as it is wide', () => {
    for (const d of Object.values(DIAGRAMS)) { const { box } = viewOf(d); expect((box[3] - box[2]) / (box[1] - box[0])).toBeLessThanOrEqual(1.2); }
  });
});
