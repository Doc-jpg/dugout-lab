import { describe, it, expect } from 'vitest';
import { paletteFromPixels, suggestPair, inkFor, usableAsAccent, contrastRatio, programName, brandCss, hexToRgb } from '../src/engine/brand';
import { renderScorecardHtml, scorecardFor, parentEmailDraft, homePlanFor, renderHomePlanHtml } from '../src/engine/home';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { nowIso, DEFAULT_SETTINGS, ageOf, AGE_GROUPS, seasonYearFor, ageGroupForClass, teamAgeGroup, type Drill, type Player, type Team } from '../src/engine/types';

describe('age groups', () => {
  it('runs one per year from 6U to 18U plus HS, and old values still parse', () => {
    expect(AGE_GROUPS[0]).toBe('6U');
    expect(AGE_GROUPS).toContain('13U');
    expect(AGE_GROUPS[AGE_GROUPS.length - 1]).toBe('HS');
    expect(ageOf('13U')).toBe(13);
    expect(ageOf('HS')).toBe(16);
    expect(ageOf('16U+')).toBe(16);
    expect(ageOf(undefined)).toBe(12);
  });
  it('graduation year moves the team up each season, fall counting toward the coming spring', () => {
    expect(seasonYearFor(new Date('2026-11-02T12:00:00'))).toBe(2027);
    expect(seasonYearFor(new Date('2027-04-15T12:00:00'))).toBe(2027);
    expect(seasonYearFor(new Date('2027-08-01T12:00:00'))).toBe(2028);
    expect(ageGroupForClass(2032, 2027)).toBe('13U');
    expect(ageGroupForClass(2032, 2028)).toBe('14U');
    expect(ageGroupForClass(2027, 2027)).toBe('18U');
    expect(ageGroupForClass(2040, 2027)).toBe('6U');
    const t = { ageGroup: '10U' as const, gradYear: 2032 };
    expect(teamAgeGroup(t, new Date('2026-11-02T12:00:00'))).toBe('13U');
    expect(teamAgeGroup(t, new Date('2027-09-01T12:00:00'))).toBe('14U');
    expect(teamAgeGroup({ ageGroup: '10U' as const }, new Date('2026-11-02T12:00:00'))).toBe('10U');
  });
});

const ts = nowIso();
function pixels(colors: Array<[number, number, number, number, number]>): number[] {
  const out: number[] = [];
  for (const [r, g, b, a, n] of colors) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return out;
}

describe('colors from a logo', () => {
  it('finds the dominant colors and ignores white, gray and transparent pixels', () => {
    const data = pixels([[255, 255, 255, 255, 500], [138, 59, 18, 255, 300], [242, 193, 78, 255, 150], [128, 128, 128, 255, 200], [10, 10, 10, 0, 100]]);
    const pal = paletteFromPixels(data);
    expect(pal.length).toBe(2);
    expect(pal[0].hex).toBe('#8a3b12');
    expect(pal[1].hex).toBe('#f2c14e');
    expect(pal[0].share).toBeCloseTo(300 / 450, 2);
    const pair = suggestPair(pal);
    expect(pair).toEqual({ primary: '#8a3b12', accent: '#f2c14e' });
  });
  it('text color and button shade keep contrast', () => {
    expect(inkFor('#13213a')).toBe('#ffffff');
    expect(inkFor('#f2c14e')).toBe('#111111');
    const pale = usableAsAccent('#dfe8f5');
    expect(contrastRatio(pale, '#ffffff') >= 3 || contrastRatio(pale, '#111111') >= 4.5).toBe(true);
    expect(usableAsAccent('#1d4e89')).toBe('#1d4e89');
    expect(usableAsAccent('nonsense')).toBe('#1d4e89');
    expect(hexToRgb('#ZZZ')).toBeNull();
  });
});

describe('brand on screen and on parent pages', () => {
  const team: Team = { id: 't', name: 'Dirtbags 12U', ageGroup: '12U', priorities: [], createdAt: ts, updatedAt: ts, brand: { programName: 'Performance Baseball', tagline: 'Every kid gets better here', logo: 'data:image/png;base64,iVBORw0KGgo=', primary: '#8a3b12', accent: '#f2c14e', coaches: [{ name: 'Deren Flesher', role: 'Head coach', phone: '555-0100', email: 'coach@example.com' }], footer: 'performancebaseball.example.com' } };
  const player: Player = { id: 'j', teamId: 't', firstName: 'Jonah', lastName: 'Pike', positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: { hitting: 3 }, statuses: {}, parents: [{ name: 'Dana Pike' }], createdAt: ts, updatedAt: ts };
  const drills: Drill[] = LIBRARY_DRILLS.map((d) => ({ ...d, createdAt: ts, updatedAt: ts }));
  it('program name falls back sensibly', () => {
    expect(programName(team, DEFAULT_SETTINGS)).toBe('Performance Baseball');
    expect(programName({ ...team, brand: undefined }, DEFAULT_SETTINGS)).toBe('Dirtbags 12U');
    expect(programName(undefined, { ...DEFAULT_SETTINGS, appName: 'Wow Factor 2032' })).toBe('Wow Factor 2032');
  });
  it('app css comes from the primary color with readable ink', () => {
    const css = brandCss(team.brand);
    expect(css['--accent']).toBe('#8a3b12');
    expect(css['--accent-ink']).toBe('#ffffff');
    expect(css['--brand-accent']).toBe('#f2c14e');
    expect(brandCss(undefined)).toEqual({});
  });
  it('scorecard and home plan carry logo, name, colors, coaches and footer', () => {
    const brand = { team, settings: DEFAULT_SETTINGS, coachName: 'Deren' };
    const html = renderScorecardHtml(scorecardFor(player, [player], [], [], { brand }));
    expect(html).toContain('Performance Baseball');
    expect(html).toContain('Every kid gets better here');
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(html).toContain('--p:#8a3b12');
    expect(html).toContain('Deren Flesher (Head coach) 555-0100 coach@example.com');
    expect(html).toContain('performancebaseball.example.com');
    const plan = renderHomePlanHtml(player, homePlanFor(player, drills, [], []), { coachName: 'Deren', brand });
    expect(plan).toContain('Performance Baseball');
    expect(plan).toContain('Coaches:');
  });
  it('email draft signs with the program and the coach contact', () => {
    const e = parentEmailDraft({ player, team, settings: DEFAULT_SETTINGS, coachName: 'Deren', observations: [], practices: [], plan: homePlanFor(player, drills, [], []) });
    expect(e.body).toMatch(/Coach Deren\nPerformance Baseball\n555-0100 · coach@example.com$/);
  });
});
