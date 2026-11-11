import { describe, it, expect } from 'vitest';
import { splitNarration, extractDetails, heardSoFar } from '../src/engine/narrate';
import { nowIso, type Player } from '../src/engine/types';

const ts = nowIso();
function p(id: string, firstName: string, lastName: string, number?: string, nicknames?: string[]): Player {
  return { id, teamId: 't', firstName, lastName, number, nicknames, positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, createdAt: ts, updatedAt: ts };
}
const roster = [p('a', 'Jonah', 'Pike', '2'), p('b', 'Sam', 'Ortiz', '7'), p('c', 'Theo', 'Brandt', '12'), p('d', 'Knox', 'Ward', '4'), p('h', 'Owen', 'Tate', '5'), p('i', 'Owen', 'Marsh', '15'), p('g', 'Kason', 'Reyes', '11', ['Kase'])];

describe('rapid-fire narration', () => {
  it('cuts one dictation into a rep per kid with fielding and throwing details and a read', () => {
    const reps = splitNarration('Jonah, clean backhand, quick transfer, strong throw on target. Sam bobbled the forehand and the throw was high. Theo charged it, clean, slow transfer, throw in the dirt.', roster, 'fielding');
    expect(reps.map((r) => r.playerId)).toEqual(['a', 'b', 'c']);
    expect(reps[0].tags).toEqual(['Fielded clean', 'Backhand', 'Quick transfer', 'Throw on target', 'Strong throw']);
    expect(reps[0].read).toBe('got_it');
    expect(reps[0].category).toBe('infield');
    expect(reps[1].tags).toEqual(['Bobbled', 'Forehand', 'Throw off target']);
    expect(reps[1].read).toBe('struggled');
    expect(reps[2].tags).toEqual(['Fielded clean', 'Charged it', 'Slow transfer', 'Throw off target']);
    expect(reps[2].read).toBe('working');
    expect(reps[2].text).toMatch(/^charged it/);
    expect(reps.every((r) => r.confidence >= 0.85)).toBe(true);
  });
  it('works with no punctuation at all, the way dictation often comes out, and keeps repeat reps separate', () => {
    const reps = splitNarration('Jonah clean forehand good throw Sam missed it Jonah backhand bobbled it throw sailed Kase clean quick release on the money', roster, 'fielding');
    expect(reps.map((r) => r.playerId)).toEqual(['a', 'b', 'a', 'g']);
    expect(reps[1].tags).toEqual(['Missed it']);
    expect(reps[2].tags).toEqual(['Bobbled', 'Backhand', 'Throw off target']);
    expect(reps[3].tags).toContain('Quick transfer');
    expect(heardSoFar(reps)).toEqual(['a', 'b', 'g']);
  });
  it('handles numbers, full names, shared first names and speech slips', () => {
    const reps = splitNarration('Number 7 clean. Owen Tate bobbled. Owen clean backhand. Jona froze on it. 3 out of 5 for the group', roster, 'fielding');
    expect(reps[0].playerId).toBe('b');
    expect(reps[1].playerId).toBe('h');
    expect(reps[1].confidence).toBe(1);
    expect(reps[2].confidence).toBeLessThan(0.85);
    expect(new Set([reps[2].playerId, ...reps[2].alternatives])).toEqual(new Set(['h', 'i']));
    expect(reps[3].playerId).toBe('a');
    expect(reps[3].confidence).toBeLessThan(0.85);
    expect(reps[3].read).toBe('hesitated');
    expect(reps.length).toBe(4); // the bare numbers at the end are not jerseys
  });
  it('does not split on ordinary words that resemble a name, and keeps words said before any name', () => {
    const reps = splitNarration('ok ground balls at short. Sam knocks it down, late throw. Knox clean', roster, 'fielding');
    expect(reps.map((r) => r.playerId)).toEqual([undefined, 'b', 'd']);
    expect(reps[0].text).toMatch(/ground balls at short/);
    expect(reps[1].text).toMatch(/knocks it down/);
  });
  it('hitting and pitching words, and a category hint from the station', () => {
    const h = splitNarration('Jonah on time barreled it. Sam late rolled over. Theo good take then chased', roster, 'hitting');
    expect(h[0].tags).toEqual(['On time', 'Hard contact']);
    expect(h[1].tags).toEqual(['Late', 'Weak contact']);
    expect(h[1].read).toBe('struggled');
    expect(h[2].read).toBe('working');
    expect(h[0].category).toBe('hitting');
    const pch = splitNarration('Jonah strike balanced. Sam missed high rushed', roster, 'pitching');
    expect(pch[0].tags).toEqual(['Strike', 'Balanced']);
    expect(pch[1].tags).toEqual(['Missed the zone', 'Rushed']);
    expect(splitNarration('Theo clean', roster, 'fielding', 'outfield')[0].category).toBe('outfield');
    expect(extractDetails('bobbled it but a clean throw on target', 'fielding').tags).toEqual(['Bobbled', 'Throw on target']);
  });
  it('general focus keeps behavior reads', () => {
    const reps = splitNarration('Jonah hustled on every rep. Sam hesitated on the cutoff', roster, 'general');
    expect(reps[0].read).toBe('hustle');
    expect(reps[1].read).toBe('hesitated');
    expect(reps[1].category).toBe('team_defense');
  });
});
