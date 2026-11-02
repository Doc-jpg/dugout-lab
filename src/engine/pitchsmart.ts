/**
 * Throwing workload awareness based on the public MLB / USA Baseball Pitch Smart guidelines
 * (daily pitch limits and required rest days by age). League rules may be stricter; the coach
 * decides. Missing data is never treated as "cleared to throw".
 *
 * Source: https://www.mlb.com/pitch-smart/pitching-guidelines (see docs/RESEARCH.md).
 */
import type { AgeGroup, Player, ThrowingEntry, ISODate } from './types';
import { ageOf } from './types';

export interface PitchSmartRow {
  ageMin: number;
  ageMax: number;
  dailyMax: number;
  /** Pitch count thresholds that require 1, 2, 3, 4 days of rest. Below the first = 0 days. */
  rest: [number, number, number, number];
}

export const PITCH_SMART: PitchSmartRow[] = [
  { ageMin: 7, ageMax: 8, dailyMax: 50, rest: [21, 36, 51, 9999] },
  { ageMin: 9, ageMax: 10, dailyMax: 75, rest: [21, 36, 51, 66] },
  { ageMin: 11, ageMax: 12, dailyMax: 85, rest: [21, 36, 51, 66] },
  { ageMin: 13, ageMax: 14, dailyMax: 95, rest: [21, 36, 51, 66] },
  { ageMin: 15, ageMax: 16, dailyMax: 95, rest: [31, 46, 61, 76] },
  { ageMin: 17, ageMax: 18, dailyMax: 105, rest: [31, 46, 61, 76] },
  { ageMin: 19, ageMax: 22, dailyMax: 120, rest: [31, 46, 61, 76] }
];

export function ageForGroup(g: AgeGroup): number {
  return ageOf(g);
}

export function pitchSmartRow(age: number): PitchSmartRow {
  // Pitch Smart starts at 7; a 6U team uses the 7-8 row (the most conservative one).
  return PITCH_SMART.find((r) => age >= r.ageMin && age <= r.ageMax) ?? (age < 7 ? PITCH_SMART[0] : PITCH_SMART[PITCH_SMART.length - 1]);
}

/** Required rest days after `pitches` in one day. */
export function restDaysFor(pitches: number, age: number): number {
  const row = pitchSmartRow(age);
  if (pitches <= 0) return 0;
  let days = 0;
  for (const t of row.rest) if (pitches >= t) days += 1;
  return days;
}

export interface ThrowingFlag {
  status: 'ok' | 'rest' | 'unknown';
  message: string;
  /** Date the player may pitch again (rest), when known. */
  clearedOn?: ISODate;
}

function addDays(d: ISODate, n: number): ISODate {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

/**
 * Flag each player for today's practice:
 *  - rest: pitched recently and the required rest days are not over
 *  - unknown: threw with no count recorded, or plays on another team with nothing logged this week
 *  - ok: nothing in the log says he should not throw
 */
export function throwingFlags(players: Player[], entries: ThrowingEntry[], ageGroup: AgeGroup, date: ISODate): Map<string, ThrowingFlag> {
  const age = ageForGroup(ageGroup);
  const out = new Map<string, ThrowingFlag>();
  for (const p of players) {
    const mine = entries.filter((e) => e.playerId === p.id && daysBetween(e.date, date) >= 0 && daysBetween(e.date, date) <= 7).sort((a, b) => (a.date < b.date ? 1 : -1));
    let flag: ThrowingFlag = { status: 'ok', message: 'Nothing in the log says he should not throw.' };
    for (const e of mine) {
      if (e.pitches == null) {
        flag = { status: 'unknown', message: `Threw on ${e.date} (${e.kind.replace('_', ' ')}) with no pitch count recorded. Confirm before he throws hard.` };
        break;
      }
      const rest = restDaysFor(e.pitches, age);
      const clearedOn = addDays(e.date, rest + 1);
      if (daysBetween(e.date, date) <= rest) {
        flag = { status: 'rest', message: `${e.pitches} pitches on ${e.date}: Pitch Smart asks for ${rest} rest day${rest === 1 ? '' : 's'}. Cleared ${clearedOn}.`, clearedOn };
        break;
      }
    }
    if (flag.status === 'ok' && p.otherTeams && !mine.length) {
      flag = { status: 'unknown', message: `Also plays for ${p.otherTeams}; nothing logged this week. Ask before he throws hard.` };
    }
    out.set(p.id, flag);
  }
  return out;
}
