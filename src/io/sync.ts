/**
 * Automatic two-way sync between the head coach's phone and the other coaches' phones.
 *
 * The head coach turns it on once; that makes a team key (20 characters) and his own coach token.
 * Each invite is a per-coach token tied to a name, written to the server's members list, and
 * carried to that coach's phone in a link (`#/join?t=TEAMKEY&c=TOKEN&n=Name`; the hash fragment
 * never reaches a server log). Every request sends both secrets in headers; the server keeps only
 * their hashes and only serves a team's rows to a member who has not been revoked. Revoking one
 * coach on the head coach's phone shuts off that one phone; the team key never changes.
 *
 * The server is a dumb record store: one row per record with the record's own stamp, a rule that
 * an older copy never overwrites a newer one, and a stamp of which coach wrote it (from the invite,
 * so a phone cannot change whose notes they are).
 *
 * Push: every local record whose stamp is newer than the last push (plus tombstones).
 * Pull: every server row newer than the last pull, merged with the rules backups use
 * (players field by field, everything else newer wins). After a pull that merged something, push
 * again so the union reaches the other phones.
 *
 * What never leaves the head coach's phone: family contacts and the private player fields,
 * parent update history, settings (PIN, sync state), untouched library drills.
 * Helpers push notes, pitch counts, player versions, practice progress and the player fields they
 * may edit (goals, cues, levels); they never push deletions of players, teams or drills.
 *
 * Runs on open, on returning to the foreground, on coming back online, two seconds after any
 * change, and every two minutes while open. iPhone and Android web apps do not run in the
 * background, so "automatic" means the next time a phone opens the app with a signal.
 */
import type { DugoutLabDB } from '../db/db';
import { db as defaultDb, DATA_TABLES, type DataTable, getSettings, saveSettings, changeGate } from '../db/db';
import { mergeRecord, sameRecord, stamp, PRIVATE_PLAYER_FIELDS } from './backup';
import { sha256Hex } from './hash';
import { SYNC_CONFIG, SYNC_AVAILABLE } from '../sync-config';
import type { SyncState } from '../engine/types';
import { newId, nowIso } from '../engine/types';

export interface SyncReport {
  pushed: number;
  pulled: number;
  applied: number;
  deleted: number;
  skipped: boolean;
  revoked?: boolean;
  error?: string;
}

export interface MemberRow {
  team_id: string;
  token_hash: string;
  name: string;
  role?: string | null;
  head: boolean;
  revoked: boolean;
  created_at?: string;
  last_seen?: string | null;
}

export interface Invite {
  /** The per-coach token. Shown nowhere; it rides in the link. */
  token: string;
  tokenHash: string;
  name: string;
  role?: string;
  link: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

/** A 20-character secret without confusable letters. Used for the team key and for every coach token. */
export function makeCode(): string {
  const bytes = new Uint8Array(20);
  const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, '');
}

export function appBase(): string {
  return typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : 'https://doc-jpg.github.io/dugout-lab/';
}

/** The link a coach opens on his own phone. Secrets ride in the hash fragment. */
export function inviteLink(teamKey: string, token: string, name: string, from?: string): string {
  const q = new URLSearchParams({ t: teamKey, c: token, n: name });
  if (from) q.set('f', from);
  return `${appBase()}#/join?${q.toString()}`;
}

export function parseInviteLink(hashOrUrl: string): { teamKey: string; token: string; name: string; from?: string } | null {
  const i = hashOrUrl.indexOf('?');
  if (i < 0) return null;
  const q = new URLSearchParams(hashOrUrl.slice(i + 1));
  const teamKey = normalizeCode(q.get('t') ?? '');
  const token = normalizeCode(q.get('c') ?? '');
  const name = (q.get('n') ?? '').trim();
  if (teamKey.length !== 20 || token.length !== 20 || !name) return null;
  return { teamKey, token, name, from: q.get('f')?.trim() || undefined };
}

// ---------------------------------------------------------------------------

type FetchLike = (input: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }>;
type Config = { url: string; anonKey: string };

function headersFor(state: { teamKey: string; token: string }, config: Config) {
  return { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', 'x-team-key': state.teamKey, 'x-coach-token': state.token };
}
const membersUrl = (config: Config) => `${config.url.replace(/\/$/, '')}/rest/v1/dugout_members`;
const recordsUrl = (config: Config) => `${config.url.replace(/\/$/, '')}/rest/v1/dugout_records`;

/**
 * Head coach: make the team key and this phone's own token, register this phone as the head member.
 * Needs a signal. Everything already on the phone is pushed on the first sync.
 */
export async function startTeamSync(coachName: string, localTeamId: string, device: string, database: DugoutLabDB = defaultDb, fetchImpl: FetchLike = globalThis.fetch as any, config: Config = SYNC_CONFIG): Promise<SyncState> {
  const teamKey = makeCode();
  const token = makeCode();
  const teamId = await sha256Hex(teamKey);
  const state: SyncState = { teamKey, teamId, token, role: 'head', name: coachName, device, enabled: true, localTeamId };
  const res = await fetchImpl(membersUrl(config), { method: 'POST', headers: { ...headersFor(state, config), Prefer: 'return=minimal' }, body: JSON.stringify([{ team_id: teamId, token_hash: await sha256Hex(token), name: coachName, role: 'Head coach', head: true }]) });
  if (!res.ok) throw new Error(`Could not start sync (${res.status}): ${(await res.text()).slice(0, 200)}`);
  await saveSettings({ sync: state }, database);
  return state;
}

/** Head coach: an invite for one person. Writes the member first, so a revoked or unknown token never works. */
export async function makeInvite(name: string, role: string | undefined, database: DugoutLabDB = defaultDb, fetchImpl: FetchLike = globalThis.fetch as any, config: Config = SYNC_CONFIG): Promise<Invite> {
  const state = (await getSettings(database)).sync;
  if (!state?.enabled || state.role !== 'head') throw new Error('Only the head coach phone can invite.');
  const token = makeCode();
  const tokenHash = await sha256Hex(token);
  const res = await fetchImpl(membersUrl(config), { method: 'POST', headers: { ...headersFor(state, config), Prefer: 'return=minimal' }, body: JSON.stringify([{ team_id: state.teamId, token_hash: tokenHash, name: name.trim(), role: role ?? null, head: false }]) });
  if (!res.ok) throw new Error(`Could not make the invite (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { token, tokenHash, name: name.trim(), role, link: inviteLink(state.teamKey, token, name.trim(), state.name) };
}

/** Head coach: everyone on the team's members list, head first. */
export async function listMembers(database: DugoutLabDB = defaultDb, fetchImpl: FetchLike = globalThis.fetch as any, config: Config = SYNC_CONFIG): Promise<MemberRow[]> {
  const state = (await getSettings(database)).sync;
  if (!state?.enabled) return [];
  const res = await fetchImpl(`${membersUrl(config)}?select=*&team_id=eq.${state.teamId}&order=head.desc,created_at.asc`, { headers: headersFor(state, config) });
  if (!res.ok) throw new Error(`Could not read the coaches list (${res.status})`);
  return res.json();
}

/** Head coach: turn one coach's access off (or back on). His phone stops syncing on its next try and says so. */
export async function setMemberRevoked(tokenHash: string, revoked: boolean, database: DugoutLabDB = defaultDb, fetchImpl: FetchLike = globalThis.fetch as any, config: Config = SYNC_CONFIG): Promise<void> {
  const state = (await getSettings(database)).sync;
  if (!state?.enabled || state.role !== 'head') throw new Error('Only the head coach phone can do that.');
  const res = await fetchImpl(`${membersUrl(config)}?team_id=eq.${state.teamId}&token_hash=eq.${tokenHash}`, { method: 'PATCH', headers: { ...headersFor(state, config), Prefer: 'return=minimal' }, body: JSON.stringify({ revoked }) });
  if (!res.ok) throw new Error(`Could not change access (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

/** A coach's phone: accept an invite. The name is locked from here on. The first sync fills the phone. */
export async function joinTeam(invite: { teamKey: string; token: string; name: string; from?: string }, device: string, database: DugoutLabDB = defaultDb): Promise<SyncState> {
  const teamId = await sha256Hex(invite.teamKey);
  const state: SyncState = { teamKey: invite.teamKey, teamId, token: invite.token, role: 'helper', name: invite.name, device, enabled: true };
  await saveSettings({ sync: state, coachName: invite.name, packIdentity: { helperId: `inv-${state.token.slice(0, 8)}`, name: invite.name, teamId: '', from: invite.from, sentAt: nowIso() } }, database);
  return state;
}

export async function stopSync(database: DugoutLabDB = defaultDb): Promise<void> {
  await saveSettings({ sync: undefined }, database);
}

// ---------------------------------------------------------------------------

interface ServerRow {
  team_id: string;
  tbl: string;
  id: string;
  stamp: string;
  data: any;
  deleted: boolean;
  device?: string;
  coach?: string | null;
  server_ts?: string;
}

const HELPER_TOMBSTONE_TABLES: DataTable[] = ['observations', 'variants', 'throwing'];

/** What this phone sends, and in what shape. Returns null for "not this one". */
export function outgoing(table: DataTable, r: any, state: SyncState): any | null {
  if (table === 'parentUpdates') return null;
  if (table === 'drills' && r.source === 'library' && (!r.updatedAt || r.updatedAt === r.createdAt)) return null;
  if (table === 'teams' && state.localTeamId && r.id !== state.localTeamId) return null;
  if (table === 'players') {
    const out = { ...r };
    for (const f of PRIVATE_PLAYER_FIELDS) delete out[f];
    return out;
  }
  return r;
}

let syncing: Promise<SyncReport> | null = null;

/** Push then pull. Safe to call often; concurrent calls share one run. */
export function syncNow(database: DugoutLabDB = defaultDb, fetchImpl?: FetchLike, config: Config = SYNC_CONFIG): Promise<SyncReport> {
  if (syncing) return syncing;
  syncing = runSync(database, fetchImpl ?? (globalThis.fetch as any), config).finally(() => { syncing = null; });
  return syncing;
}

async function runSync(database: DugoutLabDB, fetchImpl: FetchLike, config: Config): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, applied: 0, deleted: 0, skipped: false };
  const settings = await getSettings(database);
  const state = settings.sync;
  if (!state?.enabled || state.revoked || !config.url || !config.anonKey || !fetchImpl) { report.skipped = true; return report; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { report.skipped = true; return report; }
  const headers = headersFor(state, config);
  const base = recordsUrl(config);
  const denied = async (res: { status: number; text: () => Promise<string> }) => {
    // Row-level security answers a revoked or unknown coach with 401/403 on writes; reads come back empty.
    if (res.status === 401 || res.status === 403) {
      const me = await whoAmI();
      if (!me || me.revoked) return true;
    }
    return false;
  };
  const whoAmI = async (): Promise<MemberRow | null> => {
    const res = await fetchImpl(`${membersUrl(config)}?select=*&team_id=eq.${state.teamId}&token_hash=eq.${await sha256Hex(state.token)}`, { headers });
    if (!res.ok) return null;
    const rows: MemberRow[] = await res.json();
    return rows[0] ?? null;
  };
  try {
    const push = async (): Promise<number> => {
      const cur = (await getSettings(database)).sync!;
      const since = cur.lastPush ?? '';
      const rows: ServerRow[] = [];
      let maxStamp = since;
      for (const t of DATA_TABLES) {
        const all: any[] = await (database as any)[t].toArray();
        for (const r of all) {
          const s = stamp(r);
          if (!s || s <= since) continue;
          const data = outgoing(t, r, cur);
          if (!data) continue;
          rows.push({ team_id: cur.teamId, tbl: t, id: r.id, stamp: s, data, deleted: false, device: cur.device });
          if (s > maxStamp) maxStamp = s;
        }
      }
      for (const tomb of await database.tombstones.toArray()) {
        if (tomb.ts <= since) continue;
        if (cur.role === 'helper' && !HELPER_TOMBSTONE_TABLES.includes(tomb.tbl as DataTable)) continue;
        rows.push({ team_id: cur.teamId, tbl: tomb.tbl, id: tomb.id, stamp: tomb.ts, data: null, deleted: true, device: cur.device });
        if (tomb.ts > maxStamp) maxStamp = tomb.ts;
      }
      for (let i = 0; i < rows.length; i += 200) {
        const res = await fetchImpl(base, { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 200)) });
        if (!res.ok) {
          if (await denied(res)) throw Object.assign(new Error('revoked'), { revoked: true });
          throw new Error(`push failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        }
      }
      if (rows.length) await saveSettings({ sync: { ...(await getSettings(database)).sync!, lastPush: maxStamp } }, database);
      return rows.length;
    };

    const pull = async (): Promise<void> => {
      const cur = (await getSettings(database)).sync!;
      const sinceTs = cur.lastPullTs ?? '1970-01-01T00:00:00Z';
      let maxTs = sinceTs;
      let page = 0;
      let sawAny = false;
      for (;;) {
        const url = `${base}?select=*&team_id=eq.${cur.teamId}&server_ts=gt.${encodeURIComponent(sinceTs)}&order=server_ts.asc,tbl.asc,id.asc&limit=500&offset=${page * 500}`;
        const res = await fetchImpl(url, { headers });
        if (!res.ok) {
          if (await denied(res)) throw Object.assign(new Error('revoked'), { revoked: true });
          throw new Error(`pull failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        }
        const batch: ServerRow[] = await res.json();
        report.pulled += batch.length;
        sawAny = sawAny || batch.length > 0;
        changeGate.quiet = true;
        await database.transaction('rw', database.tables, async () => {
          for (const row of batch) {
            if (row.server_ts && row.server_ts > maxTs) maxTs = row.server_ts;
            if (row.device && row.device === cur.device) continue; // our own rows coming back
            if (!DATA_TABLES.includes(row.tbl as DataTable)) continue;
            const t = row.tbl as DataTable;
            const table = (database as any)[t];
            if (row.deleted) {
              const existing = await table.get(row.id);
              if (existing && stamp(existing) <= row.stamp) { await table.delete(row.id); report.deleted += 1; }
              continue;
            }
            if (!row.data) continue;
            const data = t === 'observations' && row.coach ? { ...row.data, by: row.coach } : row.data;
            const existing = await table.get(row.id);
            const merged = existing ? mergeRecord(t, existing, data) : data;
            if (!existing || !sameRecord(merged, existing)) { await table.put(merged); report.applied += 1; }
          }
        });
        changeGate.quiet = false;
        if (batch.length < 500) break;
        page += 1;
      }
      // A helper phone that just joined points itself at the team it received.
      const s2 = await getSettings(database);
      if (s2.sync?.role === 'helper') {
        const teams = await database.teams.toArray();
        const team = teams.find((t) => t.id === s2.teamId) ?? teams[0];
        if (team && (s2.teamId !== team.id || s2.packIdentity?.teamId !== team.id)) await saveSettings({ teamId: team.id, packIdentity: s2.packIdentity ? { ...s2.packIdentity, teamId: team.id } : undefined }, database);
      }
      const fresh = (await getSettings(database)).sync!;
      await saveSettings({ sync: { ...fresh, lastPullTs: maxTs, lastSyncAt: nowIso(), lastError: undefined } }, database);
      void sawAny;
    };

    report.pushed = await push();
    await pull();
    // A pull that merged something (a goal union, say) may have produced a record newer than what
    // the server holds; send it back now so the other phones get it on their next sync.
    if (report.applied > 0) report.pushed += await push();
    // A revoked coach whose writes were empty would never hit a 401; ask once in a while.
    if (state.role === 'helper' && report.pushed === 0 && report.pulled === 0) {
      const me = await whoAmI();
      if (me?.revoked) throw Object.assign(new Error('revoked'), { revoked: true });
    }
  } catch (e: any) {
    changeGate.quiet = false;
    if (e?.revoked) {
      report.revoked = true;
      report.error = 'Your access was turned off by the head coach.';
      const fresh = (await getSettings(database)).sync;
      if (fresh) await saveSettings({ sync: { ...fresh, revoked: true, lastError: report.error } }, database);
      return report;
    }
    report.error = e?.message ?? String(e);
    const fresh = (await getSettings(database)).sync;
    if (fresh) await saveSettings({ sync: { ...fresh, lastError: report.error } }, database);
  }
  return report;
}

/** Wire the triggers in a browser. Returns a stop function. */
export function startSyncLoop(database: DugoutLabDB = defaultDb): () => void {
  if (!SYNC_AVAILABLE || typeof window === 'undefined') return () => undefined;
  let timer: number | undefined;
  const kick = (delay = 0) => { window.clearTimeout(timer); timer = window.setTimeout(() => { syncNow(database).catch(() => undefined); }, delay); };
  const onChange = () => kick(2000);
  const onVisible = () => { if (document.visibilityState === 'visible') kick(300); };
  const onOnline = () => kick(300);
  window.addEventListener('dugout-lab:changed', onChange);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  const interval = window.setInterval(() => kick(0), 120000);
  kick(500);
  return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener('dugout-lab:changed', onChange); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); };
}

export function deviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'computer';
  return `${kind}-${newId().slice(0, 6)}`;
}
