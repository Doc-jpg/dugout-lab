import { describe, it, expect, beforeEach } from 'vitest';
import { DugoutLabDB, seedLibrary, createTeam, createPlayer, saveVariant, addObservation, updatePlayer } from '../src/db/db';
import { suggestionsFor } from '../src/engine/suggestions';
import { buildBackup, readBackup, restoreBackup, readDugoutDadArchive, planRosterImport, commitRosterImport } from '../src/io/backup';
import { throwingFlags, restDaysFor } from '../src/engine/pitchsmart';
import { LIBRARY_DRILLS } from '../src/data/drills';
import { nowIso, type Drill, type Player } from '../src/engine/types';
import { zipSync, strToU8 } from 'fflate';
import { sha256Hex } from '../src/io/hash';

const ts = nowIso();
const drills: Drill[] = LIBRARY_DRILLS.map((d) => ({ ...d, createdAt: ts, updatedAt: ts }));
const base: Player = { id: 'j', teamId: 't', firstName: 'Johnny', lastName: 'Q', positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: ['Drop step first'], approaches: [], levels: { outfield: 3 }, statuses: {}, createdAt: ts, updatedAt: ts };

describe('Test E: repeated outfield hesitation produces a labeled suggestion', () => {
  it('two hesitations in the outfield, one from a game, suggest a decision drill', () => {
    const obs = [
      { id: 'o1', playerId: 'j', read: 'hesitated' as const, category: 'outfield' as const, source: 'practice' as const, ts: nowIso() },
      { id: 'o2', playerId: 'j', read: 'hesitated' as const, category: 'outfield' as const, source: 'game' as const, ts: nowIso(), text: 'waited on the gap ball' }
    ];
    const s = suggestionsFor(base, obs, drills);
    expect(s.length).toBe(1);
    expect(s[0].kind).toBe('decision_work');
    expect(s[0].text).toMatch(/^Suggestion, not a diagnosis/);
    expect(s[0].text).toMatch(/hesitated on outfield defense/);
    expect(s[0].fromGame).toBe(true);
    expect(s[0].basis).toEqual(['o1', 'o2']);
    expect(s[0].drillId).toBeDefined();
    const d = drills.find((x) => x.id === s[0].drillId)!;
    expect(d.category === 'outfield' || d.also?.includes('outfield')).toBe(true);
    expect(s[0].text).toContain('Drop step first');
  });
  it('one note is not a pattern', () => {
    expect(suggestionsFor(base, [{ id: 'o1', playerId: 'j', read: 'hesitated', category: 'outfield', source: 'practice', ts: nowIso() }], drills)).toEqual([]);
  });
  it('frustration twice suggests a reset routine; three got-its suggest advancing', () => {
    const obs = [
      { id: 'f1', playerId: 'j', read: 'frustrated' as const, source: 'practice' as const, ts: nowIso() },
      { id: 'f2', playerId: 'j', read: 'frustrated' as const, source: 'game' as const, ts: nowIso() },
      { id: 'g1', playerId: 'j', read: 'got_it' as const, category: 'infield' as const, source: 'practice' as const, ts: nowIso() },
      { id: 'g2', playerId: 'j', read: 'got_it' as const, category: 'infield' as const, source: 'practice' as const, ts: nowIso() },
      { id: 'g3', playerId: 'j', read: 'confident' as const, category: 'infield' as const, source: 'practice' as const, ts: nowIso() }
    ];
    const s = suggestionsFor(base, obs, drills);
    expect(s.map((x) => x.kind).sort()).toEqual(['ready_to_advance', 'reset_routine']);
    expect(s.find((x) => x.kind === 'reset_routine')!.text).toMatch(/not a diagnosis/);
  });
});

describe('Pitch Smart', () => {
  it('rest days follow the public table for 11-12 and 13-14', () => {
    expect(restDaysFor(20, 12)).toBe(0);
    expect(restDaysFor(21, 12)).toBe(1);
    expect(restDaysFor(36, 12)).toBe(2);
    expect(restDaysFor(51, 12)).toBe(3);
    expect(restDaysFor(66, 12)).toBe(4);
    expect(restDaysFor(85, 14)).toBe(4);
    expect(restDaysFor(30, 16)).toBe(0);
    expect(restDaysFor(31, 16)).toBe(1);
    expect(restDaysFor(36, 13)).toBe(2);
    expect(restDaysFor(51, 6)).toBe(3); // 6U uses the 7-8 row
    expect(restDaysFor(66, 6)).toBe(3); // and never needs the fourth threshold
  });
  it('flags rest, unknown counts, and other-team players with nothing logged', () => {
    const p2: Player = { ...base, id: 'k', otherTeams: 'School' };
    const flags = throwingFlags([base, p2], [
      { id: 't1', playerId: 'j', date: '2026-11-01', pitches: 62, kind: 'game', source: 'manual', createdAt: ts }
    ], '12U', '2026-11-02');
    expect(flags.get('j')!.status).toBe('rest');
    expect(flags.get('j')!.clearedOn).toBe('2026-11-05');
    expect(flags.get('k')!.status).toBe('unknown');
    const later = throwingFlags([base], [{ id: 't1', playerId: 'j', date: '2026-11-01', pitches: 62, kind: 'game', source: 'manual', createdAt: ts }], '12U', '2026-11-05');
    expect(later.get('j')!.status).toBe('ok');
    const unknown = throwingFlags([base], [{ id: 't2', playerId: 'j', date: '2026-11-01', pitches: null, kind: 'other_team', source: 'manual', createdAt: ts }], '12U', '2026-11-02');
    expect(unknown.get('j')!.status).toBe('unknown');
  });
});

describe('Test B and G: persistence and backup round trip', () => {
  let a: DugoutLabDB;
  beforeEach(async () => {
    a = new DugoutLabDB(`test-${Math.random().toString(36).slice(2)}`);
    await seedLibrary(a);
  });

  it('a player-specific variant survives close and reopen', async () => {
    const name = a.name;
    await createTeam({ id: 't', name: 'T', ageGroup: '12U' }, a);
    await createPlayer({ id: 'j', teamId: 't', firstName: 'Johnny', lastName: 'Q' }, a);
    const gb = (await a.drills.where('category').equals('infield').toArray())[0];
    const v = await saveVariant({ drillId: gb.id, playerId: 'j', name: 'Soft balls', objective: 'Clean glove work', reps: '2 x 8' }, a);
    a.close();
    const b = new DugoutLabDB(name);
    const got = await b.variants.get(v.id);
    expect(got?.objective).toBe('Clean glove work');
    expect(got?.reps).toBe('2 x 8');
    b.close();
  });

  it('backup restores roster, variants and practices into a fresh database; merge keeps newer local edits', async () => {
    await createTeam({ id: 't', name: 'T', ageGroup: '12U' }, a);
    await createPlayer({ id: 'j', teamId: 't', firstName: 'Johnny', lastName: 'Q' }, a);
    const gb = (await a.drills.where('category').equals('infield').toArray())[0];
    await saveVariant({ id: 'v1', drillId: gb.id, playerId: 'j', name: 'Soft balls', objective: 'Clean glove work' }, a);
    await a.practices.put({ id: 'pr1', teamId: 't', date: '2026-11-01', status: 'done', inputs: { teamId: 't', presentIds: ['j'], absentIds: [], durationMin: 60, coaches: 1, equipment: [], space: 'full', indoor: false, teamPriorities: [], playerPriorities: {}, noThrowingIds: [] }, blocks: [], rationale: [], createdAt: ts, updatedAt: ts });
    await addObservation({ playerId: 'j', read: 'got_it', source: 'practice' }, a);
    const { bytes, manifest } = await buildBackup('0.1.0', a);
    expect(manifest.files['players.json'].records).toBe(1);
    expect(manifest.files['drills.json'].records).toBe(LIBRARY_DRILLS.length);

    const contents = await readBackup(bytes);
    const fresh = new DugoutLabDB(`restore-${Math.random().toString(36).slice(2)}`);
    const report = await restoreBackup(contents, 'replace', fresh);
    expect(report.added.players).toBe(1);
    expect(report.added.variants).toBe(1);
    expect(report.added.practices).toBe(1);
    expect(report.added.observations).toBe(1);
    expect((await fresh.players.get('j'))?.firstName).toBe('Johnny');
    expect((await fresh.variants.get('v1'))?.objective).toBe('Clean glove work');
    expect((await fresh.practices.get('pr1'))?.status).toBe('done');

    // Merge: a newer local edit is kept, an older one is replaced
    await new Promise((r) => setTimeout(r, 5));
    await updatePlayer('j', { firstName: 'Jonathan' }, fresh);
    const report2 = await restoreBackup(contents, 'merge', fresh);
    expect((await fresh.players.get('j'))?.firstName).toBe('Jonathan');
    expect(report2.keptNewerHere.some((k) => k.id === 'j')).toBe(true);
    expect(report2.added.players).toBe(0);
    fresh.close();
  });

  it('rejects a backup whose contents no longer match the manifest', async () => {
    const { bytes } = await buildBackup('0.1.0', a);
    const { unzipSync } = await import('fflate');
    const entries = unzipSync(bytes);
    entries['players.json'] = strToU8('[{"id":"forged"}]');
    await expect(readBackup(zipSync(entries))).rejects.toThrow(/checksum/);
  });

  it('reads a Dugout Dad weekend archive and imports only real, active players', async () => {
    await createTeam({ id: 'lab', name: 'Lab team', ageGroup: '14U' }, a);
    const manifest = { format: 'dugout-dad-archive', formatVersion: 1, files: {} as Record<string, { sha256: string }> };
    const teams = [{ id: 'dad-t', name: 'Rattlers 13U', shortName: 'Rattlers', isMine: true }];
    const players = [
      { id: 'dp1', teamId: 'dad-t', firstName: 'Eli', lastName: 'Test', number: '1', bats: 'R', throws: 'R', status: 'regular' },
      { id: 'dp2', teamId: 'dad-t', firstName: '', lastName: 'Player 4', status: 'regular', isPlaceholder: true },
      { id: 'dp3', teamId: 'dad-t', firstName: 'Gone', lastName: 'Kid', status: 'former' },
      { id: 'dp4', teamId: 'dad-t', firstName: 'Pick', lastName: 'Up', number: '15', bats: 'S', status: 'pickup' }
    ];
    const files: Record<string, Uint8Array> = { 'teams.json': strToU8(JSON.stringify(teams)), 'players.json': strToU8(JSON.stringify(players)) };
    for (const [n, b] of Object.entries(files)) manifest.files[n] = { sha256: await sha256Hex(b) };
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    const roster = await readDugoutDadArchive(zipSync(files));
    const plan = await planRosterImport(roster, 'dad-t', a);
    expect(plan.create.map((p) => p.id)).toEqual(['dp1', 'dp4']);
    expect(plan.skipped.length).toBe(2);
    const r = await commitRosterImport(plan, 'lab', a);
    expect(r.created).toBe(2);
    const eli = await a.players.get('dp1');
    expect(eli?.teamId).toBe('lab');
    expect(eli?.importedFrom).toBe('dugout-dad');
    expect((await a.players.get('dp4'))?.bats).toBe('B');
    // Second import updates instead of duplicating
    const plan2 = await planRosterImport(roster, 'dad-t', a);
    expect(plan2.create.length).toBe(0);
    expect(plan2.update.length).toBe(2);
  });
});

describe('two coaches, one practice: notes from two phones merge without loss', () => {
  it('coach pack carries roster, drills, versions and the plan but no private notes; both coaches\' notes survive the merge', async () => {
    const head = new DugoutLabDB(`head-${Math.random().toString(36).slice(2)}`);
    await seedLibrary(head);
    await head.settings.put({ ...(await import('../src/engine/types')).DEFAULT_SETTINGS, coachName: 'Deren' });
    await createTeam({ id: 't', name: 'T', ageGroup: '12U' }, head);
    await createPlayer({ id: 'j', teamId: 't', firstName: 'Johnny', lastName: 'Q', responseNotes: 'private', confidenceNotes: 'private too', parents: [{ name: 'Mom', phone: '555' }] }, head);
    await head.practices.put({ id: 'plan', teamId: 't', date: '2026-11-03', status: 'planned', inputs: { teamId: 't', presentIds: ['j'], absentIds: [], durationMin: 60, coaches: 2, equipment: [], space: 'full', indoor: false, teamPriorities: [], playerPriorities: {}, noThrowingIds: [] }, blocks: [], rationale: [], createdAt: ts, updatedAt: ts });
    const { buildCoachPack } = await import('../src/io/backup');
    const pack = await readBackup((await buildCoachPack('0.1.0', 't', head)).bytes);
    expect(pack.players[0].responseNotes).toBeUndefined();
    expect(pack.players[0].parents).toBeUndefined();
    expect(pack.practices.length).toBe(1);
    expect(pack.observations.length).toBe(0);
    // Assistant restores the pack on his phone and takes notes at his station
    const asst = new DugoutLabDB(`asst-${Math.random().toString(36).slice(2)}`);
    await restoreBackup(pack, 'replace', asst);
    await asst.settings.put({ ...(await import('../src/engine/types')).DEFAULT_SETTINGS, coachName: 'Aaron' });
    await addObservation({ playerId: 'j', read: 'got_it', category: 'infield', practiceId: 'plan', source: 'practice' }, asst);
    await addObservation({ playerId: 'j', read: 'hustle', practiceId: 'plan', source: 'practice' }, asst);
    // Head coach took his own notes meanwhile
    await addObservation({ playerId: 'j', read: 'struggled', category: 'hitting', practiceId: 'plan', source: 'practice' }, head);
    // Merge the assistant's backup into the head coach's phone
    const report = await restoreBackup(await readBackup((await buildBackup('0.1.0', asst)).bytes), 'merge', head);
    expect(report.added.observations).toBe(2);
    const all = await head.observations.where('playerId').equals('j').toArray();
    expect(all.length).toBe(3);
    expect(all.filter((o) => o.by === 'Aaron').length).toBe(2);
    expect(all.filter((o) => o.by === 'Deren').length).toBe(1);
    // Private notes and family contacts on the head coach's phone are untouched
    const j = await head.players.get('j');
    expect(j?.responseNotes).toBe('private');
    expect(j?.parents?.[0].name).toBe('Mom');
    // The assistant set a level (his copy is now newer): the level comes across, the private fields stay
    await new Promise((r) => setTimeout(r, 5));
    await updatePlayer('j', { levels: { infield: 4 } }, asst);
    const report2 = await restoreBackup(await readBackup((await buildBackup('0.1.0', asst)).bytes), 'merge', head);
    expect(report2.updated.players).toBe(1);
    const j2 = await head.players.get('j');
    expect(j2?.levels.infield).toBe(4);
    expect(j2?.responseNotes).toBe('private');
    expect(j2?.confidenceNotes).toBe('private too');
    expect(j2?.parents?.[0].name).toBe('Mom');
    head.close();
    asst.close();
  });
});

describe('two coaches editing the same kid on different days do not erase each other', () => {
  it('goals, cues and levels from both phones survive a merge in either direction; unattributed notes get the sender\'s name', async () => {
    const { DEFAULT_SETTINGS } = await import('../src/engine/types');
    const { buildCoachPack } = await import('../src/io/backup');
    const head = new DugoutLabDB(`head2-${Math.random().toString(36).slice(2)}`);
    const asst = new DugoutLabDB(`asst2-${Math.random().toString(36).slice(2)}`);
    await seedLibrary(head);
    await head.settings.put({ ...DEFAULT_SETTINGS, coachName: 'Deren', pinHash: 'h', pinSalt: 's' });
    await createTeam({ id: 't', name: 'Rattlers', ageGroup: '13U' }, head);
    await createPlayer({ id: 'j', teamId: 't', firstName: 'Johnny', lastName: 'Q', cues: ['Stay down'], responseNotes: 'private' }, head);
    // Assistant gets the pack on a fresh phone with no settings at all
    await restoreBackup(await readBackup((await buildCoachPack('0.3.0', 't', head)).bytes), 'replace', asst);
    const asstSettings = await asst.settings.get('settings');
    expect(asstSettings?.teamId).toBe('t');
    expect(asstSettings?.pinHash).toBeUndefined();
    expect(asstSettings?.coachName).toBeUndefined();
    // Tuesday: head coach adds a goal. Thursday: assistant adds a cue and sets a level (his record is newer).
    await updatePlayer('j', { goals: [{ id: 'g1', category: 'infield', text: 'Backhand footwork', kind: 'technical', status: 'active', createdAt: ts }] }, head);
    await new Promise((r) => setTimeout(r, 5));
    await updatePlayer('j', { cues: ['Stay down', 'Glove out front'], levels: { infield: 3 } }, asst);
    await asst.observations.put({ id: 'o-noname', playerId: 'j', read: 'got_it', source: 'practice', ts: nowIso(), createdAt: nowIso() } as any);
    // Assistant's backup merged into the head coach's phone: the goal must survive even though his record is newer
    await restoreBackup(await readBackup((await buildBackup('0.3.0', asst)).bytes), 'merge', head);
    const j = await head.players.get('j');
    expect(j?.goals.map((g) => g.id)).toEqual(['g1']);
    expect(j?.cues).toEqual(['Stay down', 'Glove out front']);
    expect(j?.levels.infield).toBe(3);
    expect(j?.responseNotes).toBe('private');
    // And the other direction: head coach's pack merged into the assistant's phone keeps his cue and level
    await restoreBackup(await readBackup((await buildCoachPack('0.3.0', 't', head)).bytes), 'merge', asst);
    const ja = await asst.players.get('j');
    expect(ja?.goals.map((g) => g.id)).toEqual(['g1']);
    expect(ja?.cues).toContain('Glove out front');
    expect(ja?.levels.infield).toBe(3);
    // A note saved with no coach name set gets the name from the backup it came in on
    await asst.settings.put({ ...(asstSettings ?? DEFAULT_SETTINGS), coachName: 'Aaron' });
    await restoreBackup(await readBackup((await buildBackup('0.3.0', asst)).bytes), 'merge', head);
    expect((await head.observations.get('o-noname'))?.by).toBe('Aaron');
    // Replacing the head coach's phone from the assistant's full backup keeps the head coach's own name and PIN
    await restoreBackup(await readBackup((await buildBackup('0.3.0', asst)).bytes), 'replace', head);
    const hs = await head.settings.get('settings');
    expect(hs?.coachName).toBe('Deren');
    expect(hs?.pinHash).toBe('h');
    head.close();
    asst.close();
  });
});
