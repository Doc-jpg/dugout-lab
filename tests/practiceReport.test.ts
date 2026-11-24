import { describe, it, expect } from 'vitest';
import { practiceReportFor, practiceNotes, practiceReportMessage, practiceReportFileName, renderPracticeReportHtml, longDate, type PracticeReport } from '../src/engine/practiceReport';
import { buildPracticeReportPdf } from '../src/io/practiceReportPdf';
import type { HomePlan } from '../src/engine/home';
import { nowIso, type Drill, type Observation, type Player, type Practice, type Team } from '../src/engine/types';

const ts = nowIso();
/** Noon local time on a day, so the local date is the day whatever the test machine's timezone. */
const at = (day: string, n = 0) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, n).toISOString(); };
const latin1 = (b: Uint8Array) => { let out = ''; for (let i = 0; i < b.length; i += 8192) out += String.fromCharCode(...b.subarray(i, i + 8192)); return out; };
const kid = (over: Partial<Player> = {}): Player => ({ id: 'e', teamId: 't', firstName: 'Ellis', lastName: 'Grant', number: '4', positions: ['2B'], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, createdAt: ts, updatedAt: ts, ...over } as Player);
let seq = 0;
const note = (day: string, over: Partial<Observation> = {}): Observation => ({ id: `o${seq++}`, playerId: 'e', read: 'note', source: 'practice', ts: at(day, seq % 50), ...over });
const reps = (day: string, tags: string[], n: number, over: Partial<Observation> = {}) => Array.from({ length: n }, () => note(day, { read: 'working', category: 'infield', tags, ...over }));
const drill = (id: string, name: string, category: Drill['category']): Drill => ({ id, name, category } as Drill);
const practice = (id: string, date: string, stations: Array<[string, string?]> = []): Practice => ({
  id, teamId: 't', date, status: 'done', title: 'Infield and hitting', rationale: [], createdAt: ts, updatedAt: ts,
  inputs: { teamId: 't', presentIds: ['e', 'x'], absentIds: [] } as any,
  blocks: stations.length ? [{ id: 'b', kind: 'fundamentals', title: 'Fundamentals', startMin: 0, minutes: 30, rotationMin: 10, wholeTeam: false, groups: [], stations: stations.map(([drillId, nameOverride], i) => ({ id: `s${i}`, drillId, nameOverride, objectives: [] })) } as any] : []
});
const team: Team = { id: 't', name: 'Warriors 13U', ageGroup: '13U', createdAt: ts, updatedAt: ts } as Team;
const plan = (over: Partial<HomePlan> = {}): HomePlan => ({
  playerId: 'e', focus: [{ category: 'infield', text: 'Backhand: right foot plants, glove out front' }], minutesPerSession: 10, sessionsPerWeek: 3, basis: [],
  drills: [{ drill: drill('d1', 'Wall ball short hops', 'infield'), why: '', objective: 'Field 20 out in front', reps: '2 sets of 10', cues: ['Glove out front'], parentTip: '', category: 'infield' }],
  ...over
});
const drills = [drill('d1', 'Wall ball short hops', 'infield'), drill('d2', 'Front toss', 'hitting'), drill('d3', 'Backhand footwork', 'infield')];
const D = '2026-12-03';

describe('which notes belong to a practice', () => {
  it('takes notes tied to the practice, and same-day practice notes with no practice named; never a game note or another kid', () => {
    const p = practice('p1', D);
    const obs = [
      note(D, { id: 'tied', practiceId: 'p1', text: 'a' }),
      note(D, { id: 'loose', text: 'b' }),
      note(D, { id: 'game', source: 'game', text: 'c' }),
      note('2026-12-01', { id: 'old', text: 'd' }),
      note(D, { id: 'other-practice', practiceId: 'p0', text: 'e' }),
      note(D, { id: 'other-kid', practiceId: 'p1', playerId: 'x', text: 'f' })
    ];
    expect(practiceNotes(kid(), p, obs).map((o) => o.id).sort()).toEqual(['loose', 'tied']);
  });
});

describe('what goes home', () => {
  const p = practice('p1', D, [['d3'], ['d1'], ['d2', 'Front toss, middle and away']]);
  const obs: Observation[] = [
    note(D, { id: 'win', practiceId: 'p1', read: 'got_it', category: 'infield', text: 'got his feet around the backhand', by: 'Aaron' }),
    note(D, { id: 'win-bare', practiceId: 'p1', read: 'confident', category: 'hitting', by: 'Deren' }),
    note(D, { id: 'plain', practiceId: 'p1', read: 'note', text: 'Asked to stay after for extra ground balls', by: 'Deren' }),
    note(D, { id: 'rough', practiceId: 'p1', read: 'struggled', text: 'Really struggled in my cage', by: 'Deren' }),
    note(D, { id: 'hustle', practiceId: 'p1', read: 'hustle', by: 'Aaron' }),
    note(D, { id: 'cue', practiceId: 'p1', read: 'coachable', by: 'Aaron' }),
    ...reps(D, ['Fielded clean', 'Backhand'], 5, { practiceId: 'p1' }),
    ...reps(D, ['Bobbled', 'Backhand'], 1, { practiceId: 'p1' }),
    ...reps(D, ['Throw on target'], 4, { practiceId: 'p1' }),
    ...reps(D, ['Throw off target'], 2, { practiceId: 'p1' }),
    ...reps(D, ['Hard contact'], 2, { practiceId: 'p1' }), // two is too few to show
    ...reps('2026-12-01', ['Fielded clean'], 2), ...reps('2026-12-01', ['Bobbled'], 2),
    ...reps('2026-12-01', ['Throw on target'], 1) // one rep the time before: no "last practice" line
  ];
  const ctx = { player: kid(), practice: p, team, coachName: 'Deren', observations: obs, practices: [p, practice('p0', '2026-12-01')], drills, plan: plan() };
  const d = practiceReportFor(ctx);

  it('good reads go in by default, plain notes wait for the coach, rough notes are never offered', () => {
    expect(d.lines.map((l) => [l.id, l.kind, l.included])).toEqual([['win', 'win', true], ['win-bare', 'win', true], ['plain', 'note', false]]);
    expect(d.report.wins).toEqual([{ by: 'Coach Aaron', text: 'Got his feet around the backhand.' }, { by: 'Coach Deren', text: 'Looked confident at the plate.' }]);
    expect(JSON.stringify(d.report)).not.toContain('struggled');
    expect(JSON.stringify(d.lines)).not.toContain('struggled');
  });
  it('the coach can put a plain note in and take a win out', () => {
    const e = practiceReportFor({ ...ctx, choices: { include: ['plain'], exclude: ['win-bare'], note: '  Great night.  ' } });
    expect(e.report.wins.map((w) => w.text)).toEqual(['Got his feet around the backhand.', 'Asked to stay after for extra ground balls.']);
    expect(e.report.coachNote).toEqual({ text: 'Great night.', by: 'Coach Deren' });
    // and a rough note cannot be forced in by its id
    expect(practiceReportFor({ ...ctx, choices: { include: ['rough'] } }).report.wins.map((w) => w.text).join(' ')).not.toContain('struggled');
  });
  it('effort reads become chips, once each', () => {
    expect(d.report.effort).toEqual(['Hustled', 'Took a cue and used it']);
  });
  it('counted reps show with three or more, next to the time before when that also had three', () => {
    expect(d.report.counts).toEqual([
      { skill: 'Fielding the ball', word: 'clean', good: 5, of: 6, before: { good: 2, of: 4 } },
      { skill: 'Throws', word: 'on target', good: 4, of: 6, before: undefined }
    ]);
  });
  it('the side row is left out when it says the same as the general fielding row, and kept when it differs', () => {
    expect(d.report.counts.some((c) => c.skill === 'Backhand side')).toBe(false);
    const more = practiceReportFor({ ...ctx, observations: [...obs, ...reps(D, ['Fielded clean', 'Forehand'], 3, { practiceId: 'p1' })] });
    expect(more.report.counts.map((c) => c.skill)).toEqual(['Fielding the ball', 'Backhand side', 'Throws', 'Forehand side']);
  });
  it('what the team worked on comes from the plan, by area, in order, with the coach\'s own station names', () => {
    expect(d.report.worked).toEqual([{ area: 'Infield defense', what: 'Backhand footwork, Wall ball short hops' }, { area: 'Hitting', what: 'Front toss, middle and away' }]);
    const long = practice('p9', D, [['d1'], ['d3'], ['d1', 'Third infield drill'], ['d1', 'Fourth']]);
    expect(practiceReportFor({ ...ctx, practice: long }).report.worked).toEqual([{ area: 'Infield defense', what: 'Wall ball short hops, Backhand footwork, and more' }]);
  });
  it('working on next and the home drills come from his goals, two at most', () => {
    expect(d.report.workingOn).toEqual([{ text: 'Backhand: right foot plants, glove out front.', cue: 'Glove out front' }]);
    expect(d.report.home).toEqual([{ name: 'Wall ball short hops', how: 'Field 20 out in front (2 sets of 10).', minutes: 10 }]);
  });
  it('says who wrote how much, and who to ask', () => {
    expect(d.notesByCoach).toEqual([{ by: 'A coach', n: 14 }, { by: 'Aaron', n: 3 }, { by: 'Deren', n: 3 }]);
    expect(d.report.coaches).toEqual([{ name: 'Coach Deren' }]);
    expect(d.report.playerName).toBe('Ellis Grant');
    expect(d.report.dateLabel).toBe('Thursday, December 3, 2026');
    expect(d.empty).toBe(false);
  });
  it('a kid nobody wrote about gets an honest, kind report, not a blank one', () => {
    const e = practiceReportFor({ ...ctx, observations: [] });
    expect(e.empty).toBe(true);
    expect(e.report.wins).toEqual([]);
    const html = renderPracticeReportHtml(e.report);
    expect(html).toContain('The coaches did not write notes on Ellis at this practice. That is not a comment on him');
    expect(html).toContain('Working on next');
    expect(latin1(buildPracticeReportPdf(e.report, false))).toContain('The coaches did not write notes on Ellis at this practice.');
  });

  it('the page is the program\'s own: wordmark, band, the family\'s name on it, nothing about another kid', () => {
    const html = renderPracticeReportHtml(practiceReportFor({ ...ctx, choices: { note: 'Great night.' } }).report);
    for (const want of ['<img class="wm" src="data:image/png;base64,', 'Practice report', 'Thursday, December 3, 2026', 'For Ellis\'s family', 'Ellis Grant #4', 'Great night.', '<b>Coach Aaron:</b> Got his feet around the backhand.', '5 of 6 clean', 'Last practice: 2 of 4', 'What we say to him: "Glove out front"', 'At home this week', 'Questions? Ask Coach Deren.', 'Nothing here is a ranking.', 'Warriors • Stewards Sports Guthrie']) expect(html, want).toContain(want);
    expect(html).not.toContain('SAMPLE');
    expect(html).not.toMatch(/team band|rank(ed|s)\b/i);
  });
  it('the PDF carries the same things, with the wordmark in it', () => {
    const r = practiceReportFor({ ...ctx, choices: { note: 'Great night.' } }).report;
    const pdf = latin1(buildPracticeReportPdf(r, false));
    expect(pdf.startsWith('%PDF-')).toBe(true);
    for (const want of ['PRACTICE REPORT', 'Thursday, December 3, 2026', "FOR ELLIS'S FAMILY", 'Ellis Grant  #4', 'Great night.', 'Coach Aaron:', '5 of 6 clean', 'Last practice: 2 of 4', 'AT HOME THIS WEEK', 'Wall ball short hops', 'Questions? Ask Coach Deren.']) expect(pdf, want).toContain(want);
    expect(pdf).toContain('/Subtype /Image');
    expect(pdf).not.toContain('SAMPLE REPORT');
    expect(/\/Count 1\b/.test(pdf)).toBe(true); // one page
  });
  it('a sample says so on the page and in the PDF', () => {
    const r: PracticeReport = { ...d.report, sample: true };
    expect(renderPracticeReportHtml(r)).toContain('SAMPLE REPORT. The notes and numbers below are made up');
    expect(latin1(buildPracticeReportPdf(r, false))).toContain('SAMPLE REPORT. The notes and numbers below are made up');
  });
  it('a long report runs onto a second page instead of off the first', () => {
    const many = Array.from({ length: 14 }, (_, i) => note(D, { id: `w${i}`, practiceId: 'p1', read: 'got_it', text: `A long note about footwork and hands number ${i}. `.repeat(3), by: i % 2 ? 'Aaron' : 'Deren' }));
    const big = practiceReportFor({ ...ctx, observations: [...obs, ...many], choices: { note: 'A long note from the coach. '.repeat(30) } });
    const r = { ...big.report, wins: big.lines.filter((l) => l.included).map((l) => ({ text: l.text, by: l.by })) };
    const pdf = latin1(buildPracticeReportPdf(r, false));
    expect(/\/Count [2-9]\b/.test(pdf)).toBe(true);
    expect(pdf).toContain('Page 2 of');
  });
  it('six lines at most go home from the notes', () => {
    const many = Array.from({ length: 10 }, (_, i) => note(D, { id: `m${i}`, practiceId: 'p1', read: 'got_it', text: `Win ${i}` }));
    expect(practiceReportFor({ ...ctx, observations: many }).report.wins.length).toBe(6);
  });
});

describe('the words around it', () => {
  it('the message greets the parent by first name and names the day', () => {
    const r = practiceReportFor({ player: kid(), practice: practice('p1', D), observations: [], practices: [], drills, plan: plan() }).report;
    expect(practiceReportMessage(r, 'Dana Pike')).toBe("Hi Dana, here is Ellis's practice report from Thursday, December 3: what we worked on, what we saw, and a couple of things for home. Questions anytime.");
    expect(practiceReportMessage(r)).toMatch(/^Hi, here is Ellis's practice report/);
    expect(practiceReportFileName(r)).toBe('Ellis-Grant-practice-report-December-3.pdf');
  });
  it('long dates do not slip a day in any time zone', () => {
    expect(longDate('2026-11-23')).toBe('Monday, November 23, 2026');
    expect(longDate('2026-01-01')).toBe('Thursday, January 1, 2026');
  });
});
