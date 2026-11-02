import { describe, it, expect } from 'vitest';
import { DugoutLabDB, seedLibrary, createTeam, createPlayer, updatePlayer, addObservation, addThrowing, saveVariant, deleteObservation, deletePlayer, getSettings, savePractice, updateDrill } from '../src/db/db';
import { startTeamSync, makeInvite, joinTeam, syncNow, listMembers, setMemberRevoked, inviteLink, parseInviteLink, makeCode, outgoing } from '../src/io/sync';
import { SYNC_CONFIG } from '../src/sync-config';
import { sha256Hex } from '../src/io/hash';
import { DEFAULT_SETTINGS, nowIso, type Practice } from '../src/engine/types';

let n = 0;
const fresh = () => new DugoutLabDB('sync-' + Date.now() + '-' + n++);
const ts = nowIso();

/**
 * An in-memory stand-in for the server with the same rules as docs/sync-schema.sql:
 * team isolation by key hash, membership by token hash, head-only invites and revocation,
 * older copy never overwrites, server stamps server_ts and the writing coach's invite name.
 */
function fakeServer() {
  const members = new Map<string, any>();
  const rows = new Map<string, any>();
  let clock = 1;
  const nextTs = () => new Date(Date.UTC(2026, 10, 2, 0, 0, clock++)).toISOString();
  const fetchImpl = async (url: string, init: any = {}) => {
    const h = init.headers ?? {};
    const teamId = await sha256Hex(h['x-team-key'] ?? '');
    const tokenHash = await sha256Hex(h['x-coach-token'] ?? '');
    const hasKey = (h['x-team-key'] ?? '').length >= 16 && (h['x-coach-token'] ?? '').length >= 16;
    const me = members.get(`${teamId}|${tokenHash}`);
    const isMember = hasKey && me && !me.revoked;
    const isHead = isMember && me.head;
    const u = new URL(url, 'https://x');
    const deny = { ok: false, status: 401, json: async () => ({}), text: async () => 'new row violates row-level security policy' };
    const okEmpty = { ok: true, status: 200, json: async () => [], text: async () => '' };
    if (u.pathname.endsWith('/dugout_members')) {
      if (init.method === 'POST') {
        const teamIsNew = ![...members.values()].some((m) => m.team_id === teamId);
        for (const m of JSON.parse(init.body)) {
          const allowed = m.team_id === teamId && (isHead || (teamIsNew && m.head && m.token_hash === tokenHash));
          if (!allowed) return deny;
          members.set(`${m.team_id}|${m.token_hash}`, { role: null, revoked: false, last_seen: null, ...m, created_at: nextTs() });
        }
        return { ok: true, status: 201, json: async () => [], text: async () => '' };
      }
      if (init.method === 'PATCH') {
        if (!isHead) return deny;
        const th = (u.searchParams.get('token_hash') ?? '').slice(3);
        const cur = members.get(`${teamId}|${th}`);
        if (cur) Object.assign(cur, JSON.parse(init.body));
        return { ok: true, status: 204, json: async () => [], text: async () => '' };
      }
      if (!hasKey) return okEmpty;
      let out = [...members.values()].filter((m) => m.team_id === teamId);
      const th = u.searchParams.get('token_hash');
      if (th) out = out.filter((m) => m.token_hash === th.slice(3));
      return { ok: true, status: 200, json: async () => out, text: async () => '' };
    }
    if (init.method === 'POST') {
      if (!isMember) return deny;
      for (const r of JSON.parse(init.body)) {
        if (r.team_id !== teamId) return deny;
        const key = `${r.team_id}|${r.tbl}|${r.id}`;
        const cur = rows.get(key);
        if (cur && r.stamp <= cur.stamp) continue;
        rows.set(key, { ...r, coach: me.name, server_ts: nextTs() });
        me.last_seen = nextTs();
      }
      return { ok: true, status: 201, json: async () => [], text: async () => '' };
    }
    if (!isMember) return okEmpty;
    const gt = decodeURIComponent((u.searchParams.get('server_ts') ?? 'gt.1970').slice(3));
    const offset = Number(u.searchParams.get('offset') ?? 0);
    const out = [...rows.values()].filter((r) => r.team_id === teamId && r.server_ts > gt).sort((a, b) => a.server_ts.localeCompare(b.server_ts)).slice(offset, offset + 500);
    return { ok: true, status: 200, json: async () => out, text: async () => '' };
  };
  return { fetchImpl, rows, members };
}

const cfg = { url: 'https://fake', anonKey: 'k' };

async function headPhone(server: ReturnType<typeof fakeServer>) {
  const head = fresh();
  await seedLibrary(head);
  await head.settings.put({ ...DEFAULT_SETTINGS, coachName: 'Deren' });
  const team = await createTeam({ id: 't', name: 'Rattlers', ageGroup: '13U' }, head);
  await head.settings.update('settings', { teamId: team.id });
  await createPlayer({ id: 'j', teamId: 't', firstName: 'Johnny', lastName: 'Q', cues: ['Stay down'], responseNotes: 'private', confidenceNotes: 'private too', parents: [{ name: 'Mom', phone: '555' }] }, head);
  await createPlayer({ id: 'h', teamId: 't', firstName: 'Hudson', lastName: 'F' }, head);
  const state = await startTeamSync('Deren', 't', 'deren-phone', head, server.fetchImpl, cfg);
  return { head, state };
}

async function helperPhone(server: ReturnType<typeof fakeServer>, head: DugoutLabDB, name: string, role?: string) {
  const invite = await makeInvite(name, role, head, server.fetchImpl, cfg);
  const phone = fresh();
  await seedLibrary(phone);
  await joinTeam(parseInviteLink(invite.link)!, `${name.toLowerCase()}-phone`, phone);
  return { phone, invite };
}

describe('invite links', () => {
  it('carry the team key, the coach token and the name in the hash fragment, and parse back', () => {
    const t = makeCode();
    const c = makeCode();
    expect(t).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{20}$/);
    const link = inviteLink(t, c, 'Aaron Fox', 'Deren');
    expect(link).toContain('#/join?');
    expect(link.indexOf('?')).toBeGreaterThan(link.indexOf('#'));
    const p = parseInviteLink(link.slice(link.indexOf('#')));
    expect(p).toEqual({ teamKey: t, token: c, name: 'Aaron Fox', from: 'Deren' });
    expect(parseInviteLink('#/join?t=short&c=x&n=A')).toBeNull();
  });
  it('never sends private player fields, parent updates or untouched library drills', () => {
    const state = { teamKey: 'k', teamId: 'id', token: 'c', role: 'head', name: 'Deren', device: 'd', enabled: true } as any;
    const p = outgoing('players', { id: 'j', firstName: 'J', parents: [{ name: 'Mom' }], responseNotes: 'x', share: { update: true } }, state);
    expect(p.parents).toBeUndefined();
    expect(p.responseNotes).toBeUndefined();
    expect(p.share).toBeUndefined();
    expect(p.firstName).toBe('J');
    expect(outgoing('parentUpdates', { id: 'u' }, state)).toBeNull();
    expect(outgoing('drills', { id: 'lib-hit-001', source: 'library', createdAt: ts, updatedAt: ts }, state)).toBeNull();
    expect(outgoing('drills', { id: 'lib-hit-001', source: 'library', createdAt: ts, updatedAt: '2027-01-01T00:00:00.000Z' }, state)).not.toBeNull();
    expect(outgoing('drills', { id: 'mine', source: 'custom', createdAt: ts, updatedAt: ts }, state)).not.toBeNull();
  });
});

describe('automatic sync between a head coach and a helper (fake server with the schema rules)', () => {
  it('Aaron opens the link: his phone is Aaron, gets the team and roster, and his notes come back stamped Aaron by the server', async () => {
    const server = fakeServer();
    const { head } = await headPhone(server);
    const r0 = await syncNow(head, server.fetchImpl, cfg);
    expect(r0.error).toBeUndefined();
    expect(r0.pushed).toBeGreaterThanOrEqual(3); // team + two players
    const { phone: aaron } = await helperPhone(server, head, 'Aaron', 'Assistant');
    const s = await getSettings(aaron);
    expect(s.sync?.role).toBe('helper');
    expect(s.packIdentity?.name).toBe('Aaron');
    expect(s.coachName).toBe('Aaron');
    const r1 = await syncNow(aaron, server.fetchImpl, cfg);
    expect(r1.error).toBeUndefined();
    expect((await aaron.teams.get('t'))?.name).toBe('Rattlers');
    expect((await aaron.players.get('j'))?.firstName).toBe('Johnny');
    expect((await getSettings(aaron)).teamId).toBe('t');
    expect((await getSettings(aaron)).packIdentity?.teamId).toBe('t');
    // Nothing private reached him
    const j = await aaron.players.get('j');
    expect(j?.parents).toBeUndefined();
    expect(j?.responseNotes).toBeUndefined();
    expect([...server.rows.values()].some((r) => JSON.stringify(r).includes('private'))).toBe(false);
    // Aaron takes a note (even one his phone tried to tag as Deren) and it lands on Deren's phone as Aaron
    await addObservation({ playerId: 'j', read: 'got_it', category: 'infield', source: 'practice' }, aaron);
    await aaron.observations.put({ id: 'o-tampered', playerId: 'h', read: 'hustle', source: 'practice', by: 'Deren', ts: nowIso(), createdAt: nowIso() } as any);
    await syncNow(aaron, server.fetchImpl, cfg);
    const r2 = await syncNow(head, server.fetchImpl, cfg);
    expect(r2.applied).toBe(2);
    const notes = await head.observations.toArray();
    expect(notes.length).toBe(2);
    expect(notes.every((o) => o.by === 'Aaron')).toBe(true);
    // Deren's private fields are still on his phone after his own stripped rows came back
    const jh = await head.players.get('j');
    expect(jh?.responseNotes).toBe('private');
    expect(jh?.parents?.[0].name).toBe('Mom');
    head.close(); aaron.close();
  });

  it('a goal on one phone and a cue on the other both survive; roster changes reach the helper; nothing is overwritten', async () => {
    const server = fakeServer();
    const { head } = await headPhone(server);
    await syncNow(head, server.fetchImpl, cfg);
    const { phone: aaron } = await helperPhone(server, head, 'Aaron');
    await syncNow(aaron, server.fetchImpl, cfg);
    await updatePlayer('j', { goals: [{ id: 'g1', category: 'infield', text: 'Backhand footwork', kind: 'technical', status: 'active', createdAt: ts }] }, head);
    await new Promise((r) => setTimeout(r, 5));
    await updatePlayer('j', { cues: ['Stay down', 'Glove out front'], levels: { infield: 3 } }, aaron);
    await syncNow(aaron, server.fetchImpl, cfg);
    await syncNow(head, server.fetchImpl, cfg);
    await syncNow(aaron, server.fetchImpl, cfg);
    for (const dbx of [head, aaron]) {
      const j = (await dbx.players.get('j'))!;
      expect(j.goals.map((g) => g.id)).toEqual(['g1']);
      expect(j.cues).toContain('Glove out front');
      expect(j.cues).toContain('Stay down');
      expect(j.levels.infield).toBe(3);
    }
    // Deren adds a kid and a plan; Aaron gets both without doing anything
    await createPlayer({ id: 'k', teamId: 't', firstName: 'Knox', lastName: 'T' }, head);
    const plan: Practice = { id: 'plan', teamId: 't', date: '2026-11-05', status: 'planned', inputs: { teamId: 't', presentIds: ['j', 'h', 'k'], absentIds: [], durationMin: 60, coaches: 2, equipment: [], space: 'full', indoor: false, teamPriorities: [], playerPriorities: {}, noThrowingIds: [] }, blocks: [], rationale: [], createdAt: ts, updatedAt: ts };
    await savePractice(plan, head);
    await syncNow(head, server.fetchImpl, cfg);
    await syncNow(aaron, server.fetchImpl, cfg);
    expect((await aaron.players.get('k'))?.firstName).toBe('Knox');
    expect((await aaron.practices.get('plan'))?.status).toBe('planned');
    // Same again changes nothing
    const again = await syncNow(aaron, server.fetchImpl, cfg);
    expect(again.pushed).toBe(0);
    expect(again.applied).toBe(0);
    head.close(); aaron.close();
  });

  it('deletions travel as tombstones, but a helper cannot delete the roster; pitch counts, versions and edited drills sync', async () => {
    const server = fakeServer();
    const { head } = await headPhone(server);
    await syncNow(head, server.fetchImpl, cfg);
    const { phone: aaron } = await helperPhone(server, head, 'Aaron');
    await syncNow(aaron, server.fetchImpl, cfg);
    const o = await addObservation({ playerId: 'j', read: 'struggled', source: 'practice' }, aaron);
    await addThrowing({ playerId: 'h', date: '2026-11-01', pitches: 45, kind: 'game', source: 'manual' }, aaron);
    await saveVariant({ drillId: 'lib-inf-001', playerId: 'j', name: 'Soft balls', objective: 'Stationary first' } as any, aaron);
    await updateDrill('lib-inf-001', { cues: ['Stay down', 'Glove out front'] }, head);
    await syncNow(aaron, server.fetchImpl, cfg);
    await syncNow(head, server.fetchImpl, cfg);
    await syncNow(aaron, server.fetchImpl, cfg);
    expect((await head.throwing.toArray())[0]?.pitches).toBe(45);
    expect((await head.variants.toArray())[0]?.name).toBe('Soft balls');
    expect((await aaron.drills.get('lib-inf-001'))?.cues).toContain('Glove out front');
    // Aaron removes his own note: gone on Deren's phone. Aaron deletes a player: ignored on Deren's phone.
    await deleteObservation(o.id, aaron);
    await deletePlayer('h', aaron);
    await syncNow(aaron, server.fetchImpl, cfg);
    await syncNow(head, server.fetchImpl, cfg);
    expect(await head.observations.get(o.id)).toBeUndefined();
    expect((await head.players.get('h'))?.firstName).toBe('Hudson');
    // Deren removes a player: gone on Aaron's phone on his next sync. Hudson, whom Aaron removed
    // only on his own phone, comes back the next time Deren touches him.
    await deletePlayer('j', head);
    await syncNow(head, server.fetchImpl, cfg);
    await syncNow(aaron, server.fetchImpl, cfg);
    expect(await aaron.players.get('j')).toBeUndefined();
    expect(await aaron.players.get('h')).toBeUndefined();
    await updatePlayer('h', { number: '24' }, head);
    await syncNow(head, server.fetchImpl, cfg);
    await syncNow(aaron, server.fetchImpl, cfg);
    expect((await aaron.players.get('h'))?.firstName).toBe('Hudson');
    head.close(); aaron.close();
  });

  it('revoking Aaron stops his phone and says so; a guest token never works for another team; only the head coach can invite', async () => {
    const server = fakeServer();
    const { head } = await headPhone(server);
    await syncNow(head, server.fetchImpl, cfg);
    const { phone: aaron, invite } = await helperPhone(server, head, 'Aaron');
    const { phone: mark } = await helperPhone(server, head, 'Mark', 'Parent coach');
    await syncNow(aaron, server.fetchImpl, cfg);
    await syncNow(mark, server.fetchImpl, cfg);
    const list = await listMembers(head, server.fetchImpl, cfg);
    expect(list.map((m) => m.name)).toEqual(['Deren', 'Aaron', 'Mark']);
    expect(list[0].head).toBe(true);
    await setMemberRevoked(invite.tokenHash, true, head, server.fetchImpl, cfg);
    await addObservation({ playerId: 'j', read: 'got_it', source: 'practice' }, aaron);
    const r = await syncNow(aaron, server.fetchImpl, cfg);
    expect(r.revoked).toBe(true);
    expect((await getSettings(aaron)).sync?.revoked).toBe(true);
    expect([...server.rows.values()].some((rw) => rw.tbl === 'observations')).toBe(false);
    const r2 = await syncNow(aaron, server.fetchImpl, cfg);
    expect(r2.skipped).toBe(true);
    // Mark still works, and he cannot invite anyone
    await addObservation({ playerId: 'h', read: 'hustle', source: 'practice' }, mark);
    expect((await syncNow(mark, server.fetchImpl, cfg)).error).toBeUndefined();
    await syncNow(head, server.fetchImpl, cfg);
    expect((await head.observations.toArray()).map((o) => o.by)).toEqual(['Mark']);
    await expect(makeInvite('Someone', undefined, mark, server.fetchImpl, cfg)).rejects.toThrow();
    // Turning Aaron back on works from the head phone
    await setMemberRevoked(invite.tokenHash, false, head, server.fetchImpl, cfg);
    await aaron.settings.update('settings', { sync: { ...(await getSettings(aaron)).sync!, revoked: false } });
    expect((await syncNow(aaron, server.fetchImpl, cfg)).error).toBeUndefined();
    // Another team's key sees nothing
    const stranger = fresh();
    await stranger.settings.put({ ...DEFAULT_SETTINGS, sync: { teamKey: makeCode(), teamId: 'x', token: makeCode(), role: 'helper', name: 'X', device: 'x', enabled: true } });
    const rs = await syncNow(stranger, server.fetchImpl, cfg);
    expect(rs.pulled).toBe(0);
    head.close(); aaron.close(); mark.close(); stranger.close();
  });

  it('without sync turned on the app just works offline (sync skipped)', async () => {
    const phone = fresh();
    await createTeam({ name: 'T', ageGroup: '12U' }, phone);
    const r = await syncNow(phone, fakeServer().fetchImpl, cfg);
    expect(r.skipped).toBe(true);
    phone.close();
  });
});

const LIVE = (globalThis as any).process?.env?.LIVE_SYNC === '1';
describe.skipIf(!LIVE)('live Supabase round trip', () => {
  it('a head phone and a helper phone meet at the real server; the server stamps the helper\'s name; revocation sticks', async () => {
    const head = fresh();
    await head.settings.put({ ...DEFAULT_SETTINGS, coachName: 'Test Head' });
    await createTeam({ id: 'live-t', name: 'Live Test', ageGroup: '12U' }, head);
    await createPlayer({ id: 'live-j', teamId: 'live-t', firstName: 'Live', lastName: 'Kid', responseNotes: 'private' }, head);
    await startTeamSync('Test Head', 'live-t', 'test-head', head, globalThis.fetch as any, SYNC_CONFIG);
    const r1 = await syncNow(head, globalThis.fetch as any, SYNC_CONFIG);
    expect(r1.error).toBeUndefined();
    const invite = await makeInvite('Test Helper', 'Assistant', head, globalThis.fetch as any, SYNC_CONFIG);
    const helper = fresh();
    await joinTeam(parseInviteLink(invite.link)!, 'test-helper', helper);
    const r2 = await syncNow(helper, globalThis.fetch as any, SYNC_CONFIG);
    expect(r2.error).toBeUndefined();
    expect((await helper.players.get('live-j'))?.firstName).toBe('Live');
    expect((await helper.players.get('live-j'))?.responseNotes).toBeUndefined();
    await addObservation({ playerId: 'live-j', read: 'got_it', source: 'practice', by: 'Wrong' }, helper);
    expect((await syncNow(helper, globalThis.fetch as any, SYNC_CONFIG)).error).toBeUndefined();
    const r3 = await syncNow(head, globalThis.fetch as any, SYNC_CONFIG);
    expect(r3.error).toBeUndefined();
    expect((await head.observations.toArray()).map((o) => o.by)).toEqual(['Test Helper']);
    await setMemberRevoked(invite.tokenHash, true, head, globalThis.fetch as any, SYNC_CONFIG);
    await addObservation({ playerId: 'live-j', read: 'hustle', source: 'practice' }, helper);
    const r4 = await syncNow(helper, globalThis.fetch as any, SYNC_CONFIG);
    expect(r4.revoked).toBe(true);
    head.close(); helper.close();
  }, 60000);
});
