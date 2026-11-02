/**
 * Dugout Lab storage: one IndexedDB database named "dugout-lab" (Dugout Dad uses "dugout-dad";
 * the two never touch each other even when both run in the same browser).
 */
import Dexie, { type Table } from 'dexie';
import type { Team, Player, Drill, DrillVariant, Practice, Observation, ThrowingEntry, Settings } from '../engine/types';
import { DEFAULT_SETTINGS, newId, nowIso } from '../engine/types';
import { LIBRARY_DRILLS, LIBRARY_VERSION } from '../data/drills';

export interface Meta {
  key: string;
  value: unknown;
}

export class DugoutLabDB extends Dexie {
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  drills!: Table<Drill, string>;
  variants!: Table<DrillVariant, string>;
  practices!: Table<Practice, string>;
  observations!: Table<Observation, string>;
  throwing!: Table<ThrowingEntry, string>;
  settings!: Table<Settings, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'dugout-lab') {
    super(name);
    this.version(1).stores({
      teams: 'id, name',
      players: 'id, teamId, lastName, status',
      drills: 'id, category, source, name',
      variants: 'id, drillId, playerId',
      practices: 'id, teamId, date, status',
      observations: 'id, practiceId, playerId, ts, category',
      throwing: 'id, playerId, date',
      settings: 'id',
      meta: 'key'
    });
  }
}

export const db = new DugoutLabDB();

/** Seed or refresh the shipped drill library. Custom drills and edits to library drills are kept. */
export async function seedLibrary(database: DugoutLabDB = db): Promise<{ added: number; updated: number }> {
  const stamp = await database.meta.get('libraryVersion');
  const existing = new Map((await database.drills.where('source').equals('library').toArray()).map((d) => [d.id, d]));
  let added = 0;
  let updated = 0;
  const ts = nowIso();
  await database.transaction('rw', database.drills, database.meta, async () => {
    for (const d of LIBRARY_DRILLS) {
      const cur = existing.get(d.id);
      if (!cur) {
        await database.drills.put({ ...d, createdAt: ts, updatedAt: ts });
        added += 1;
      } else if (!cur.updatedAt || cur.updatedAt === cur.createdAt) {
        // Untouched library drill: refresh its text when the library version moves.
        if ((stamp?.value as number | undefined) !== LIBRARY_VERSION) {
          await database.drills.put({ ...d, createdAt: cur.createdAt, updatedAt: cur.createdAt, archived: cur.archived });
          updated += 1;
        }
      }
    }
    await database.meta.put({ key: 'libraryVersion', value: LIBRARY_VERSION });
  });
  return { added, updated };
}

export async function getSettings(database: DugoutLabDB = db): Promise<Settings> {
  const s = await database.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>, database: DugoutLabDB = db): Promise<Settings> {
  const cur = await getSettings(database);
  const next = { ...cur, ...patch, id: 'settings' as const };
  await database.settings.put(next);
  return next;
}

// ---------------------------------------------------------------------------
// Teams and players
// ---------------------------------------------------------------------------

export async function createTeam(input: Partial<Team> & { name: string; ageGroup: Team['ageGroup'] }, database: DugoutLabDB = db): Promise<Team> {
  const ts = nowIso();
  const team: Team = { id: input.id ?? newId(), priorities: [], createdAt: ts, updatedAt: ts, ...input };
  await database.teams.put(team);
  return team;
}

export async function updateTeam(id: string, patch: Partial<Team>, database: DugoutLabDB = db): Promise<void> {
  await database.teams.update(id, { ...patch, updatedAt: nowIso() });
}

export function playerName(p?: Player | null, style: 'full' | 'short' | 'first' = 'full'): string {
  if (!p) return 'Unknown';
  const first = p.firstName?.trim() ?? '';
  const last = p.lastName?.trim() ?? '';
  if (style === 'first') return first || last || 'Unknown';
  if (style === 'short') return first ? `${first}${last ? ' ' + last[0] + '.' : ''}` : last || 'Unknown';
  return [first, last].filter(Boolean).join(' ') || 'Unknown';
}

export async function createPlayer(input: Partial<Player> & { teamId: string; firstName: string; lastName: string }, database: DugoutLabDB = db): Promise<Player> {
  const ts = nowIso();
  const p: Player = {
    id: input.id ?? newId(),
    positions: [],
    status: 'active',
    strengths: [],
    challenges: [],
    goals: [],
    cues: [],
    approaches: [],
    levels: {},
    statuses: {},
    createdAt: ts,
    updatedAt: ts,
    ...input
  };
  await database.players.put(p);
  return p;
}

export async function updatePlayer(id: string, patch: Partial<Player>, database: DugoutLabDB = db): Promise<void> {
  await database.players.update(id, { ...patch, updatedAt: nowIso() });
}

/** Add a goal to a player. */
export async function addGoal(playerId: string, goal: Omit<Player['goals'][number], 'id' | 'createdAt' | 'status'> & { status?: 'active' | 'done' | 'paused' }, database: DugoutLabDB = db) {
  const p = await database.players.get(playerId);
  if (!p) throw new Error('Player not found');
  const g = { id: newId(), createdAt: nowIso(), status: 'active' as const, ...goal };
  await database.players.update(playerId, { goals: [...p.goals, g], updatedAt: nowIso() });
  return g;
}

// ---------------------------------------------------------------------------
// Drills and variants
// ---------------------------------------------------------------------------

export async function createDrill(input: Omit<Drill, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { id?: string; source?: Drill['source'] }, database: DugoutLabDB = db): Promise<Drill> {
  const ts = nowIso();
  const d: Drill = { id: input.id ?? newId(), source: 'custom', ...input, createdAt: ts, updatedAt: ts };
  await database.drills.put(d);
  return d;
}

export async function updateDrill(id: string, patch: Partial<Drill>, database: DugoutLabDB = db): Promise<void> {
  await database.drills.update(id, { ...patch, updatedAt: nowIso() });
}

/** Copy a drill so the coach can edit freely without losing the library version. */
export async function duplicateDrill(id: string, database: DugoutLabDB = db): Promise<Drill> {
  const d = await database.drills.get(id);
  if (!d) throw new Error('Drill not found');
  const { id: _old, createdAt: _c, updatedAt: _u, ...rest } = d;
  return createDrill({ ...rest, name: `${d.name} (my version)`, source: 'custom' }, database);
}

export async function saveVariant(input: Omit<DrillVariant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, database: DugoutLabDB = db): Promise<DrillVariant> {
  const ts = nowIso();
  const existing = input.id ? await database.variants.get(input.id) : undefined;
  const v: DrillVariant = { ...(existing ?? {}), ...input, id: input.id ?? newId(), createdAt: existing?.createdAt ?? ts, updatedAt: ts } as DrillVariant;
  await database.variants.put(v);
  return v;
}

// ---------------------------------------------------------------------------
// Practices and observations
// ---------------------------------------------------------------------------

export async function savePractice(p: Practice, database: DugoutLabDB = db): Promise<void> {
  await database.practices.put({ ...p, updatedAt: nowIso() });
}

export async function updatePractice(id: string, patch: Partial<Practice>, database: DugoutLabDB = db): Promise<void> {
  await database.practices.update(id, { ...patch, updatedAt: nowIso() });
}

export async function addObservation(input: Omit<Observation, 'id' | 'ts'> & { ts?: string }, database: DugoutLabDB = db): Promise<Observation> {
  const o: Observation = { id: newId(), ts: nowIso(), ...input };
  await database.observations.put(o);
  return o;
}

export async function addThrowing(input: Omit<ThrowingEntry, 'id' | 'createdAt'>, database: DugoutLabDB = db): Promise<ThrowingEntry> {
  const t: ThrowingEntry = { id: newId(), createdAt: nowIso(), ...input };
  await database.throwing.put(t);
  return t;
}

// ---------------------------------------------------------------------------
// Storage health (same approach as Dugout Dad: installed on the home screen counts as safe)
// ---------------------------------------------------------------------------

export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean((window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export interface StorageHealth {
  persisted: boolean | null;
  usageBytes: number | null;
  installed: boolean;
  verdict: 'safe' | 'install' | 'unknown';
  message: string;
}

export async function storageHealth(): Promise<StorageHealth> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  try {
    if (nav?.storage?.persisted) persisted = await nav.storage.persisted();
    if (nav?.storage?.estimate) usageBytes = (await nav.storage.estimate()).usage ?? null;
  } catch {
    /* ignore */
  }
  const installed = isInstalled();
  if (installed || persisted === true) {
    return { persisted, usageBytes, installed, verdict: 'safe', message: installed ? 'Installed on the home screen: your notes and practices stay on this phone. Back up after a few practices.' : 'Storage is persistent on this device. Back up after a few practices.' };
  }
  return { persisted, usageBytes, installed, verdict: 'install', message: 'Running in a browser tab. Add Dugout Lab to your home screen (Share, Add to Home Screen) so the browser cannot clear your notes, and back up after a few practices.' };
}

export async function requestPersistence(): Promise<boolean | null> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  try {
    if (nav?.storage?.persist) return await nav.storage.persist();
  } catch {
    /* ignore */
  }
  return null;
}
