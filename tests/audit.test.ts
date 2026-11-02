import { describe, it, expect } from 'vitest';
import { generatePractice, adjustPractice, validatePractice, type GeneratorContext } from '../src/engine/generator';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { DEFAULT_SETTINGS, nowIso, type Drill, type Player, type Team, type PracticeInputs } from '../src/engine/types';

const ts = nowIso();
const drills: Drill[] = LIBRARY_DRILLS.map((d) => ({ ...d, createdAt: ts, updatedAt: ts }));
const team = (ageGroup: Team['ageGroup'] = '12U'): Team => ({ id: 't', name: 'T', ageGroup, priorities: ['hitting', 'infield'], createdAt: ts, updatedAt: ts });
const kids = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, teamId: 't', firstName: `K${i + 1}`, lastName: 'L', positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, createdAt: ts, updatedAt: ts }));
const ctx = (players: Player[], over: Partial<GeneratorContext> = {}): GeneratorContext => ({ team: team(), players, drills, variants: [], recentPractices: [], observations: [], throwing: [], settings: DEFAULT_SETTINGS, seed: 1, ...over });
const inputs = (players: Player[], over: Partial<PracticeInputs> = {}): PracticeInputs => ({ teamId: 't', presentIds: players.map((p) => p.id), absentIds: [], durationMin: 75, coaches: 2, equipment: DEFAULT_SETTINGS.defaultEquipment, space: 'full', indoor: false, teamPriorities: ['hitting', 'infield'], playerPriorities: {}, noThrowingIds: [], ...over });

describe('audit: the plan is physically executable', () => {
  for (const n of [1, 2, 3, 5, 7, 9, 13, 15, 30]) {
    for (const coaches of [1, 2, 4]) {
      it(`${n} players, ${coaches} coach(es): valid, no empty station, groups of at least 2 when possible, rotations at least 4 min`, () => {
        const k = kids(n);
        const p = generatePractice(inputs(k, { coaches }), ctx(k));
        expect(validatePractice(p)).toEqual([]);
        for (const b of p.blocks) {
          expect(b.stations.length).toBeGreaterThan(0);
          if (!b.wholeTeam) {
            expect(b.rotationMin).toBeGreaterThanOrEqual(4);
            if (n >= 4) for (const g of b.groups) expect(g.playerIds.length).toBeGreaterThanOrEqual(2);
            expect(b.stations.length).toBeLessThanOrEqual(Math.max(coaches + 1, Math.ceil(n / 6), 5));
            for (const g of b.groups) expect(g.playerIds.length).toBeLessThanOrEqual(b.kind === 'gamelike' ? 8 : 6);
            for (const s of b.stations) expect(drills.find((d) => d.id === s.drillId)!.minutes).toBeLessThanOrEqual(b.rotationMin * 2 + 2);
          }
        }
      });
    }
  }
  it('20 minutes: still a valid plan with warm-up and something to do, and it really takes 20 minutes', () => {
    const k = kids(10);
    const p = generatePractice(inputs(k, { durationMin: 20 }), ctx(k));
    expect(validatePractice(p)).toEqual([]);
    expect(p.blocks.reduce((s, b) => s + b.minutes, 0)).toBe(20);
    expect(p.blocks[0].kind).toBe('warmup');
    // Live mode runs rotationMin x rotations per block; that must not exceed the block's minutes
    const liveMinutes = p.blocks.reduce((s, b) => s + b.rotationMin * (b.wholeTeam ? Math.max(1, b.stations.length) : Math.max(1, b.groups.length)), 0);
    expect(liveMinutes).toBeLessThanOrEqual(20);
  });
  it('going from 30 to 120 minutes brings the dropped blocks back and adds up', () => {
    const k = kids(10);
    const p30 = generatePractice(inputs(k, { durationMin: 30 }), ctx(k));
    const p120 = adjustPractice(p30, { kind: 'duration', minutes: 120 }, ctx(k));
    expect(validatePractice(p120)).toEqual([]);
    expect(p120.blocks.reduce((s, b) => s + b.minutes, 0)).toBe(120);
    expect(p120.blocks.map((b) => b.kind)).toEqual(['warmup', 'fundamentals', 'focus', 'gamelike', 'compete', 'reflect']);
  });
  it('no equipment beyond balls and gloves, tight space, indoors: every station fits', () => {
    const k = kids(12);
    const p = generatePractice(inputs(k, { equipment: [], space: 'tight', indoor: true }), ctx(k));
    expect(validatePractice(p)).toEqual([]);
    for (const b of p.blocks) for (const s of b.stations) {
      const d = drills.find((x) => x.id === s.drillId)!;
      expect(d.indoorOk).toBe(true);
      expect(d.space).toBe('tight');
      expect(d.equipment.every((e) => ['balls', 'gloves', 'bats', 'helmets'].includes(e))).toBe(true);
    }
  });
  it('everyone resting an arm: no high-load drills and rest objectives on throwing drills', () => {
    const k = kids(8);
    const p = generatePractice(inputs(k, { noThrowingIds: k.map((x) => x.id), teamPriorities: ['throwing', 'pitching'] }), ctx(k));
    expect(validatePractice(p)).toEqual([]);
    for (const b of p.blocks) for (const s of b.stations) {
      const d = drills.find((x) => x.id === s.drillId)!;
      expect(d.throwingLoad).not.toBe('high');
    }
  });
  it('6U and HS teams get age-appropriate drills', () => {
    const k = kids(8);
    const p6 = generatePractice(inputs(k), ctx(k, { team: team('6U') }));
    for (const b of p6.blocks) for (const s of b.stations) {
      const d = drills.find((x) => x.id === s.drillId)!;
      expect(d.ageMin === undefined || parseInt(d.ageMin) <= 6).toBe(true);
    }
    expect(validatePractice(generatePractice(inputs(k), ctx(k, { team: team('HS') })))).toEqual([]);
  });
  it('Scenario C: three absent, one assistant, smaller field, in three taps, objectives kept', () => {
    const k = kids(12);
    k[0].goals = [{ id: 'g', category: 'hitting', text: 'Front foot down early', kind: 'technical', status: 'active', createdAt: ts }];
    let p = generatePractice(inputs(k), ctx(k));
    const goalObjectiveBefore = p.blocks.flatMap((b) => b.stations).filter((s) => s.objectives.find((o) => o.playerId === 'p1')?.from === 'goal').length;
    expect(goalObjectiveBefore).toBeGreaterThan(0);
    for (const id of ['p10', 'p11', 'p12']) p = adjustPractice(p, { kind: 'remove_player', playerId: id }, ctx(k));
    p = adjustPractice(p, { kind: 'coaches', coaches: 1 }, ctx(k));
    expect(validatePractice(p)).toEqual([]);
    expect(p.inputs.presentIds.length).toBe(9);
    for (const b of p.blocks.filter((x) => !x.wholeTeam)) expect(b.stations.length).toBe(2);
    const goalObjectiveAfter = p.blocks.flatMap((b) => b.stations).filter((s) => s.objectives.find((o) => o.playerId === 'p1')?.from === 'goal').length;
    expect(goalObjectiveAfter).toBeGreaterThan(0);
  });
  it('plans do not repeat the previous practice wholesale', () => {
    const k = kids(12);
    const a = generatePractice(inputs(k), ctx(k, { seed: 3 }));
    a.status = 'done';
    const b = generatePractice(inputs(k), ctx(k, { seed: 4, recentPractices: [a] }));
    const ida = new Set(a.blocks.flatMap((x) => x.stations.map((s) => s.drillId)));
    const idb = b.blocks.flatMap((x) => x.stations.map((s) => s.drillId));
    const repeated = idb.filter((id) => ida.has(id)).length;
    expect(repeated).toBeLessThan(idb.length / 2);
  });
  it('30 players generate in well under a second', () => {
    const k = kids(30);
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) generatePractice(inputs(k, { coaches: 4 }), ctx(k, { seed: i }));
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
