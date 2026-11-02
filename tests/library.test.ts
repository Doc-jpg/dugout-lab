import { describe, it, expect } from 'vitest';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { DRILL_EXTRAS, AUDIT_NOTES } from '../src/data/drills-extra';

describe('drill library quality gates', () => {
  it('has 110 drills with unique ids and every required field filled', () => {
    expect(LIBRARY_DRILLS.length).toBe(110);
    expect(new Set(LIBRARY_DRILLS.map((d) => d.id)).size).toBe(110);
    for (const d of LIBRARY_DRILLS) {
      expect(d.name.trim().length, d.id).toBeGreaterThan(3);
      expect(d.steps.length, d.id).toBeGreaterThanOrEqual(2);
      expect(d.cues.length, d.id).toBeGreaterThanOrEqual(1);
      expect(d.success.trim().length, d.id).toBeGreaterThan(10);
      expect(d.easier.trim().length, d.id).toBeGreaterThan(5);
      expect(d.harder.trim().length, d.id).toBeGreaterThan(5);
      expect(d.minutes, d.id).toBeGreaterThanOrEqual(d.blocks.includes('reflect') ? 3 : 4);
      expect(d.playersMin, d.id).toBeLessThanOrEqual(d.playersMax);
      expect(d.levelMin, d.id).toBeLessThanOrEqual(d.levelMax);
    }
  });
  it('merges a coaching extra onto every library drill', () => {
    for (const d of LIBRARY_DRILLS) {
      expect(DRILL_EXTRAS[d.id], d.id).toBeDefined();
      expect((d.mistakes?.length ?? 0) + (d.competitive ? 1 : 0), d.id).toBeGreaterThan(0);
    }
  });
  it('never ships weighted-ball, max-velocity, or headfirst-dive content', () => {
    const banned = /weighted ball|max velocity|radar gun|headfirst dive|head-first dive|bounce baseballs off a wall/i;
    for (const d of LIBRARY_DRILLS) {
      const text = [d.name, d.objective, d.setup, ...d.steps, d.easier, d.harder, d.success, d.competitive ?? ''].join(' '); // safety lines may name the thing they forbid
      expect(banned.test(text), `${d.id}: ${text.match(banned)?.[0]}`).toBe(false);
    }
  });
  it('applies the audit notes: no warmup block on the compete throwing drill, bullpen-style drills count as high load, young ages gated', () => {
    const by = (id: string) => LIBRARY_DRILLS.find((d) => d.id === id)!;
    expect(by('lib-thr-009').blocks).not.toContain('warmup');
    expect(by('lib-cat-007').throwingLoad).toBe('high');
    expect(by('lib-pit-004').throwingLoad).toBe('high');
    expect(by('lib-inf-010').harder).not.toMatch(/baseballs off a wall/);
    expect(by('lib-hit-008').tags).not.toContain('hit-and-run');
    expect(by('lib-inf-012').steps.join(' ')).toMatch(/15 clean outs/);
    expect(by('lib-of-005').setup).toMatch(/60 feet/);
    expect(by('lib-thr-006').setup).toMatch(/120 feet/);
    expect(AUDIT_NOTES.length).toBeGreaterThanOrEqual(20);
  });
  it('keeps every age group covered in every block kind', () => {
    const blocks = ['warmup', 'focus', 'gamelike', 'compete'] as const;
    for (const b of blocks) expect(LIBRARY_DRILLS.filter((d) => d.blocks.includes(b)).length, b).toBeGreaterThanOrEqual(8);
    const indoor = LIBRARY_DRILLS.filter((d) => d.indoorOk);
    expect(indoor.length).toBeGreaterThanOrEqual(40);
    const noGear = LIBRARY_DRILLS.filter((d) => d.equipment.every((e) => ['balls', 'gloves', 'tennis_balls', 'cones'].includes(e)));
    expect(noGear.length).toBeGreaterThanOrEqual(25);
  });
});
