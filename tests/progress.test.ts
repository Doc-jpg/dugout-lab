import { describe, it, expect } from 'vitest';
import { SKILLS, repOutcome, tally, trendOf, sessionDates, progressFor, progressTextDraft, progressEmailDraft, renderProgressHtml, stretchWords, shortDate, MIN_REPS_FOR_TREND } from '../src/engine/progress';
import { DETAILS, extractDetails } from '../src/engine/narrate';
import { logLevelChange, nowIso, type Observation, type Player, type Practice, type ThrowingEntry } from '../src/engine/types';
import { mergePlayer } from '../src/io/backup';

const ts = nowIso();
/** Noon local time on a day, so the local date is the day whatever the test machine's timezone. */
const at = (day: string, n = 0) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, n).toISOString(); };
const base = (over: Partial<Player> = {}): Player => ({ id: 'e', teamId: 't', firstName: 'Ellis', lastName: 'Grant', number: '4', positions: ['2B'], status: 'active', strengths: [], challenges: ['Backhand footwork'], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, parents: [{ name: 'Morgan Grant', phone: '(555) 010-4444' }], responseNotes: 'PRIVATE-RESPONSE', confidenceNotes: 'PRIVATE-CONFIDENCE', createdAt: at('2026-09-01'), updatedAt: ts, ...over });
let seq = 0;
const rep = (day: string, tags: string[], over: Partial<Observation> = {}): Observation => ({ id: `o${seq++}`, playerId: 'e', read: 'working', category: 'infield', source: 'practice', tags, ts: at(day, seq % 50), ...over });
const reps = (day: string, tags: string[], n: number, over: Partial<Observation> = {}) => Array.from({ length: n }, () => rep(day, tags, over));
const practice = (date: string, present: string[]): Practice => ({ id: date, teamId: 't', date, status: 'done', inputs: { teamId: 't', presentIds: present, absentIds: [], durationMin: 60, coaches: 1, equipment: [], space: 'full', indoor: false, teamPriorities: [], playerPriorities: {}, noThrowingIds: [] }, blocks: [], rationale: [], createdAt: ts, updatedAt: ts });
const skill = (id: string) => SKILLS.find((s) => s.id === id)!;

describe('skills line up with the narration word lists', () => {
  it('every detail a skill counts is a detail narration can produce', () => {
    const known = new Set(DETAILS.map((d) => d.tag));
    for (const s of SKILLS) for (const t of [...s.good, ...s.bad, ...(s.requires ? [s.requires] : [])]) expect(known.has(t), `${s.id} uses "${t}"`).toBe(true);
  });
  it('every good or bad detail in narration is counted by some skill', () => {
    const counted = new Set(SKILLS.flatMap((s) => [...s.good, ...s.bad]));
    const uncounted = DETAILS.filter((d) => d.tone !== 0 && !counted.has(d.tag)).map((d) => d.tag);
    // "Strong throw" is praise with no opposite to count against; it is the only one left out on purpose.
    expect(uncounted).toEqual(['Strong throw']);
  });
  it('a spoken rep lands in the right rows', () => {
    const { tags } = extractDetails('clean backhand, quick transfer, throw was high', 'fielding');
    expect(repOutcome(tags, skill('field_clean'))).toBe('good');
    expect(repOutcome(tags, skill('backhand'))).toBe('good');
    expect(repOutcome(tags, skill('forehand'))).toBeUndefined();
    expect(repOutcome(tags, skill('transfer'))).toBe('good');
    expect(repOutcome(tags, skill('throw_target'))).toBe('bad');
    expect(repOutcome(tags, skill('timing'))).toBeUndefined();
  });
  it('a rep that says both sides of a skill is not counted either way', () => {
    expect(repOutcome(['On time', 'Late'], skill('timing'))).toBeUndefined();
    expect(repOutcome([], skill('timing'))).toBeUndefined();
    expect(repOutcome(undefined, skill('timing'))).toBeUndefined();
  });
  it('tally counts good of total and skips reps about something else', () => {
    const o = [rep('2026-11-01', ['Fielded clean', 'Backhand']), rep('2026-11-01', ['Bobbled', 'Backhand']), rep('2026-11-01', ['Fielded clean', 'Forehand']), rep('2026-11-01', ['On time'])];
    expect(tally(o, skill('field_clean'))).toEqual({ good: 2, total: 3 });
    expect(tally(o, skill('backhand'))).toEqual({ good: 1, total: 2 });
  });
});

describe('a change is only named when it beats chance', () => {
  it('needs enough reps on both sides', () => {
    expect(trendOf({ good: 5, total: 5 }, { good: 0, total: 5 })).toBe('not_enough');
    expect(trendOf({ good: 8, total: 8 }, { good: 0, total: 7 })).toBe('not_enough');
    expect(trendOf({ good: 3, total: 3 }, { good: 0, total: 0 })).toBe('none');
    expect(MIN_REPS_FOR_TREND).toBe(8);
  });
  it('calls a big gap and leaves a small one alone', () => {
    expect(trendOf({ good: 7, total: 8 }, { good: 3, total: 8 })).toBe('up');
    expect(trendOf({ good: 3, total: 8 }, { good: 7, total: 8 })).toBe('down');
    expect(trendOf({ good: 5, total: 8 }, { good: 4, total: 8 })).toBe('same');
    expect(trendOf({ good: 14, total: 20 }, { good: 10, total: 20 })).toBe('same');
    expect(trendOf({ good: 16, total: 20 }, { good: 8, total: 20 })).toBe('up');
  });
  it('all good against all good is the same, not a crash', () => {
    expect(trendOf({ good: 8, total: 8 }, { good: 9, total: 9 })).toBe('same');
    expect(trendOf({ good: 0, total: 8 }, { good: 0, total: 9 })).toBe('same');
  });
});

describe('sessions and stretches', () => {
  const practices = [practice('2026-10-01', ['e']), practice('2026-10-08', ['e', 'x']), practice('2026-10-15', ['x'])];
  const o = [rep('2026-10-08', ['Fielded clean']), rep('2026-10-20', ['Fielded clean'], { source: 'game' }), rep('2026-10-20', ['Bobbled'], { playerId: 'x' })];
  it('a session is a practice he was at or a day with a note about him', () => {
    expect(sessionDates('e', o, practices)).toEqual(['2026-10-01', '2026-10-08', '2026-10-20']);
    // the practice he missed and the other kid's note do not count for him
    expect(sessionDates('x', o, practices)).toEqual(['2026-10-08', '2026-10-15', '2026-10-20']);
  });
  it('last practice, last five and everything pick the right days', () => {
    const days = ['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-13', '2026-10-17', '2026-10-21', '2026-10-25'];
    const all = days.flatMap((d, i) => reps(d, [i < 2 ? 'Bobbled' : 'Fielded clean'], 2));
    const last = progressFor(base(), all, [], [], { period: 'last' });
    expect([last.sessions, last.from, last.to, last.hasBefore]).toEqual([1, '2026-10-25', '2026-10-25', true]);
    expect(last.skills[0].recent).toEqual({ good: 2, total: 2 });
    expect(last.skills[0].before).toEqual({ good: 8, total: 12 });
    const five = progressFor(base(), all, [], [], { period: 'five' });
    expect([five.sessions, five.from, five.sessionsOnRecord]).toEqual([5, '2026-10-09', 7]);
    expect(five.skills[0].recent).toEqual({ good: 10, total: 10 });
    expect(five.skills[0].before).toEqual({ good: 0, total: 4 });
    const everything = progressFor(base(), all, [], [], { period: 'all' });
    expect([everything.sessions, everything.hasBefore]).toEqual([7, false]);
    expect(everything.skills[0].recent).toEqual({ good: 10, total: 14 });
    expect(everything.skills[0].trend).toBe('none');
  });
  it('says how many sessions there really are when fewer than asked for', () => {
    const r = progressFor(base(), reps('2026-11-03', ['Fielded clean'], 2).concat(reps('2026-11-10', ['Fielded clean'], 2)), [], [], { period: 'five' });
    expect(stretchWords(r)).toBe('his last 2 sessions, Nov 3 to Nov 10');
    expect(stretchWords(progressFor(base(), [], [], [], {}))).toBe('nothing recorded yet');
    expect(shortDate('2026-01-05')).toBe('Jan 5');
  });
});

describe('the report', () => {
  const days = ['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-13', '2026-10-17', '2026-10-21', '2026-10-25', '2026-10-29'];
  // Backhand: 2 of 9 clean over the first three days, 12 of 15 over the last five.
  const o: Observation[] = [
    ...reps(days[0], ['Bobbled', 'Backhand'], 3), ...reps(days[1], ['Bobbled', 'Backhand'], 2), ...reps(days[1], ['Fielded clean', 'Backhand'], 1), ...reps(days[2], ['Bobbled', 'Backhand'], 2), ...reps(days[2], ['Fielded clean', 'Backhand'], 1),
    ...days.slice(3).flatMap((d, i) => [...reps(d, ['Fielded clean', 'Backhand', 'Throw on target'], i === 0 ? 2 : 3 - (i % 2)), ...reps(d, ['Bobbled', 'Backhand', 'Throw off target'], i < 3 ? 1 : 0)]),
    rep(days[7], [], { read: 'hustle', tags: undefined, category: undefined }),
    rep(days[7], [], { read: 'struggled', tags: undefined, category: 'hitting', text: 'RAW-NOTE-TEXT he threw his bat' }),
    rep(days[7], ['Bobbled'], { playerId: 'x', text: 'OTHER-KID' })
  ];
  const practices = [...days.map((d) => practice(d, ['e'])), practice('2026-10-27', ['x'])];
  const throwing: ThrowingEntry[] = [{ id: 't1', playerId: 'e', date: '2026-10-25', pitches: 31, kind: 'bullpen', source: 'manual', createdAt: ts }, { id: 't2', playerId: 'e', date: '2026-09-01', pitches: 50, kind: 'game', source: 'manual', createdAt: ts }, { id: 't3', playerId: 'x', date: '2026-10-25', pitches: 70, kind: 'game', source: 'manual', createdAt: ts }];
  const player = base({ levels: { infield: 3, throwing: 2 }, levelLog: [{ category: 'infield', level: 2, ts: at('2026-09-15') }, { category: 'infield', level: 3, ts: at('2026-10-20') }], goals: [{ id: 'g1', category: 'infield', kind: 'technical', text: 'Backhand: right foot plants, glove out front', status: 'active', createdAt: ts }, { id: 'g2', category: 'throwing', kind: 'technical', text: 'Long arm on every throw', status: 'done', createdAt: ts, doneAt: at('2026-10-22') }, { id: 'g3', category: 'hitting', kind: 'technical', text: 'Old goal', status: 'done', createdAt: ts, doneAt: at('2026-09-02') }] });
  const r = progressFor(player, o, practices, throwing, { period: 'five', now: new Date(2026, 10, 1, 12) });

  it('counts the stretch and the stretch before it, and names the change', () => {
    const bh = r.skills.find((s) => s.skill.id === 'backhand')!;
    expect(bh.recent).toEqual({ good: 12, total: 15 });
    expect(bh.before).toEqual({ good: 2, total: 9 });
    expect(bh.trend).toBe('up');
    const th = r.skills.find((s) => s.skill.id === 'throw_target')!;
    expect(th.recent).toEqual({ good: 12, total: 15 });
    expect(th.before.total).toBe(0);
    expect(th.trend).toBe('none');
    // what moved up comes first
    expect(r.skills[0].trend).toBe('up');
  });
  it('carries levels then and now, goals inside the stretch, attendance and his own pitches only', () => {
    expect(r.levels).toEqual([{ category: 'throwing', level: 2, status: undefined }, { category: 'infield', level: 3, status: undefined, was: 2, wasWhen: '2026-09-15', changedWhen: '2026-10-20' }]);
    expect(r.goalsDone).toEqual(['Long arm on every throw']);
    expect(r.goalsActive).toEqual(['Backhand: right foot plants, glove out front']);
    expect(r.attendance).toEqual({ present: 5, total: 6 });
    expect(r.throwing).toEqual([{ date: '2026-10-25', kind: 'bullpen', pitches: 31 }]);
    expect(r.effort.hustle).toBe(1);
    expect(r.areas.find((a) => a.category === 'hitting')).toMatchObject({ good: 0, rough: 1 });
    // narrated reps are in the counts, so they are not counted again as quick reads
    expect(r.areas.find((a) => a.category === 'infield')).toBeUndefined();
    expect(r.thin).toBe(false);
  });
  it('the page shows his numbers and nothing private, raw or about anyone else', () => {
    const html = renderProgressHtml(r, { coachName: 'Deren' });
    expect(html).toContain("Ellis's progress");
    expect(html).toContain('12 of 15 clean');
    expect(html).toContain('2 of 9');
    expect(html).toContain('>Up<');
    expect(html).toContain('was 2 Building on Sep 15');
    expect(html).toContain('Oct 25, bullpen: 31 pitches');
    expect(html).toContain('last 5 sessions, Oct 13 to Oct 29');
    expect(html).toMatch(/Nothing here is a ranking/);
    for (const leak of ['PRIVATE-RESPONSE', 'PRIVATE-CONFIDENCE', 'RAW-NOTE-TEXT', 'OTHER-KID', 'Morgan', '555', 'Backhand footwork', 'team band', '70 pitches']) expect(html, leak).not.toContain(leak);
  });
  it('the drafts lead with wins and stay honest about the sample', () => {
    const text = progressTextDraft({ report: r, coachName: 'Deren' });
    expect(text.split('\n')[0]).toBe('Hi Morgan, Coach Deren here with where Ellis is, from his last 5 sessions, Oct 13 to Oct 29.');
    expect(text).toContain('backhand side 12 of 15 clean (up from 2 of 9)');
    expect(text).toContain('Moved up: infield defense to 3 steady.');
    // a level raised before this stretch began is not announced again
    const old = progressFor({ ...player, levelLog: [{ category: 'infield', level: 2, ts: at('2026-09-15') }, { category: 'infield', level: 3, ts: at('2026-10-02') }] }, o, practices, throwing, { period: 'five', now: new Date(2026, 10, 1, 12) });
    expect(progressTextDraft({ report: old })).not.toContain('Moved up');
    expect(renderProgressHtml(old)).toContain('was 2 Building on Sep 15');
    expect(text).toContain('Goal reached: Long arm on every throw.');
    expect(text).toContain('not every rep he took');
    const email = progressEmailDraft({ report: r, coachName: 'Deren', personal: 'Great week.' });
    expect(email.subject).toBe('Ellis: how things are going');
    expect(email.body).toContain('- Backhand side: 12 of 15 clean; before that 2 of 9. Up.');
    expect(email.body).toContain('- Infield defense: 3 Steady (was 2 Building on Sep 15)');
    expect(email.body).toContain('Great week.');
    for (const leak of ['PRIVATE-RESPONSE', 'RAW-NOTE-TEXT', 'OTHER-KID']) { expect(text).not.toContain(leak); expect(email.body).not.toContain(leak); }
  });
  it('with almost nothing written down it says so instead of drawing conclusions', () => {
    const thin = progressFor(base(), reps('2026-11-03', ['Fielded clean', 'Backhand'], 2), [], [], { period: 'five' });
    expect(thin.thin).toBe(true);
    expect(thin.skills.every((s) => s.trend === 'none')).toBe(true);
    const html = renderProgressHtml(thin);
    expect(html).toContain('Not much written down yet');
    expect(html).toContain('2 of 2 clean');
    expect(html).not.toContain('>Up<');
    expect(progressTextDraft({ report: thin })).toContain('take the counts as a first look');
    const empty = renderProgressHtml(progressFor(base(), [], [], [], {}));
    expect(empty).toContain('No reps have been counted for Ellis');
  });
  it('a small gap with plenty of reps reads about the same, and too few reps says so', () => {
    const steady = progressFor(base(), [...reps('2026-10-01', ['Fielded clean'], 5), ...reps('2026-10-01', ['Bobbled'], 5), ...reps('2026-10-08', ['Fielded clean'], 6), ...reps('2026-10-08', ['Bobbled'], 4)], [], [], { period: 'last' });
    expect(steady.skills[0].trend).toBe('same');
    expect(renderProgressHtml(steady)).toContain('About the same');
    const few = progressFor(base(), [...reps('2026-10-01', ['Bobbled'], 9), ...reps('2026-10-08', ['Fielded clean'], 4)], [], [], { period: 'last' });
    expect(few.skills[0].trend).toBe('not_enough');
    expect(renderProgressHtml(few)).toContain('Too few reps to say');
  });
});

describe('one row, not two, when they say the same thing', () => {
  it('a drill of all backhands shows the backhand row and drops the general one', () => {
    const r = progressFor(base(), [...reps('2026-10-01', ['Fielded clean', 'Backhand'], 2), ...reps('2026-10-01', ['Bobbled', 'Backhand'], 1)], [], [], { period: 'all' });
    expect(r.skills.map((s) => s.skill.id)).toEqual(['backhand']);
  });
  it('both sides recorded keeps the general row and each side', () => {
    const r = progressFor(base(), [...reps('2026-10-01', ['Fielded clean', 'Backhand'], 2), ...reps('2026-10-01', ['Fielded clean', 'Forehand'], 1), ...reps('2026-10-01', ['Bobbled'], 1)], [], [], { period: 'all' });
    expect(r.skills.map((s) => s.skill.id).sort()).toEqual(['backhand', 'field_clean', 'forehand']);
  });
});

describe('level history', () => {
  it('logs each change, keeps a level that was there before the log, and ignores no change', () => {
    const p = base({ levels: { infield: 2 } });
    expect(logLevelChange(p, 'infield', 2)).toEqual([]);
    const log = logLevelChange(p, 'infield', 3, at('2026-11-02'));
    expect(log).toEqual([{ category: 'infield', level: 2, ts: p.createdAt, approx: true }, { category: 'infield', level: 3, ts: at('2026-11-02') }]);
    const first = logLevelChange(base(), 'hitting', 1, at('2026-11-02'));
    expect(first).toEqual([{ category: 'hitting', level: 1, ts: at('2026-11-02') }]);
    // a level from before the log has no date to show
    const r = progressFor({ ...p, levels: { infield: 3 }, levelLog: log }, [], [], [], {});
    expect(r.levels).toEqual([{ category: 'infield', level: 3, status: undefined, was: 2, changedWhen: '2026-11-02' }]);
    expect(renderProgressHtml(r)).toContain('was 2 Building<');
  });
  it('two coaches setting levels on two phones keep both entries', () => {
    const a = base({ levels: { infield: 3 }, levelLog: [{ category: 'infield', level: 3, ts: at('2026-11-02') }], updatedAt: at('2026-11-02') });
    const b = base({ levels: { hitting: 2 }, levelLog: [{ category: 'hitting', level: 2, ts: at('2026-11-03') }], updatedAt: at('2026-11-03') });
    const merged = mergePlayer(a, b);
    expect(merged.levelLog).toHaveLength(2);
    expect(merged.levels).toEqual({ infield: 3, hitting: 2 });
  });
});
