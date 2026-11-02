import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from '../db/db';
import type { Team, Player, Drill, DrillVariant, Practice, Observation, ThrowingEntry, Settings } from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/types';
import type { GeneratorContext } from '../engine/generator';

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS;
}

export function useTeams(): Team[] {
  return useLiveQuery(() => db.teams.orderBy('name').toArray(), [], []) ?? [];
}

export function useTeam(teamId?: string): Team | undefined {
  return useLiveQuery(() => (teamId ? db.teams.get(teamId) : undefined), [teamId]);
}

/** The team the app is working with: the one in settings, else the first one. */
export function useCurrentTeam(): Team | undefined {
  const settings = useSettings();
  const teams = useTeams();
  return teams.find((t) => t.id === settings.teamId) ?? teams[0];
}

export function usePlayers(teamId?: string): Player[] {
  return useLiveQuery(async () => (teamId ? (await db.players.where('teamId').equals(teamId).toArray()).sort(byNumber) : []), [teamId], []) ?? [];
}

export function usePlayer(id?: string): Player | undefined {
  return useLiveQuery(() => (id ? db.players.get(id) : undefined), [id]);
}

export function usePlayerMap(teamId?: string): Map<string, Player> {
  const players = usePlayers(teamId);
  return useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
}

export function byNumber(a: Player, b: Player): number {
  return (parseInt(a.number ?? '999', 10) || 999) - (parseInt(b.number ?? '999', 10) || 999) || a.lastName.localeCompare(b.lastName);
}

export function useDrills(): Drill[] {
  return useLiveQuery(() => db.drills.toArray(), [], []) ?? [];
}

export function useDrill(id?: string): Drill | undefined {
  return useLiveQuery(() => (id ? db.drills.get(id) : undefined), [id]);
}

export function useVariants(drillId?: string): DrillVariant[] {
  return useLiveQuery(() => (drillId ? db.variants.where('drillId').equals(drillId).toArray() : db.variants.toArray()), [drillId], []) ?? [];
}

export function usePractices(teamId?: string): Practice[] {
  return useLiveQuery(async () => (teamId ? (await db.practices.where('teamId').equals(teamId).toArray()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt))) : []), [teamId], []) ?? [];
}

export function usePractice(id?: string): Practice | undefined {
  return useLiveQuery(() => (id ? db.practices.get(id) : undefined), [id]);
}

export function useObservations(playerId?: string): Observation[] {
  return useLiveQuery(async () => {
    const rows = playerId ? await db.observations.where('playerId').equals(playerId).toArray() : await db.observations.toArray();
    return rows.sort((a, b) => b.ts.localeCompare(a.ts));
  }, [playerId], []) ?? [];
}

export function useThrowing(): ThrowingEntry[] {
  return useLiveQuery(() => db.throwing.toArray(), [], []) ?? [];
}

/** Everything the generator needs for the current team. */
export function useGeneratorContext(teamId?: string): GeneratorContext | undefined {
  const team = useTeam(teamId);
  const players = usePlayers(teamId);
  const drills = useDrills();
  const variants = useVariants();
  const practices = usePractices(teamId);
  const observations = useObservations();
  const throwing = useThrowing();
  const settings = useSettings();
  return useMemo(() => {
    if (!team) return undefined;
    return { team, players, drills, variants, recentPractices: practices.filter((p) => p.status === 'done'), observations, throwing, settings };
  }, [team, players, drills, variants, practices, observations, throwing, settings]);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function fmtDate(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
