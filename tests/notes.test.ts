import { describe, it, expect } from 'vitest';
import { parseNote, matchPlayers, editDistance, soundKey } from '../src/engine/notes';
import { nowIso, type Player } from '../src/engine/types';

const ts = nowIso();
function p(id: string, firstName: string, lastName: string, number?: string, nicknames?: string[]): Player {
  return { id, teamId: 't', firstName, lastName, number, nicknames, positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, createdAt: ts, updatedAt: ts };
}
const roster = [p('a', 'Jonah', 'Pike', '2'), p('b', 'Sam', 'Ortiz', '7'), p('c', 'Theo', 'Brandt', '12'), p('d', 'Ellis', 'Ward', '4'), p('e', 'Nico', 'Bell', '9'), p('f', 'Cash', 'Dunn', '21'), p('g', 'Kason', 'Reyes', '11', ['K', 'Kase']), p('h', 'Owen', 'Tate', '5'), p('i', 'Owen', 'Marsh', '15')];

describe('freestyle note parsing', () => {
  it('finds the kid, the read and the area from a spoken sentence', () => {
    const n = parseNote('Jonah hesitated on the cutoff with a runner going first to third', roster);
    expect(n.player?.playerId).toBe('a');
    expect(n.player?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(n.read).toBe('hesitated');
    expect(n.category).toBe('team_defense');
  });
  it('handles possessives, last names and numbers', () => {
    expect(parseNote("Sam's backhand was clean today", roster).player?.playerId).toBe('b');
    expect(parseNote('Brandt struggled on fly balls', roster).player?.playerId).toBe('c');
    expect(parseNote('number 21 hustled all practice', roster).player?.playerId).toBe('f');
    expect(parseNote('#9 got it', roster).player?.playerId).toBe('e');
    expect(parseNote("Sam's backhand was clean today", roster).read).toBe('got_it');
    expect(parseNote("Sam's backhand was clean today", roster).category).toBe('infield');
  });
  it('uses nicknames the coach gave', () => {
    expect(parseNote('Kase took the cue on his load', roster).player?.playerId).toBe('g');
    expect(parseNote('Kase took the cue on his load', roster).read).toBe('coachable');
  });
  it('forgives speech-to-text slips and asks when two kids share a name', () => {
    const slip = parseNote('Jona froze on the relay', roster);
    expect(slip.player?.playerId).toBe('a');
    expect(slip.player?.confidence).toBeLessThan(0.85);
    expect(slip.read).toBe('hesitated');
    const shared = parseNote('Owen bobbled two grounders', roster);
    expect(shared.player?.confidence).toBeLessThan(0.85);
    expect(new Set([shared.player?.playerId, ...shared.alternatives.map((g) => g.playerId)])).toEqual(new Set(['h', 'i']));
    expect(parseNote('Owen Tate bobbled two grounders', roster).player?.confidence).toBe(1);
    expect(parseNote('Owen Tate bobbled two grounders', roster).player?.playerId).toBe('h');
  });
  it('returns no guess for text with no name, and a plain note read for neutral text', () => {
    const n = parseNote('good energy today from the whole group', roster);
    expect(n.player).toBeUndefined();
    expect(n.read).toBe('note');
  });
  it('does not match short common words to names', () => {
    expect(matchPlayers('the cut was late', roster).find((g) => g.confidence >= 0.7)).toBeUndefined();
  });
  it('helpers behave', () => {
    expect(editDistance('jonah', 'jona')).toBe(1);
    expect(soundKey('Kason')).toBe(soundKey('Cason'));
  });
});
