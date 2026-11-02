import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { DugoutLabDB, seedLibrary, createTeam, createPlayer, addObservation, saveVariant, deletePlayer, deleteTeam, movePlayer, addThrowing } from '../src/db/db';
import { nowIso } from '../src/engine/types';

const ts = nowIso();

describe('audit: data integrity', () => {
  it('a version 1 database (before parent updates existed) opens under the current schema with its data intact', async () => {
    const name = `mig-${Math.random().toString(36).slice(2)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ teams: 'id, name', players: 'id, teamId, lastName, status', drills: 'id, category, source, name', variants: 'id, drillId, playerId', practices: 'id, teamId, date, status', observations: 'id, practiceId, playerId, ts, category', throwing: 'id, playerId, date', settings: 'id', meta: 'key' });
    await v1.open();
    await v1.table('teams').put({ id: 't', name: 'Old team', ageGroup: '16U+', priorities: [], createdAt: ts, updatedAt: ts });
    await v1.table('players').put({ id: 'p', teamId: 't', firstName: 'Old', lastName: 'Kid', positions: [], status: 'active', strengths: [], challenges: [], goals: [], cues: [], approaches: [], levels: {}, statuses: {}, createdAt: ts, updatedAt: ts });
    await v1.table('observations').put({ id: 'o', playerId: 'p', read: 'got_it', source: 'practice', ts });
    v1.close();
    const now = new DugoutLabDB(name);
    await seedLibrary(now);
    expect((await now.teams.get('t'))?.name).toBe('Old team');
    expect((await now.players.get('p'))?.firstName).toBe('Old');
    expect(await now.observations.count()).toBe(1);
    expect(await now.parentUpdates.count()).toBe(0);
    expect(await now.drills.count()).toBeGreaterThan(100);
    now.close();
  });

  it('deleting a player removes only his records; deleting a team removes its players and practices but not drills', async () => {
    const db = new DugoutLabDB(`del-${Math.random().toString(36).slice(2)}`);
    await seedLibrary(db);
    await createTeam({ id: 'a', name: 'A', ageGroup: '12U' }, db);
    await createTeam({ id: 'b', name: 'B', ageGroup: '12U' }, db);
    await createPlayer({ id: 'p1', teamId: 'a', firstName: 'One', lastName: 'A' }, db);
    await createPlayer({ id: 'p2', teamId: 'a', firstName: 'Two', lastName: 'A' }, db);
    await createPlayer({ id: 'p3', teamId: 'b', firstName: 'Three', lastName: 'B' }, db);
    const d = (await db.drills.toArray())[0];
    for (const pid of ['p1', 'p2', 'p3']) {
      await addObservation({ playerId: pid, read: 'got_it', source: 'practice' }, db);
      await saveVariant({ drillId: d.id, playerId: pid, name: 'v' }, db);
      await addThrowing({ playerId: pid, date: '2026-11-01', pitches: 10, kind: 'game', source: 'manual' }, db);
    }
    await deletePlayer('p1', db);
    expect(await db.players.count()).toBe(2);
    expect(await db.observations.where('playerId').equals('p1').count()).toBe(0);
    expect(await db.observations.count()).toBe(2);
    expect(await db.variants.count()).toBe(2);
    expect(await db.throwing.count()).toBe(2);
    await movePlayer('p2', 'b', db);
    expect((await db.players.get('p2'))?.teamId).toBe('b');
    await deleteTeam('b', db);
    expect(await db.players.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
    expect(await db.drills.count()).toBeGreaterThan(100);
    expect(await db.teams.count()).toBe(1);
    db.close();
  });

  it('two kids with the same name and number stay separate records', async () => {
    const db = new DugoutLabDB(`dup-${Math.random().toString(36).slice(2)}`);
    await createTeam({ id: 'a', name: 'A', ageGroup: '12U' }, db);
    const x = await createPlayer({ teamId: 'a', firstName: 'Sam', lastName: 'Rivera', number: '1' }, db);
    const y = await createPlayer({ teamId: 'a', firstName: 'Sam', lastName: 'Rivera', number: '1' }, db);
    expect(x.id).not.toBe(y.id);
    await addObservation({ playerId: x.id, read: 'struggled', source: 'practice' }, db);
    expect(await db.observations.where('playerId').equals(y.id).count()).toBe(0);
    db.close();
  });
});

describe('roster paste', () => {
  it('reads the ways coaches actually type a roster', async () => {
    const { parseRosterLine } = await import('../src/engine/roster');
    expect(parseRosterLine('12 Owen Tate')).toEqual({ number: '12', firstName: 'Owen', lastName: 'Tate' });
    expect(parseRosterLine('#7 Hank Sorensen')).toEqual({ number: '7', firstName: 'Hank', lastName: 'Sorensen' });
    expect(parseRosterLine('Owen Tate')).toEqual({ number: undefined, firstName: 'Owen', lastName: 'Tate' });
    expect(parseRosterLine('Tate, Owen')).toEqual({ number: undefined, firstName: 'Owen', lastName: 'Tate' });
    expect(parseRosterLine('100 Joe')).toEqual({ number: '100', firstName: 'Joe', lastName: '' });
    expect(parseRosterLine('Owen Tate 12')).toEqual({ number: '12', firstName: 'Owen', lastName: 'Tate' });
    expect(parseRosterLine('Mary Ann Smith')).toEqual({ number: undefined, firstName: 'Mary Ann', lastName: 'Smith' });
    expect(parseRosterLine('   ')).toBeNull();
    expect(parseRosterLine('12')).toBeNull();
  });
});
