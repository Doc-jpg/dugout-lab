import { describe, it, expect } from 'vitest';
import { generatePractice, adjustPractice, regenerateStation, validatePractice, blockBudget, stationCount, type GeneratorContext } from '../src/engine/generator';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { DEFAULT_SETTINGS, nowIso, type Drill, type Player, type Team, type PracticeInputs } from '../src/engine/types';

const ts = nowIso();
const team: Team = { id: 't1', name: 'Test 12U', ageGroup: '12U', priorities: ['infield', 'hitting'], createdAt: ts, updatedAt: ts };
const drills: Drill[] = LIBRARY_DRILLS.map((d) => ({ ...d, createdAt: ts, updatedAt: ts }));
function player(i: number, extra: Partial<Player> = {}): Player {
  return { id: `p${i}`, teamId: 't1', firstName: `Kid${i}`, lastName: `L${i}`, number: String(i), positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, createdAt: ts, updatedAt: ts, ...extra };
}
const twelve = Array.from({ length: 12 }, (_, i) => player(i + 1));
// Four with different objectives (Test A)
twelve[0].goals = [{ id: 'g1', category: 'infield', text: 'Backhand footwork', kind: 'technical', status: 'active', createdAt: ts }];
twelve[1].goals = [{ id: 'g2', category: 'hitting', text: 'Front foot down early', kind: 'technical', status: 'active', createdAt: ts }];
twelve[2].goals = [{ id: 'g3', category: 'mental', text: 'Breath before every pitch', kind: 'mental', status: 'active', createdAt: ts }];
twelve[3].levels = { infield: 1, hitting: 1 };
twelve[4].levels = { infield: 5, hitting: 5 };

function ctx(over: Partial<GeneratorContext> = {}): GeneratorContext {
  return { team, players: twelve, drills, variants: [], recentPractices: [], observations: [], throwing: [], settings: DEFAULT_SETTINGS, seed: 42, ...over };
}
function inputs(over: Partial<PracticeInputs> = {}): PracticeInputs {
  return { teamId: 't1', presentIds: twelve.map((p) => p.id), absentIds: [], durationMin: 75, coaches: 2, equipment: DEFAULT_SETTINGS.defaultEquipment, space: 'full', indoor: false, teamPriorities: team.priorities, playerPriorities: {}, noThrowingIds: [], ...over };
}

describe('Test A: 12 players, four with objectives, 75 minutes, no unassigned players', () => {
  it('builds rotating stations with every player in a group and an objective everywhere', () => {
    const p = generatePractice(inputs(), ctx());
    expect(validatePractice(p)).toEqual([]);
    expect(p.blocks.reduce((s, b) => s + b.minutes, 0)).toBe(75);
    const rotating = p.blocks.filter((b) => !b.wholeTeam);
    expect(rotating.length).toBeGreaterThanOrEqual(3);
    for (const b of rotating) {
      expect(b.stations.length).toBe(b.groups.length);
      expect(b.stations.length).toBe(3); // 12 kids, 2 coaches: 3 stations, groups of 4
      expect(new Set(b.groups.flatMap((g) => g.playerIds)).size).toBe(12);
    }
    // The goals show up as objectives at matching stations
    const infieldStations = p.blocks.flatMap((b) => b.stations).filter((s) => drills.find((d) => d.id === s.drillId)?.category === 'infield');
    expect(infieldStations.length).toBeGreaterThan(0);
    for (const s of infieldStations) {
      expect(s.objectives.find((o) => o.playerId === 'p1')?.technical).toBe('Backhand footwork');
      expect(s.objectives.find((o) => o.playerId === 'p1')?.from).toBe('goal');
      expect(s.objectives.find((o) => o.playerId === 'p4')?.from).toBe('level');
      expect(s.objectives.find((o) => o.playerId === 'p5')?.from).toBe('level');
      expect(s.objectives.find((o) => o.playerId === 'p4')?.technical).not.toBe(s.objectives.find((o) => o.playerId === 'p5')?.technical);
    }
    // Mental goal rides along everywhere
    const anyStation = p.blocks[1].stations[0];
    expect(anyStation.objectives.find((o) => o.playerId === 'p3')?.mental).toBe('Breath before every pitch');
    // No drill twice
    const ids = p.blocks.flatMap((b) => b.stations.map((s) => s.drillId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('station count follows coaches and head count', () => {
    expect(stationCount(12, 2)).toBe(3);
    expect(stationCount(12, 1)).toBe(2);
    expect(stationCount(6, 3)).toBe(2);
    expect(stationCount(14, 4)).toBe(4);
    expect(blockBudget(75).reduce((s, b) => s + b.minutes, 0)).toBe(75);
    expect(blockBudget(40).find((b) => b.kind === 'compete')).toBeUndefined();
  });

  it('is deterministic for a seed', () => {
    const a = generatePractice(inputs(), ctx({ seed: 5 }));
    const b = generatePractice(inputs(), ctx({ seed: 5 }));
    expect(a.blocks.map((x) => x.stations.map((s) => s.drillId))).toEqual(b.blocks.map((x) => x.stations.map((s) => s.drillId)));
  });
});

describe('player-specific variants win over generic objectives', () => {
  it('uses the saved version at every station that runs the drill', () => {
    const gb = drills.find((d) => d.category === 'infield' && d.blocks.includes('focus'))!;
    const variants = [{ id: 'v1', drillId: gb.id, playerId: 'p6', name: 'Soft balls, stationary', objective: 'Clean glove work from a set position', reps: '2 x 8', createdAt: ts, updatedAt: ts }];
    let p = generatePractice(inputs({ teamPriorities: ['infield'] }), ctx({ variants, seed: 3 }));
    // Force the drill onto a station if the generator did not pick it
    const block = p.blocks.find((b) => b.kind === 'focus')!;
    if (!p.blocks.some((b) => b.stations.some((s) => s.drillId === gb.id))) {
      p = regenerateStation(p, block.id, block.stations[0].id, ctx({ variants, drills: [gb, ...drills.filter((d) => d.id !== gb.id)] }), { category: 'infield' });
    }
    const st = p.blocks.flatMap((b) => b.stations).find((s) => s.drillId === gb.id);
    if (st) {
      const o = st.objectives.find((x) => x.playerId === 'p6')!;
      expect(o.from).toBe('variant');
      expect(o.variantId).toBe('v1');
      expect(o.technical).toContain('Clean glove work');
      expect(o.technical).toContain('2 x 8');
    }
  });
});

describe('Test D: 90 to 60 minutes keeps personalized objectives', () => {
  it('rescales blocks and keeps every objective', () => {
    const p90 = generatePractice(inputs({ durationMin: 90 }), ctx());
    const before = p90.blocks.flatMap((b) => b.stations.flatMap((s) => s.objectives.map((o) => `${s.id}:${o.playerId}:${o.technical}`)));
    const p60 = adjustPractice(p90, { kind: 'duration', minutes: 60 }, ctx());
    expect(p60.blocks.reduce((s, b) => s + b.minutes, 0)).toBe(60);
    expect(validatePractice(p60)).toEqual([]);
    const after = p60.blocks.flatMap((b) => b.stations.flatMap((s) => s.objectives.map((o) => `${s.id}:${o.playerId}:${o.technical}`)));
    expect(after).toEqual(before);
    expect(p60.blocks.map((b) => b.stations.map((s) => s.drillId))).toEqual(p90.blocks.map((b) => b.stations.map((s) => s.drillId)));
  });
  it('drops the compete block below 45 minutes but keeps the rest', () => {
    const p = adjustPractice(generatePractice(inputs({ durationMin: 90 }), ctx()), { kind: 'duration', minutes: 40 }, ctx());
    expect(p.blocks.find((b) => b.kind === 'compete')).toBeUndefined();
    expect(validatePractice(p)).toEqual([]);
  });
});

describe('one-tap adjustments', () => {
  it('fewer coaches merges stations and keeps everyone assigned', () => {
    const p = adjustPractice(generatePractice(inputs(), ctx()), { kind: 'coaches', coaches: 1 }, ctx());
    for (const b of p.blocks.filter((x) => !x.wholeTeam)) expect(b.stations.length).toBe(2);
    expect(validatePractice(p)).toEqual([]);
  });
  it('removing a player takes him out of every group and objective', () => {
    const p = adjustPractice(generatePractice(inputs(), ctx()), { kind: 'remove_player', playerId: 'p7' }, ctx());
    expect(p.inputs.presentIds).not.toContain('p7');
    expect(p.inputs.absentIds).toContain('p7');
    for (const b of p.blocks) {
      expect(b.groups.flatMap((g) => g.playerIds)).not.toContain('p7');
      for (const s of b.stations) expect(s.objectives.some((o) => o.playerId === 'p7')).toBe(false);
    }
    expect(validatePractice(p)).toEqual([]);
  });
  it('a late arrival joins the smallest group with his own objectives', () => {
    const base = generatePractice(inputs({ presentIds: twelve.slice(0, 11).map((x) => x.id), absentIds: ['p12'] }), ctx());
    const p = adjustPractice(base, { kind: 'add_player', playerId: 'p12' }, ctx());
    expect(p.inputs.presentIds).toContain('p12');
    for (const b of p.blocks) for (const s of b.stations) expect(s.objectives.some((o) => o.playerId === 'p12')).toBe(true);
    expect(validatePractice(p)).toEqual([]);
  });
  it('moving indoors swaps only outdoor-only stations', () => {
    const base = generatePractice(inputs(), ctx());
    const p = adjustPractice(base, { kind: 'indoor' }, ctx());
    for (const b of p.blocks) for (const s of b.stations) expect(drills.find((d) => d.id === s.drillId)?.indoorOk).toBe(true);
    const keptCount = base.blocks.flatMap((b) => b.stations).filter((s, i) => p.blocks.flatMap((x) => x.stations)[i]?.drillId === s.drillId).length;
    expect(keptCount).toBeGreaterThan(0);
  });
  it('regenerate one station leaves the others untouched', () => {
    const base = generatePractice(inputs(), ctx());
    const b = base.blocks.find((x) => x.kind === 'focus')!;
    const target = b.stations[1];
    const p = regenerateStation(base, b.id, target.id, ctx({ seed: 99 }));
    const nb = p.blocks.find((x) => x.id === b.id)!;
    expect(nb.stations[0].drillId).toBe(b.stations[0].drillId);
    expect(nb.stations[2].drillId).toBe(b.stations[2].drillId);
    expect(nb.stations[1].drillId).not.toBe(target.drillId);
    expect(nb.stations[1].objectives.length).toBe(12);
  });
});

describe('throwing workload', () => {
  it('no-throwing players get rest objectives and high-load drills are skipped', () => {
    const p = generatePractice(inputs({ noThrowingIds: ['p2'], teamPriorities: ['pitching', 'throwing'] }), ctx({ seed: 8 }));
    for (const s of p.blocks.flatMap((b) => b.stations)) {
      const d = drills.find((x) => x.id === s.drillId)!;
      expect(d.throwingLoad).not.toBe('high');
      if (d.throwingLoad !== 'none') expect(s.objectives.find((o) => o.playerId === 'p2')?.technical).toMatch(/No throws today/);
    }
    expect(p.rationale.some((r) => /No throwing today/.test(r))).toBe(true);
  });
});
