import { describe, it, expect } from 'vitest';
import { homePlanFor, homeFriendly, parentTextDraft, parentEmailDraft, scorecardFor, renderScorecardHtml, renderHomePlanHtml, teamBands, dueForUpdate, smsLink, mailtoLink } from '../src/engine/home';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { nowIso, type Drill, type Player, type Observation, type Practice } from '../src/engine/types';

const ts = nowIso();
const drills: Drill[] = LIBRARY_DRILLS.map((d) => ({ ...d, createdAt: ts, updatedAt: ts }));
const base = (over: Partial<Player> = {}): Player => ({ id: 'j', teamId: 't', firstName: 'Jonah', lastName: 'Pike', number: '2', positions: ['CF'], status: 'active', strengths: [], challenges: [], goals: [], cues: ['Drop step, then find it'], approaches: [], levels: { outfield: 3, hitting: 2 }, statuses: {}, parents: [{ name: 'Dana Pike', phone: '(555) 010-2222', email: 'dana@example.com' }], createdAt: ts, updatedAt: ts, ...over });
const obs = (over: Partial<Observation>): Observation => ({ id: Math.random().toString(36).slice(2), playerId: 'j', read: 'got_it', source: 'practice', ts: nowIso(), ...over });
const practice = (date: string, present: string[]): Practice => ({ id: date, teamId: 't', date, status: 'done', inputs: { teamId: 't', presentIds: present, absentIds: [], durationMin: 60, coaches: 1, equipment: [], space: 'full', indoor: false, teamPriorities: [], playerPriorities: {}, noThrowingIds: [] }, blocks: [], rationale: [], createdAt: ts, updatedAt: ts });

describe('home plan', () => {
  it('library has backyard-friendly drills in the main areas', () => {
    const home = drills.filter(homeFriendly);
    expect(home.length).toBeGreaterThan(15);
    for (const c of ['hitting', 'infield', 'throwing', 'mental']) expect(home.some((d) => d.category === c || d.also?.includes(c as any))).toBe(true);
    expect(home.every((d) => d.throwingLoad !== 'high')).toBe(true);
  });
  it('picks drills from goals and rough notes, uses the saved version, caps at three', () => {
    const p = base({ goals: [{ id: 'g1', category: 'hitting', kind: 'technical', text: 'Front foot down early', status: 'active', createdAt: ts }, { id: 'g2', category: 'mental', kind: 'mental', text: 'One breath before every pitch', status: 'active', createdAt: ts }] });
    const o = [obs({ read: 'hesitated', category: 'outfield' }), obs({ read: 'struggled', category: 'outfield', source: 'game' })];
    const hit = drills.find((d) => d.category === 'hitting' && homeFriendly(d))!;
    const variants = [{ id: 'v1', drillId: hit.id, playerId: 'j', name: 'Jonah tee', objective: 'Foot down, then swing', reps: '3 x 6', createdAt: ts, updatedAt: ts }];
    const plan = homePlanFor(p, drills, o, variants);
    expect(plan.focus[0]).toEqual({ category: 'hitting', text: 'Front foot down early' });
    expect(plan.focus.some((f) => f.category === 'outfield')).toBe(true);
    expect(plan.drills.length).toBeLessThanOrEqual(3);
    expect(plan.drills.length).toBeGreaterThanOrEqual(2);
    expect(plan.drills.every((d) => homeFriendly(d.drill))).toBe(true);
    const h = plan.drills.find((d) => d.category === 'hitting');
    if (h && h.drill.id === hit.id) {
      expect(h.objective).toBe('Foot down, then swing');
      expect(h.reps).toBe('3 x 6');
    }
    expect(plan.mental).toBe('One breath before every pitch');
    expect(plan.basis.length).toBeGreaterThan(1);
  });
  it('with nothing known falls back to general reps without crashing', () => {
    const plan = homePlanFor(base({ levels: {}, cues: [] }), drills, [], []);
    expect(plan.drills.length).toBeGreaterThan(0);
    expect(plan.basis[0]).toMatch(/No goals or notes/);
  });
});

describe('parent drafts', () => {
  const p = base({ goals: [{ id: 'g1', category: 'outfield', kind: 'technical', text: 'Drop step on the crack of the bat', status: 'active', createdAt: ts }] });
  const o = [obs({ read: 'got_it', category: 'outfield' }), obs({ read: 'hustle' }), obs({ read: 'hustle' }), obs({ read: 'struggled', category: 'hitting', text: 'private detail about a meltdown' })];
  const practices = [practice('2026-10-30', ['j']), practice('2026-11-01', ['j'])];
  const plan = homePlanFor(p, drills, o, []);
  it('text draft leads with wins, names the home work, never leaks note text or other kids', () => {
    const t = parentTextDraft({ player: p, coachName: 'Deren', observations: o, practices, plan });
    expect(t).toMatch(/^Hi Dana, Coach Deren here with a quick Jonah update\./);
    expect(t).toMatch(/Good stuff lately: Jonah nailed a outfield defense rep|Good stuff lately: Jonah hustled/);
    expect(t).toMatch(/Effort has been there, 2 times/);
    expect(t).toMatch(/At home, \d+ min, 2x a week:/);
    expect(t).not.toMatch(/meltdown/);
    expect(t).not.toMatch(/correction|punish/i);
    expect(t.length).toBeLessThan(1200);
  });
  it('email draft has a subject, steps for each drill, and the sign-off', () => {
    const e = parentEmailDraft({ player: p, coachName: 'Deren', observations: o, practices, plan, personal: 'Loved his energy Saturday.' });
    expect(e.subject).toBe('Jonah: quick update and a few things for the yard');
    expect(e.body).toMatch(/Loved his energy Saturday\./);
    expect(e.body).toMatch(/What went well/);
    expect(e.body).toMatch(/What we are working on/);
    expect(e.body).toMatch(/Parent tip:/);
    expect(e.body).toMatch(/Coach Deren$/);
    expect(e.body).not.toMatch(/meltdown/);
  });
  it('sms and mailto links are well formed', () => {
    expect(smsLink('(555) 010-2222', 'hi there')).toBe('sms:5550102222?&body=hi%20there');
    expect(mailtoLink('dana@example.com', 'Sub', 'Body line')).toBe('mailto:dana@example.com?subject=Sub&body=Body%20line');
  });
});

describe('scorecard', () => {
  const team = [base(), base({ id: 'a', firstName: 'A', levels: { outfield: 2, hitting: 4 } }), base({ id: 'b', firstName: 'B', levels: { outfield: 5 } }), base({ id: 'c', firstName: 'Inactive', status: 'inactive', levels: { outfield: 1 } })];
  it('team bands use active players only and never list names', () => {
    const bands = teamBands(team.filter((p) => p.status === 'active'));
    const of = bands.find((b) => b.category === 'outfield')!;
    expect(of).toEqual({ category: 'outfield', assessed: 3, low: 2, mid: 3, high: 5 });
    const card = scorecardFor(base(), team, [obs({ read: 'hustle' }), obs({ read: 'got_it', category: 'outfield' })], [practice('2026-11-01', ['j'])], { teamName: 'Dirtbags' });
    const html = renderScorecardHtml(card);
    expect(html).toContain('Jonah Pike');
    expect(html).not.toContain('>A<');
    expect(html).not.toMatch(/Inactive/);
    expect(html).toContain('team 2 to 5, middle 3, 3 assessed');
    expect(html).toContain('Hustled: 1');
    expect(html).toContain('1 of 1 practices');
    expect(html).toMatch(/Nothing here is a ranking/);
  });
  it('home plan html renders the drills and the yard rules', () => {
    const plan = homePlanFor(base(), drills, [], []);
    const html = renderHomePlanHtml(base(), plan, { coachName: 'Deren', teamName: 'Dirtbags' });
    expect(html).toContain("Jonah's yard work");
    expect(html).toContain('Rules of the yard');
    for (const d of plan.drills) expect(html).toContain(d.drill.name);
  });
});

describe('who is due', () => {
  it('counts finished practices since the last update, skips opted-out families', () => {
    const players = [base(), base({ id: 'k', firstName: 'K', share: 'none' })];
    const practices = [practice('2026-10-20', ['j', 'k']), practice('2026-10-25', ['j', 'k']), practice('2026-10-30', ['j', 'k']), practice('2026-11-01', ['k'])];
    const due = dueForUpdate(players, practices, [], 3);
    expect(due.map((d) => d.player.id)).toEqual(['j']);
    expect(due[0].practicesSince).toBe(3);
    const after = dueForUpdate(players, practices, [{ playerId: 'j', ts: '2026-10-26T12:00:00Z' }], 3);
    expect(after).toEqual([]);
  });
});
