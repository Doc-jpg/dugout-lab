/**
 * Backup and restore.
 *
 * A backup is a ZIP of pretty-printed JSON, one file per table, plus manifest.json with a
 * SHA-256 for every file. Restore has two modes:
 *   merge   (default): add what is missing, replace a record only when the backup's copy is newer,
 *                      and report every record where this device had a newer copy (kept, not lost)
 *   replace: wipe this device's data and load the backup (recovery, or a safe test environment)
 *
 * Also reads a Dugout Dad weekend archive to import a roster (explicit, previewed, confirmed).
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { sha256Hex } from './hash';
import type { DugoutLabDB } from '../db/db';
import { db as defaultDb } from '../db/db';
import type { Team, Player, Drill, DrillVariant, Practice, Observation, ThrowingEntry, Settings } from '../engine/types';
import { nowIso } from '../engine/types';

export const BACKUP_FORMAT = 'dugout-lab-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  files: Record<string, { sha256: string; bytes: number; records: number }>;
}

export interface BackupContents {
  manifest: BackupManifest;
  teams: Team[];
  players: Player[];
  drills: Drill[];
  variants: DrillVariant[];
  practices: Practice[];
  observations: Observation[];
  throwing: ThrowingEntry[];
  settings: Settings | null;
}

export class BackupFormatError extends Error {}

const TABLES = ['teams', 'players', 'drills', 'variants', 'practices', 'observations', 'throwing'] as const;

export async function buildBackup(appVersion: string, database: DugoutLabDB = defaultDb): Promise<{ bytes: Uint8Array; fileName: string; manifest: BackupManifest }> {
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = await (database as any)[t].toArray();
    files[`${t}.json`] = json(rows);
    counts[`${t}.json`] = rows.length;
  }
  const settings = await database.settings.get('settings');
  files['settings.json'] = json(settings ?? null);
  counts['settings.json'] = settings ? 1 : 0;
  const manifest: BackupManifest = { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, appVersion, createdAt: nowIso(), files: {} };
  for (const [name, bytes] of Object.entries(files)) manifest.files[name] = { sha256: await sha256Hex(bytes), bytes: bytes.length, records: counts[name] ?? 0 };
  files['manifest.json'] = json(manifest);
  const bytes = zipSync(files, { level: 6 });
  const stamp = manifest.createdAt.slice(0, 16).replace(/[:T]/g, '-');
  return { bytes, fileName: `dugout-lab-backup-${stamp}.zip`, manifest };
}

export async function readBackup(bytes: Uint8Array): Promise<BackupContents> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupFormatError('That file is not a ZIP archive.');
  }
  const m = entries['manifest.json'];
  if (!m) throw new BackupFormatError('manifest.json is missing; this is not a Dugout Lab backup.');
  const manifest = JSON.parse(strFromU8(m)) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT) throw new BackupFormatError(`Unknown format "${manifest.format}". A Dugout Dad weekend archive goes under "Import roster from Dugout Dad".`);
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) throw new BackupFormatError('This backup was made by a newer Dugout Lab. Update the app first.');
  for (const [name, info] of Object.entries(manifest.files)) {
    const data = entries[name];
    if (!data) throw new BackupFormatError(`${name} is missing from the backup.`);
    const h = await sha256Hex(data);
    if (h !== info.sha256) throw new BackupFormatError(`${name} does not match its checksum; the file may be damaged.`);
  }
  const read = <T>(name: string): T => JSON.parse(strFromU8(entries[name]));
  return {
    manifest,
    teams: read('teams.json'),
    players: read('players.json'),
    drills: read('drills.json'),
    variants: read('variants.json'),
    practices: read('practices.json'),
    observations: read('observations.json'),
    throwing: read('throwing.json'),
    settings: read('settings.json')
  };
}

export interface RestoreReport {
  mode: 'merge' | 'replace';
  added: Record<string, number>;
  updated: Record<string, number>;
  unchanged: Record<string, number>;
  /** Records where this device had a newer copy; kept as they were. */
  keptNewerHere: Array<{ table: string; id: string; here: string; backup: string }>;
}

function stamp(r: any): string {
  return r.updatedAt ?? r.ts ?? r.createdAt ?? '';
}

export async function restoreBackup(contents: BackupContents, mode: 'merge' | 'replace', database: DugoutLabDB = defaultDb): Promise<RestoreReport> {
  const report: RestoreReport = { mode, added: {}, updated: {}, unchanged: {}, keptNewerHere: [] };
  const tables = [database.teams, database.players, database.drills, database.variants, database.practices, database.observations, database.throwing, database.settings];
  await database.transaction('rw', tables, async () => {
    if (mode === 'replace') for (const t of tables) await t.clear();
    for (const t of TABLES) {
      const incoming: any[] = (contents as any)[t] ?? [];
      const table = (database as any)[t];
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      for (const rec of incoming) {
        const cur = mode === 'replace' ? undefined : await table.get(rec.id);
        if (!cur) {
          await table.put(rec);
          added += 1;
        } else if (stamp(rec) > stamp(cur)) {
          await table.put(rec);
          updated += 1;
        } else if (stamp(rec) < stamp(cur)) {
          report.keptNewerHere.push({ table: t, id: rec.id, here: stamp(cur), backup: stamp(rec) });
          unchanged += 1;
        } else unchanged += 1;
      }
      report.added[t] = added;
      report.updated[t] = updated;
      report.unchanged[t] = unchanged;
    }
    if (contents.settings) {
      const cur = await database.settings.get('settings');
      if (!cur || mode === 'replace') await database.settings.put(contents.settings);
    }
  });
  return report;
}

// ---------------------------------------------------------------------------
// Dugout Dad roster import (reads that app's weekend archive; never touches its database)
// ---------------------------------------------------------------------------

export interface DugoutDadRoster {
  teams: Array<{ id: string; name: string; shortName?: string; isMine: boolean }>;
  players: Array<{ id: string; teamId: string; firstName: string; lastName: string; number?: string; bats?: string; throws?: string; status: string; isPlaceholder?: boolean }>;
}

export async function readDugoutDadArchive(bytes: Uint8Array): Promise<DugoutDadRoster> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupFormatError('That file is not a ZIP archive.');
  }
  const m = entries['manifest.json'];
  if (!m) throw new BackupFormatError('manifest.json is missing; this is not a Dugout Dad archive.');
  const manifest = JSON.parse(strFromU8(m));
  if (manifest.format !== 'dugout-dad-archive') throw new BackupFormatError(`This is a "${manifest.format}" file, not a Dugout Dad weekend archive.`);
  if (!entries['teams.json'] || !entries['players.json']) throw new BackupFormatError('The archive has no roster files.');
  return { teams: JSON.parse(strFromU8(entries['teams.json'])), players: JSON.parse(strFromU8(entries['players.json'])) };
}

export interface RosterImportPlan {
  team: DugoutDadRoster['teams'][number];
  create: DugoutDadRoster['players'];
  update: Array<{ incoming: DugoutDadRoster['players'][number]; existing: Player }>;
  skipped: Array<{ player: DugoutDadRoster['players'][number]; why: string }>;
}

export async function planRosterImport(roster: DugoutDadRoster, dadTeamId: string, database: DugoutLabDB = defaultDb): Promise<RosterImportPlan> {
  const team = roster.teams.find((t) => t.id === dadTeamId);
  if (!team) throw new BackupFormatError('That team is not in the archive.');
  const plan: RosterImportPlan = { team, create: [], update: [], skipped: [] };
  for (const p of roster.players.filter((x) => x.teamId === dadTeamId)) {
    if (p.isPlaceholder) {
      plan.skipped.push({ player: p, why: 'placeholder (no real name)' });
      continue;
    }
    if (p.status === 'former' || p.status === 'inactive') {
      plan.skipped.push({ player: p, why: p.status });
      continue;
    }
    const existing = await database.players.get(p.id);
    if (existing) plan.update.push({ incoming: p, existing });
    else plan.create.push(p);
  }
  return plan;
}

/** Apply the plan into a Dugout Lab team. Only names, numbers and hands are copied; nothing is deleted. */
export async function commitRosterImport(plan: RosterImportPlan, labTeamId: string, database: DugoutLabDB = defaultDb): Promise<{ created: number; updated: number }> {
  const ts = nowIso();
  let created = 0;
  let updated = 0;
  const hand = (h?: string): Player['throws'] => (h === 'L' || h === 'R' ? h : h === 'S' || h === 'B' ? 'B' : undefined);
  await database.transaction('rw', database.players, async () => {
    for (const p of plan.create) {
      await database.players.put({
        id: p.id,
        teamId: labTeamId,
        firstName: p.firstName,
        lastName: p.lastName,
        number: p.number,
        bats: hand(p.bats),
        throws: hand(p.throws),
        positions: [],
        status: 'active',
        strengths: [],
        challenges: [],
        goals: [],
        cues: [],
        approaches: [],
        levels: {},
        statuses: {},
        importedFrom: 'dugout-dad',
        createdAt: ts,
        updatedAt: ts
      });
      created += 1;
    }
    for (const { incoming, existing } of plan.update) {
      await database.players.update(existing.id, { firstName: incoming.firstName, lastName: incoming.lastName, number: incoming.number ?? existing.number, bats: hand(incoming.bats) ?? existing.bats, throws: hand(incoming.throws) ?? existing.throws, updatedAt: ts });
      updated += 1;
    }
  });
  return { created, updated };
}

/** Share on a phone (Files, AirDrop, Mail) or download on a computer. */
export async function shareOrDownload(bytes: Uint8Array, fileName: string, mime = 'application/zip'): Promise<'shared' | 'downloaded'> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  try {
    if (nav?.canShare && nav?.share) {
      const file = new File([blob], fileName, { type: mime });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: fileName });
        return 'shared';
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
