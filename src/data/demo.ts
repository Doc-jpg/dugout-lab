/**
 * Demo data: a fictional team so the coach can try everything before adding real kids.
 * Every demo record carries DEMO_TAG and is removed in one tap. No real children.
 */
import { db, createTeam, createPlayer, saveVariant, addObservation, addThrowing, savePractice, saveSettings, getSettings } from '../db/db';
import { generatePractice } from '../engine/generator';
import type { Category, Level, Player, SkillStatus } from '../engine/types';
import { nowIso, today } from '../engine/types';

export const DEMO_TAG = 'DEMO (fictional)';
export const DEMO_TEAM_ID = 'demo-team-dirtbags';

const ROSTER: Array<{ id: string; first: string; last: string; num: string; pos: Player['positions']; bats: Player['bats']; throws: Player['throws']; levels: Partial<Record<Category, Level>>; statuses?: Partial<Record<Category, SkillStatus>>; strengths: string[]; challenges: string[]; cues: string[]; approaches: Player['approaches']; goals: Array<{ category: Category; text: string; kind: 'technical' | 'mental' }>; confidence?: string; response?: string; other?: string }> = [
  { id: 'demo-p01', first: 'Sam', last: 'Rivera', num: '1', pos: ['SS', 'P'], bats: 'R', throws: 'R', levels: { hitting: 4, infield: 4, pitching: 3, mental: 3 }, strengths: ['Quick hands', 'Wants the ball'], challenges: ['Rushes the throw on slow rollers'], cues: ['Field it, then find the target'], approaches: ['challenge', 'one_cue'], goals: [{ category: 'infield', text: 'Slow rollers: field on the run, one step and throw', kind: 'technical' }], confidence: 'Compete against himself: beat last rep.', response: 'Gets quiet after an error; a quick "next one" and a task helps.' },
  { id: 'demo-p02', first: 'Jonah', last: 'Pike', num: '2', pos: ['CF', 'LF'], bats: 'L', throws: 'R', levels: { outfield: 3, hitting: 3, baserunning: 4 }, strengths: ['Fast', 'Good first step'], challenges: ['Hesitates on balls hit over his head'], cues: ['Drop step, then find it'], approaches: ['demo', 'explore'], goals: [{ category: 'outfield', text: 'Drop step on the crack of the bat, no false step', kind: 'technical' }, { category: 'mental', text: 'One breath before every pitch in the field', kind: 'mental' }] },
  { id: 'demo-p03', first: 'Theo', last: 'Marsh', num: '3', pos: ['C', '1B'], bats: 'R', throws: 'R', levels: { catching: 3, hitting: 2, mental: 2 }, strengths: ['Tough', 'Blocks well'], challenges: ['Swings at high pitches', 'Hard on himself after strikeouts'], cues: ['Let it travel', 'Belt and below'], approaches: ['verbal', 'quiet_reps'], goals: [{ category: 'hitting', text: 'Take the high pitch; swing at belt and below', kind: 'technical' }, { category: 'mental', text: 'Reset routine after a strikeout: breath, glove tap, next pitch', kind: 'mental' }], confidence: 'Praise the take, not just the hit.', response: 'Frustration shows as a fast walk back to the dugout; give him a job (catch the warm-up pitcher).' },
  { id: 'demo-p04', first: 'Ellis', last: 'Grant', num: '4', pos: ['2B', 'SS'], bats: 'R', throws: 'R', levels: { infield: 2, throwing: 2, hitting: 3 }, statuses: { infield: 'practicing' }, strengths: ['Listens', 'Steady'], challenges: ['Backhand footwork', 'Short-arms throws'], cues: ['Long arm, point the shoulder'], approaches: ['one_cue', 'visual_target'], goals: [{ category: 'infield', text: 'Backhand: right foot plants, glove out front', kind: 'technical' }] },
  { id: 'demo-p05', first: 'Nico', last: 'Bell', num: '5', pos: ['P', '3B'], bats: 'R', throws: 'R', levels: { pitching: 4, infield: 3, hitting: 3 }, strengths: ['Strike thrower'], challenges: ['Loses his legs late in outings'], cues: ['Drive, don\'t fall'], approaches: ['verbal', 'challenge'], goals: [{ category: 'pitching', text: 'Finish over the front leg on every pitch, even at 60 pitches', kind: 'technical' }], other: 'Middle school team' },
  { id: 'demo-p06', first: 'Reid', last: 'Calloway', num: '6', pos: ['1B', 'RF'], bats: 'L', throws: 'L', levels: { hitting: 4, outfield: 2, athletic: 2 }, strengths: ['Power', 'Patient hitter'], challenges: ['Slow first step', 'Routes on fly balls'], cues: ['Go get it, don\'t wait for it'], approaches: ['demo', 'challenge'], goals: [{ category: 'outfield', text: 'First step on contact, no watching', kind: 'technical' }] },
  { id: 'demo-p07', first: 'Owen', last: 'Tate', num: '7', pos: ['LF', '2B'], bats: 'R', throws: 'R', levels: { hitting: 2, baserunning: 2, mental: 2 }, strengths: ['Hustles'], challenges: ['Late on fastballs', 'Freezes on the bases'], cues: ['Early, then easy', 'Know the outs before the pitch'], approaches: ['visual_target', 'quiet_reps'], goals: [{ category: 'hitting', text: 'Front foot down early; see it with the foot down', kind: 'technical' }, { category: 'baserunning', text: 'Say the outs and the play out loud before every pitch', kind: 'technical' }], confidence: 'Catch him doing it right and say exactly what he did.' },
  { id: 'demo-p08', first: 'Miles', last: 'Okafor', num: '8', pos: ['CF', 'SS'], bats: 'R', throws: 'R', levels: { outfield: 4, infield: 3, hitting: 3, baserunning: 4 }, strengths: ['Athletic', 'Reads the ball well'], challenges: ['Throws to the wrong base under pressure'], cues: ['Hit the cutoff, let him decide'], approaches: ['explore', 'challenge'], goals: [{ category: 'team_defense', text: 'Hit the cutoff man chest-high every time', kind: 'technical' }] },
  { id: 'demo-p09', first: 'Beau', last: 'Lindqvist', num: '9', pos: ['C', '3B'], bats: 'R', throws: 'R', levels: { catching: 2, hitting: 2 }, strengths: ['Wants to catch'], challenges: ['Receiving low pitches', 'Pop-ups behind the plate'], cues: ['Beat it to the spot'], approaches: ['demo', 'one_cue'], goals: [{ category: 'catching', text: 'Receive low pitches with the glove working up', kind: 'technical' }] },
  { id: 'demo-p10', first: 'Cash', last: 'Delgado', num: '10', pos: ['P', 'RF'], bats: 'R', throws: 'R', levels: { pitching: 2, throwing: 3, hitting: 3 }, strengths: ['Loose arm'], challenges: ['Command', 'Rushes when runners are on'], cues: ['Slow is smooth'], approaches: ['verbal', 'quiet_reps'], goals: [{ category: 'pitching', text: 'Same tempo with runners on as with bases empty', kind: 'technical' }, { category: 'mental', text: 'Step off and breathe when the tempo speeds up', kind: 'mental' }] },
  { id: 'demo-p11', first: 'Wes', last: 'Nakamura', num: '11', pos: ['2B', 'LF'], bats: 'L', throws: 'R', levels: { hitting: 3, infield: 2, athletic: 4 }, strengths: ['Quick feet', 'Bunts well'], challenges: ['Double-play feeds'], cues: ['Feed with the glove, show the ball'], approaches: ['demo', 'explore'], goals: [{ category: 'infield', text: 'Underhand feed from 2B: show the ball, firm and chest-high', kind: 'technical' }] },
  { id: 'demo-p12', first: 'Hank', last: 'Sorensen', num: '12', pos: ['3B', '1B'], bats: 'R', throws: 'R', levels: { hitting: 3, infield: 3, mental: 4 }, strengths: ['Calm', 'Good teammate'], challenges: ['Pulls off the ball', 'Flat-footed on slow rollers'], cues: ['Stay through the middle'], approaches: ['verbal', 'challenge'], goals: [{ category: 'hitting', text: 'Drive the ball to the middle of the field; no pull-side ground balls', kind: 'technical' }] }
];

export async function loadDemoData(): Promise<{ teamId: string; practiceId: string }> {
  const ts = nowIso();
  const existing = await db.teams.get(DEMO_TEAM_ID);
  if (!existing) {
    const logo = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#8a3b12"/><circle cx="60" cy="60" r="34" fill="#f2c14e"/><path d="M38 60h44M60 38v44" stroke="#8a3b12" stroke-width="8" stroke-linecap="round"/></svg>');
    await createTeam({ id: DEMO_TEAM_ID, name: `Dirtbags 12U ${DEMO_TAG}`, shortName: 'Dirtbags', ageGroup: '12U', season: 'Demo', priorities: ['infield', 'hitting', 'baseball_iq'],
      brand: { programName: `Dirtbags Baseball ${DEMO_TAG}`, tagline: 'Every kid gets better here', logo, primary: '#8a3b12', accent: '#f2c14e', coaches: [{ name: 'Coach Demo', role: 'Head coach', phone: '555-0100', email: 'coach@example.com' }, { name: 'Coach Assistant', role: 'Assistant' }], footer: 'dirtbagsbaseball.example.com' } });
  }
  for (const r of ROSTER) {
    if (await db.players.get(r.id)) continue;
    await createPlayer({
      id: r.id, teamId: DEMO_TEAM_ID, firstName: r.first, lastName: r.last, number: r.num, positions: r.pos, bats: r.bats, throws: r.throws, ageGroup: '12U',
      levels: r.levels, statuses: r.statuses ?? {}, strengths: r.strengths, challenges: r.challenges, cues: r.cues, approaches: r.approaches,
      goals: r.goals.map((g, i) => ({ id: `${r.id}-g${i}`, status: 'active' as const, createdAt: ts, ...g })),
      confidenceNotes: r.confidence, responseNotes: r.response, otherTeams: r.other, experience: 'Demo',
      parents: r.id === 'demo-p02' ? [{ name: 'Dana Pike', relation: 'mom', phone: '555-0102', email: 'dana.pike@example.com', preferred: 'text' }] : r.id === 'demo-p03' ? [{ name: 'Chris Marsh', relation: 'dad', email: 'chris.marsh@example.com', preferred: 'email' }] : undefined,
      share: r.id === 'demo-p02' ? 'scorecard' : undefined
    });
  }
  // A saved player-specific variant: Ellis gets the stationary, soft-ball version of a ground-ball drill.
  const gb = (await db.drills.toArray()).find((d) => d.category === 'infield' && /ground/i.test(d.name) && d.levelMin <= 2) ?? (await db.drills.where('category').equals('infield').first());
  if (gb && !(await db.variants.where('drillId').equals(gb.id).toArray()).some((v) => v.playerId === 'demo-p04')) {
    await saveVariant({ drillId: gb.id, playerId: 'demo-p04', name: 'Ellis: stationary, soft balls, short', objective: 'Clean glove work from a set position; no throw until the ball is secured', reps: '2 sets of 8', distance: '15 feet', equipment: 'Soft balls', intensity: 'easy', mental: 'Count clean reps out loud; restart the count after a bobble, no big deal', cues: ['Glove out front', 'Funnel to the belt'] });
  }
  // Observations: Jonah hesitated on outfield decisions twice (one in a game); Theo frustrated twice; Sam got it three times.
  const have = await db.observations.where('playerId').equals('demo-p02').count();
  if (!have) {
    const d = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    await addObservation({ playerId: 'demo-p02', read: 'hesitated', category: 'outfield', text: 'Froze on the ball over his head, then went back late', source: 'practice', ts: d(6) });
    await addObservation({ playerId: 'demo-p02', read: 'hesitated', category: 'outfield', text: 'Game: waited on a fly ball in the gap, should have been his', source: 'game', ts: d(3) });
    await addObservation({ playerId: 'demo-p03', read: 'frustrated', category: 'hitting', text: 'Strikeout on a high pitch, slammed the helmet', source: 'game', ts: d(3) });
    await addObservation({ playerId: 'demo-p03', read: 'frustrated', category: 'hitting', text: 'Two swings and misses, shut down for the rest of the station', source: 'practice', ts: d(6) });
    await addObservation({ playerId: 'demo-p01', read: 'got_it', category: 'infield', text: 'Slow roller, one step and throw, on the money', source: 'practice', ts: d(6) });
    await addObservation({ playerId: 'demo-p01', read: 'got_it', category: 'infield', text: 'Barehand play in the game', source: 'game', ts: d(3) });
    await addObservation({ playerId: 'demo-p01', read: 'got_it', category: 'infield', source: 'practice', ts: d(1) });
    await addThrowing({ playerId: 'demo-p05', date: today(), pitches: 62, kind: 'game', source: 'manual', note: 'Demo: yesterday\'s game' });
    await addThrowing({ playerId: 'demo-p10', date: today(), pitches: null, kind: 'other_team', source: 'manual', note: 'Demo: threw for his school team, count unknown' });
  }
  const settings = await getSettings();
  if (!settings.teamId) await saveSettings({ teamId: DEMO_TEAM_ID });
  // One finished practice from last week, one planned for today.
  let practiceId = (await db.practices.where('teamId').equals(DEMO_TEAM_ID).toArray()).find((p) => p.status === 'planned')?.id;
  if (!practiceId) {
    const team = (await db.teams.get(DEMO_TEAM_ID))!;
    const players = await db.players.where('teamId').equals(DEMO_TEAM_ID).toArray();
    const drills = await db.drills.toArray();
    const variants = await db.variants.toArray();
    const observations = await db.observations.toArray();
    const throwing = await db.throwing.toArray();
    const ctx = { team, players, drills, variants, recentPractices: [], observations, throwing, settings, seed: 12 };
    const lastWeek = new Date(Date.now() - 7 * 86400000);
    const lastDate = `${lastWeek.getFullYear()}-${String(lastWeek.getMonth() + 1).padStart(2, '0')}-${String(lastWeek.getDate()).padStart(2, '0')}`;
    const inputs = {
      teamId: DEMO_TEAM_ID, presentIds: players.map((p) => p.id), absentIds: [], durationMin: 90, coaches: 2,
      equipment: settings.defaultEquipment, space: 'full' as const, indoor: false, teamPriorities: team.priorities,
      playerPriorities: {}, noThrowingIds: []
    };
    const done = generatePractice(inputs, ctx, { date: lastDate, title: `Last week ${DEMO_TAG}` });
    done.status = 'done';
    done.recap = { summary: 'Good energy. Ground-ball station ran long.', wins: ['Sam: slow roller, one step and throw'], followUps: ['Jonah: drop-step reps'], finishedAt: nowIso() };
    await savePractice(done);
    const plan = generatePractice({ ...inputs, presentIds: players.filter((p) => p.id !== 'demo-p12').map((p) => p.id), absentIds: ['demo-p12'], noThrowingIds: ['demo-p05', 'demo-p10'] }, { ...ctx, recentPractices: [done], seed: 7 }, { date: today(), time: '17:30', title: `Today ${DEMO_TAG}` });
    await savePractice(plan);
    practiceId = plan.id;
  }
  return { teamId: DEMO_TEAM_ID, practiceId };
}

export async function removeDemoData(): Promise<number> {
  const ids = ROSTER.map((r) => r.id);
  let n = 0;
  await db.transaction('rw', [db.teams, db.players, db.variants, db.practices, db.observations, db.throwing, db.parentUpdates, db.settings], async () => {
    n += await db.practices.where('teamId').equals(DEMO_TEAM_ID).delete();
    n += await db.parentUpdates.where('playerId').anyOf(ids).delete();
    n += await db.observations.where('playerId').anyOf(ids).delete();
    n += await db.throwing.where('playerId').anyOf(ids).delete();
    n += await db.variants.where('playerId').anyOf(ids).delete();
    n += await db.players.where('teamId').equals(DEMO_TEAM_ID).delete();
    n += await db.teams.where('id').equals(DEMO_TEAM_ID).delete();
    const s = await db.settings.get('settings');
    if (s?.teamId === DEMO_TEAM_ID) await db.settings.update('settings', { teamId: undefined });
  });
  return n;
}
