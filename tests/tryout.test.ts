import { describe, it, expect } from 'vitest';
import { DugoutLabDB, createTryout, addCandidate, updateCandidate, setScore, scoreId, deleteTryout, updateTryout, getSettings, saveSettings } from '../src/db/db';
import { wearingOn, parseCandidateList, buildBoard, sortBoard, currentSession, myProgress, coachCounts, renderBoardHtml, sortCandidates, fmt, DEFAULT_STATIONS, visibleStations } from '../src/engine/tryout';
import { LEAN_STATION, NOTE_STATION, nowIso, type Candidate, type Tryout, type TryoutScore } from '../src/engine/types';

let n = 0;
const fresh = () => new DugoutLabDB('tryout-' + Date.now() + '-' + n++);
const ts = nowIso();
const tryout = (): Tryout => ({ id: 't', name: 'Warriors tryouts', stations: [{ id: 'gb', label: 'Ground balls' }, { id: 'hit', label: 'Hitting' }, { id: 'pit', label: 'Pitching' }, { id: 'old', label: 'Retired', hidden: true }], sessions: [{ id: 's1', label: 'Night 1', date: '2026-11-23' }, { id: 's2', label: 'Night 2', date: '2026-11-30' }], createdAt: ts, updatedAt: ts });
const kid = (id: string, name: string, over: Partial<Candidate> = {}): Candidate => ({ id, tryoutId: 't', name, createdAt: ts, updatedAt: ts, ...over });
let seq = 0;
const mark = (candidateId: string, stationId: string, by: string, value: number | undefined, over: Partial<TryoutScore> = {}): TryoutScore => ({ id: `m${seq++}`, tryoutId: 't', candidateId, stationId, sessionId: 's1', by, value, createdAt: ts, updatedAt: `2026-11-23T00:00:${String(seq % 60).padStart(2, '0')}.000Z`, ...over });

describe('pasting a list of kids', () => {
  it('reads one kid per line with commas, and a leading number', () => {
    const got = parseCandidateList('Alex Rivers, RHP, OF, Storm 13u\n#12 Ben Cole, SS\n7. Cy Dunn\n\n  ');
    expect(got).toEqual([
      { name: 'Alex Rivers', number: undefined, positions: 'RHP', team: 'OF', note: 'Storm 13u' },
      { name: 'Ben Cole', number: '12', positions: 'SS', team: undefined, note: undefined },
      { name: 'Cy Dunn', number: '7', positions: undefined, team: undefined, note: undefined }
    ]);
  });
  it('reads rows copied from a sign-up sheet by their headings and drops birthdays, parents and phones', () => {
    const sheet = ['Name\tDOB\tGrade\tParent\tPhone\tTeam\t1st position\t2nd position', 'Alex Rivers\t4/9/2014\t7\tPat Rivers\t5550100\tStorm 13u\tRHP\tOF', 'Ben Cole\t3/26/2014\t7\tSam Cole\t555-0101\tHawks\t3\tP'].join('\n');
    const got = parseCandidateList(sheet);
    expect(got).toEqual([
      { name: 'Alex Rivers', number: undefined, positions: 'RHP, OF', team: 'Storm 13u', note: 'Grade 7' },
      { name: 'Ben Cole', number: undefined, positions: '3, P', team: 'Hawks', note: 'Grade 7' }
    ]);
    const all = JSON.stringify(got);
    for (const leak of ['2014', 'Pat', 'Sam Cole', '5550100', '555-0101']) expect(all).not.toContain(leak);
  });
  it('skips blank lines and the same name twice', () => {
    expect(parseCandidateList('Alex Rivers\nalex rivers\n')).toHaveLength(1);
    expect(parseCandidateList('   \n')).toEqual([]);
  });
});

describe('the board', () => {
  const kids = [kid('a', 'Alex', { number: '12' }), kid('b', 'Ben', { number: '7' }), kid('c', 'Cy'), kid('h', 'Hidden', { hidden: true })];
  it('averages the coaches, each counted once however many nights he scored', () => {
    const scores = [mark('a', 'gb', 'Deren', 4), mark('a', 'gb', 'Deren', 2, { sessionId: 's2' }), mark('a', 'gb', 'Aaron', 5)];
    const row = buildBoard(tryout(), kids, scores).find((r) => r.candidate.id === 'a')!;
    const gb = row.cells.find((c) => c.stationId === 'gb')!;
    // Deren's two nights average to 3; with Aaron's 5 the station is 4, not (4+2+5)/3
    expect(gb.byCoach).toEqual([{ by: 'Aaron', value: 5 }, { by: 'Deren', value: 3 }]);
    expect(gb.avg).toBe(4);
    expect(gb.split).toBe(true);
    expect(row.coaches).toEqual(['Aaron', 'Deren']);
  });
  it('leaves an unscored station out of the overall instead of counting a zero', () => {
    const row = buildBoard(tryout(), kids, [mark('b', 'gb', 'Deren', 4), mark('b', 'hit', 'Deren', 2)]).find((r) => r.candidate.id === 'b')!;
    expect(row.overall).toBe(3);
    expect(row.stationsScored).toBe(2);
    expect(row.cells.find((c) => c.stationId === 'pit')!.avg).toBeUndefined();
    expect(fmt(row.cells.find((c) => c.stationId === 'pit')!.avg)).toBe('–');
    expect(fmt(3.25)).toBe('3.3');
  });
  it('flags coaches 2 or more apart and not coaches 1 apart', () => {
    const rows = buildBoard(tryout(), kids, [mark('a', 'hit', 'Deren', 4), mark('a', 'hit', 'Aaron', 3), mark('b', 'hit', 'Deren', 5), mark('b', 'hit', 'Aaron', 3)]);
    expect(rows.find((r) => r.candidate.id === 'a')!.anySplit).toBe(false);
    expect(rows.find((r) => r.candidate.id === 'b')!.anySplit).toBe(true);
  });
  it('a cleared mark, a hidden station and a hidden kid are left out', () => {
    const rows = buildBoard(tryout(), kids, [mark('a', 'gb', 'Deren', undefined), mark('a', 'old', 'Deren', 5), mark('h', 'gb', 'Deren', 5)]);
    expect(rows.map((r) => r.candidate.id)).toEqual(['b', 'a', 'c']); // number order: 7, 12, none
    const a = rows.find((r) => r.candidate.id === 'a')!;
    expect(a.overall).toBeUndefined();
    expect(a.cells.map((c) => c.stationId)).toEqual(['gb', 'hit', 'pit']);
  });
  it('one night at a time, or both', () => {
    const scores = [mark('a', 'gb', 'Deren', 2), mark('a', 'gb', 'Deren', 4, { sessionId: 's2' })];
    expect(buildBoard(tryout(), kids, scores, { sessionId: 's1' })[1].overall).toBe(2);
    expect(buildBoard(tryout(), kids, scores, { sessionId: 's2' })[1].overall).toBe(4);
    expect(buildBoard(tryout(), kids, scores)[1].overall).toBe(3);
  });
  it('a coach leans once: his latest night, and his latest tap that night', () => {
    const scores = [
      mark('a', LEAN_STATION, 'Deren', 2), mark('a', LEAN_STATION, 'Deren', 3, { sessionId: 's2' }),
      mark('a', LEAN_STATION, 'Aaron', 1), mark('a', LEAN_STATION, 'Matt', 2)
    ];
    const a = buildBoard(tryout(), kids, scores).find((r) => r.candidate.id === 'a')!;
    expect(a.leans).toEqual({ yes: ['Deren'], maybe: ['Matt'], no: ['Aaron'] });
    // the lean is not a station and does not move the overall
    expect(a.overall).toBeUndefined();
    expect(buildBoard(tryout(), kids, scores, { sessionId: 's1' }).find((r) => r.candidate.id === 'a')!.leans.maybe).toEqual(['Deren', 'Matt']);
  });
  it('carries notes with who wrote them and where', () => {
    const scores = [mark('a', 'gb', 'Deren', 4, { note: 'soft hands' }), mark('a', NOTE_STATION, 'Aaron', undefined, { note: 'great kid', sessionId: 's2' })];
    const a = buildBoard(tryout(), kids, scores).find((r) => r.candidate.id === 'a')!;
    expect(a.notes).toEqual([{ by: 'Deren', sessionId: 's1', stationId: 'gb', text: 'soft hands' }, { by: 'Aaron', sessionId: 's2', stationId: NOTE_STATION, text: 'great kid' }]);
    expect(a.coaches).toEqual(['Aaron', 'Deren']);
  });
  it('sorts by overall or a station with the unscored last, and by name', () => {
    const scores = [mark('a', 'gb', 'Deren', 2), mark('a', 'hit', 'Deren', 5), mark('b', 'gb', 'Deren', 4)];
    const rows = buildBoard(tryout(), kids, scores);
    expect(sortBoard(rows, 'overall').map((r) => r.candidate.id)).toEqual(['b', 'a', 'c']);
    expect(sortBoard(rows, 'hit').map((r) => r.candidate.id)).toEqual(['a', 'b', 'c']);
    expect(sortBoard(rows, 'name').map((r) => r.candidate.name)).toEqual(['Alex', 'Ben', 'Cy']);
    expect(sortBoard(rows, 'number').map((r) => r.candidate.id)).toEqual(['b', 'a', 'c']);
  });
  it('the printed board says coaches only and shows each coach where they differ', () => {
    const scores = [mark('a', 'gb', 'Deren', 5), mark('a', 'gb', 'Aaron', 2, { note: 'slow <feet>' }), mark('a', LEAN_STATION, 'Deren', 3)];
    const rows = buildBoard(tryout(), [kid('a', 'Alex', { number: '12', positions: 'SS', team: 'Storm', decision: 'waitlist', decisionNote: 'see night 2' })], scores);
    const html = renderBoardHtml(tryout(), rows, { sessionLabel: 'Both nights', coaches: ['Aaron', 'Deren'], asOf: 'Nov 23' });
    expect(html).toContain('For coaches only');
    expect(html).toContain('#12 Alex');
    expect(html).toContain('class="split">3.5');
    expect(html).toContain('Aaron 2.0, Deren 5.0');
    expect(html).toContain('1 / 0 / 0');
    expect(html).toContain('Waitlist');
    expect(html).toContain('slow &lt;feet&gt;');
    expect(html).not.toContain('Retired');
  });
});

describe('helpers', () => {
  it('picks tonight, else the latest night already here, else the first', () => {
    expect(currentSession(tryout(), '2026-11-23')).toBe('s1');
    expect(currentSession(tryout(), '2026-11-30')).toBe('s2');
    expect(currentSession(tryout(), '2026-11-26')).toBe('s1');
    expect(currentSession(tryout(), '2026-11-01')).toBe('s1');
    expect(currentSession(tryout(), '2026-12-25')).toBe('s2');
  });
  it('counts what one coach has marked for a kid tonight', () => {
    const scores = [mark('a', 'gb', 'Deren', 4), mark('a', 'hit', 'Deren', undefined), mark('a', 'pit', 'Aaron', 3), mark('a', 'old', 'Deren', 3), mark('a', 'gb', 'Deren', 2, { sessionId: 's2' })];
    expect(myProgress(tryout(), 'a', 's1', 'Deren', scores)).toEqual({ done: 1, of: 3 });
    expect(coachCounts(tryout(), scores)).toEqual([{ by: 'Aaron', marks: 1 }, { by: 'Deren', marks: 3 }]);
  });
  it('sorts kids by number as a number, then name', () => {
    expect(sortCandidates([kid('1', 'Zed', { number: '12' }), kid('2', 'Amy'), kid('3', 'Bo', { number: '7' }), kid('4', 'Al')]).map((c) => c.name)).toEqual(['Bo', 'Zed', 'Al', 'Amy']);
  });
  it('what a kid is wearing is kept per night; with no night asked, the latest night written down', () => {
    const c = kid('a', 'Alex', { wearing: { s1: 'bright green shirt' } });
    expect(wearingOn(c, tryout(), 's1')).toBe('bright green shirt');
    expect(wearingOn(c, tryout(), 's2')).toBeUndefined();
    expect(wearingOn(c, tryout())).toBe('bright green shirt');
    expect(wearingOn(kid('b', 'Ben', { wearing: { s1: 'red hat', s2: 'gray hoodie' } }), tryout())).toBe('gray hoodie');
    expect(wearingOn(kid('c', 'Cy'), tryout())).toBeUndefined();
    const html = renderBoardHtml(tryout(), buildBoard(tryout(), [c], []), { sessionLabel: 'Night 1', coaches: [], asOf: 'Nov 23', sessionId: 's1' });
    expect(html).toContain('Wearing: bright green shirt');
    expect(renderBoardHtml(tryout(), buildBoard(tryout(), [c], []), { sessionLabel: 'Night 2', coaches: [], asOf: 'Nov 30', sessionId: 's2' })).not.toContain('Wearing');
  });
  it('the starting stations cover the plan and can be hidden', () => {
    expect(DEFAULT_STATIONS).toEqual(['Catch play', 'Ground balls', 'Fly balls', 'Pitching', 'Catching', 'Hitting', 'Speed and athleticism', 'Coachability and effort']);
    expect(visibleStations(tryout()).map((s) => s.id)).toEqual(['gb', 'hit', 'pit']);
  });
});

describe('storage', () => {
  it('marking the same thing twice updates one record; clearing keeps the note', async () => {
    const d = fresh();
    const t = await createTryout({ name: 'Warriors tryouts', stations: DEFAULT_STATIONS.map((label) => ({ label })), sessions: [{ label: 'Night 1', date: '2026-11-23' }] }, d);
    const c = await addCandidate(t.id, { name: ' Alex Rivers ', number: '12', positions: ' ', team: 'Storm', wearing: { [t.sessions[0].id]: ' bright green shirt ', other: '  ' } }, d);
    expect(c).toMatchObject({ name: 'Alex Rivers', number: '12', team: 'Storm', wearing: { [t.sessions[0].id]: 'bright green shirt' } });
    expect(c.positions).toBeUndefined();
    const key = { tryoutId: t.id, candidateId: c.id, stationId: t.stations[0].id, sessionId: t.sessions[0].id, by: 'Deren' };
    await setScore({ ...key, value: 3 }, d);
    await setScore({ ...key, note: 'quick release' }, d);
    await setScore({ ...key, value: 5 }, d);
    expect(await d.tryoutScores.count()).toBe(1);
    expect(await d.tryoutScores.get(scoreId(t.id, c.id, t.stations[0].id, t.sessions[0].id, 'deren '))).toMatchObject({ value: 5, note: 'quick release', by: 'Deren' });
    await setScore({ ...key, value: null }, d);
    const cleared = (await d.tryoutScores.toArray())[0];
    expect(cleared.value).toBeUndefined();
    expect(cleared.note).toBe('quick release');
    await setScore({ ...key, by: 'Aaron', value: 2 }, d);
    expect(await d.tryoutScores.count()).toBe(2);
  });
  it('editing keeps what was not touched, and deleting a tryout removes everything in it and leaves tombstones', async () => {
    const d = fresh();
    const t = await createTryout({ name: 'A', stations: [{ label: 'Hitting' }], sessions: [{ label: 'Night 1', date: '2026-11-23' }] }, d);
    const other = await createTryout({ name: 'B', stations: [{ label: 'Hitting' }], sessions: [{ label: 'Night 1', date: '2026-11-23' }] }, d);
    const c = await addCandidate(t.id, { name: 'Alex' }, d);
    const keep = await addCandidate(other.id, { name: 'Ben' }, d);
    await updateCandidate(c.id, { decision: 'offer' }, d);
    await updateTryout(t.id, { stations: [...t.stations, { id: 'x', label: 'Bunting' }] }, d);
    expect((await d.candidates.get(c.id))!.name).toBe('Alex');
    expect((await d.tryouts.get(t.id))!.stations.map((s) => s.label)).toEqual(['Hitting', 'Bunting']);
    await setScore({ tryoutId: t.id, candidateId: c.id, stationId: t.stations[0].id, sessionId: t.sessions[0].id, by: 'Deren', value: 4 }, d);
    await deleteTryout(t.id, d);
    expect([await d.tryouts.count(), await d.candidates.count(), await d.tryoutScores.count()]).toEqual([1, 1, 0]);
    expect((await d.candidates.toArray())[0].id).toBe(keep.id);
    expect((await d.tombstones.toArray()).map((x) => x.tbl).sort()).toEqual(['candidates', 'tryoutScores', 'tryouts']);
    void getSettings; void saveSettings;
  });
});
