/**
 * Dugout Lab data model.
 *
 * Everything lives on the device (IndexedDB). Records carry createdAt/updatedAt so
 * backups can be merged without silently losing an edit. Ids are UUIDs.
 *
 * Philosophy baked in: every player is different, every practice has a purpose,
 * every suggestion is labeled a suggestion. Nothing here diagnoses a child.
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

export const newId = (): ID =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const nowIso = (): ISODateTime => new Date().toISOString();
export const today = (): ISODate => localDate(new Date());
/** The local calendar date of a moment (practice dates are local days; observation timestamps are UTC). */
export function localDate(d: Date | string): ISODate {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Development categories and levels
// ---------------------------------------------------------------------------

export type Category =
  | 'hitting' | 'throwing' | 'catching' | 'pitching' | 'infield' | 'outfield'
  | 'baserunning' | 'team_defense' | 'situations' | 'athletic' | 'baseball_iq' | 'mental';

export const CATEGORIES: Category[] = ['hitting', 'throwing', 'catching', 'pitching', 'infield', 'outfield', 'baserunning', 'team_defense', 'situations', 'athletic', 'baseball_iq', 'mental'];

export const CATEGORY_LABEL: Record<Category, string> = {
  hitting: 'Hitting', throwing: 'Throwing', catching: 'Catching', pitching: 'Pitching', infield: 'Infield defense',
  outfield: 'Outfield defense', baserunning: 'Baserunning', team_defense: 'Team defense', situations: 'Game situations',
  athletic: 'Athletic movement', baseball_iq: 'Baseball IQ', mental: 'Mental skills'
};

/** Skill level 1 (introducing) to 5 (game-ready under pressure). Players sit at different levels per category. */
export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVEL_LABEL: Record<Level, string> = { 1: 'Introducing', 2: 'Building', 3: 'Steady', 4: 'Reliable', 5: 'Game-ready' };

/** Where a skill stands for a player. Chosen by the coach, never inferred silently. */
export type SkillStatus = 'introduced' | 'practicing' | 'reliable' | 'transferred' | 'review';
export const STATUS_LABEL: Record<SkillStatus, string> = {
  introduced: 'Introduced', practicing: 'Practicing', reliable: 'Reliable in practice', transferred: 'Shows up in games', review: 'Due for review'
};

/**
 * Age groups the way travel ball names them: one per year from 6U to 18U, plus HS for a school
 * team that spans ages. Pitch Smart brackets and drill age gates derive from the number.
 */
export type AgeGroup = '6U' | '7U' | '8U' | '9U' | '10U' | '11U' | '12U' | '13U' | '14U' | '15U' | '16U' | '17U' | '18U' | 'HS';
export const AGE_GROUPS: AgeGroup[] = ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U', '15U', '16U', '17U', '18U', 'HS'];
/** The age a group stands for: the number in it, 16 for HS. Old saved values like "16U+" still parse. */
export function ageOf(g: AgeGroup | string | undefined): number {
  if (!g) return 12;
  if (g === 'HS') return 16;
  const n = parseInt(String(g), 10);
  return Number.isFinite(n) ? n : 12;
}

/**
 * The season year a date belongs to: August onward is fall ball, which plays at next spring's
 * age (a 12U fall team is "13U for 2027"). January to July is the current year.
 */
export function seasonYearFor(date: Date = new Date()): number {
  return date.getMonth() >= 7 ? date.getFullYear() + 1 : date.getFullYear();
}

/** Age group for a high-school graduation year in a given season year: a senior is 18U. */
export function ageGroupForClass(gradYear: number, seasonYear: number = seasonYearFor()): AgeGroup {
  const age = 18 - (gradYear - seasonYear);
  if (age >= 18) return '18U';
  if (age <= 6) return '6U';
  return `${age}U` as AgeGroup;
}

/** The age group a team plays at today: computed from its graduation year when it has one, else the fixed value. */
export function teamAgeGroup(team: { ageGroup: AgeGroup; gradYear?: number } | undefined, date: Date = new Date()): AgeGroup {
  if (!team) return '12U';
  return team.gradYear ? ageGroupForClass(team.gradYear, seasonYearFor(date)) : team.ageGroup;
}

// ---------------------------------------------------------------------------
// Team and players
// ---------------------------------------------------------------------------

/** A coach on the staff, for the roster of contacts on parent-facing pages. */
export interface CoachContact {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

/** How this team's program presents itself: in the app header and on everything parents see. */
export interface Brand {
  /** "Performance Baseball", "Wow Factor 2032". Falls back to the team name. */
  programName?: string;
  tagline?: string;
  /** Small PNG or JPEG as a data URL (resized on upload, kept under about 150 KB). */
  logo?: string;
  /** Hex colors picked from the logo or typed. */
  primary?: string;
  accent?: string;
  coaches?: CoachContact[];
  /** Line at the bottom of parent pages: website, league, whatever the program wants. */
  footer?: string;
}

export interface Team {
  id: ID;
  name: string;
  shortName?: string;
  /** Fixed age group, used when there is no graduation year. */
  ageGroup: AgeGroup;
  /** High-school graduation year ("Class of 2032"). When set, the age group follows the calendar. */
  gradYear?: number;
  season?: string;
  /** Current team-wide priorities, most important first. */
  priorities: Category[];
  brand?: Brand;
  /** People the head coach sends coach packs to. The pack carries the name; their notes come back tagged with it. */
  helpers?: Helper[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Helper {
  id: ID;
  name: string;
  /** "Assistant", "Parent coach", whatever the head coach calls him. */
  role?: string;
  createdAt: ISODateTime;
  lastSentAt?: ISODateTime;
  lastReceivedAt?: ISODateTime;
}

export type Hand = 'L' | 'R' | 'B';
export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';
export const POSITIONS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/** How a player tends to take instruction well. Several may apply; this is a coaching note, not a label. */
export type CoachingApproach = 'verbal' | 'demo' | 'visual_target' | 'explore' | 'one_cue' | 'challenge' | 'quiet_reps';
export const APPROACH_LABEL: Record<CoachingApproach, string> = {
  verbal: 'Short verbal explanation', demo: 'Watch a demonstration', visual_target: 'Give a visual target', explore: 'Let him figure it out',
  one_cue: 'One cue at a time', challenge: 'Make it a challenge', quiet_reps: 'Quiet reps, then talk'
};

export type RestrictionKind = 'no_throwing' | 'no_hitting' | 'no_running' | 'out';
export const RESTRICTION_LABEL: Record<RestrictionKind, string> = { no_throwing: 'No throwing', no_hitting: 'No hitting', no_running: 'No running', out: 'Out (not practicing)' };
export interface Restriction {
  kind: RestrictionKind;
  /** Last day it applies (inclusive). No date = until the coach clears it. */
  until?: ISODate;
  note?: string;
}
/** Restrictions in force on a date. */
export function activeRestrictions(p: { restrictions?: Restriction[] }, date: ISODate): Restriction[] {
  return (p.restrictions ?? []).filter((r) => !r.until || r.until >= date);
}

export interface ParentContact {
  name: string;
  relation?: string;
  phone?: string;
  email?: string;
  preferred?: 'text' | 'email';
}

export interface Goal {
  id: ID;
  category: Category;
  text: string;
  /** Technical or mental objective; both can be active at once. */
  kind: 'technical' | 'mental';
  status: 'active' | 'done' | 'paused';
  createdAt: ISODateTime;
  doneAt?: ISODateTime;
  /** The player's own words, when they set or shaped the goal. */
  fromPlayer?: boolean;
}

export interface Player {
  id: ID;
  teamId: ID;
  firstName: string;
  lastName: string;
  number?: string;
  /** What the coach actually calls him ("JJ", "Big Mike"), so spoken and typed notes find him. */
  nicknames?: string[];
  ageGroup?: AgeGroup;
  throws?: Hand;
  bats?: Hand;
  positions: Position[];
  /** Years played, free text ("2nd year travel", "first season"). */
  experience?: string;
  status: 'active' | 'inactive';
  /** Private coaching profile. Never shown in team summaries. */
  strengths: string[];
  challenges: string[];
  goals: Goal[];
  /** Cues that have worked, most useful first. */
  cues: string[];
  approaches: CoachingApproach[];
  /** What builds this player up; what to say after a mistake. */
  confidenceNotes?: string;
  /** How he tends to respond to frustration, pressure and mistakes (observed behavior, not a diagnosis). */
  responseNotes?: string;
  /** Optional, in the player's own words. */
  selfReflection?: string;
  /** Plays on other teams too; throwing workload may be incomplete. */
  otherTeams?: string;
  /** Per-category level set by the coach. Missing = not assessed yet. */
  levels: Partial<Record<Category, Level>>;
  statuses: Partial<Record<Category, SkillStatus>>;
  /** Imported from Dugout Dad: keeps the same id so a later import matches. */
  importedFrom?: 'dugout-dad';
  /** Temporary limits (sore arm, doctor's note, out this week). Expire on their own when `until` passes. */
  restrictions?: Restriction[];
  /** Parent or guardian contacts for drafts (never auto-sent). */
  parents?: ParentContact[];
  /** What the family gets: nothing, a plain summary with home work, or the summary plus the scorecard. */
  share?: 'none' | 'summary' | 'scorecard';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Drills and player-specific variations
// ---------------------------------------------------------------------------

export type Space = 'tight' | 'half' | 'full';
export const SPACE_LABEL: Record<Space, string> = { tight: 'Small area (cage, gym corner, backyard)', half: 'Half a field or a gym', full: 'Full field' };

export type Equipment =
  | 'balls' | 'tennis_balls' | 'soft_balls' | 'tee' | 'net' | 'bucket' | 'cones' | 'bases' | 'gloves' | 'bats'
  | 'l_screen' | 'machine' | 'helmets' | 'agility_ladder' | 'bands' | 'catching_gear' | 'fungo' | 'wiffle_balls' | 'whiteboard';
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  balls: 'Baseballs', tennis_balls: 'Tennis balls', soft_balls: 'Soft or foam balls', tee: 'Tee', net: 'Net', bucket: 'Bucket of balls', cones: 'Cones',
  bases: 'Bases', gloves: 'Gloves', bats: 'Bats', l_screen: 'L-screen', machine: 'Pitching machine', helmets: 'Helmets', agility_ladder: 'Agility ladder',
  bands: 'Resistance bands', catching_gear: 'Catcher gear', fungo: 'Fungo bat', wiffle_balls: 'Wiffle balls', whiteboard: 'Whiteboard or paper'
};

/** Practice block each drill fits. A drill may fit several. */
export type BlockKind = 'warmup' | 'fundamentals' | 'focus' | 'gamelike' | 'compete' | 'reflect';
/** A station's area: the field when present, else the old "category:x" note. */
export function stationCategory(s: { category?: Category; notes?: string }): Category | undefined {
  if (s.category) return s.category;
  const m = /^category:(\w+)/.exec(s.notes ?? '');
  return (m?.[1] as Category) ?? undefined;
}
/** A station's coach note without the old category marker. */
export function stationNote(s: { notes?: string }): string {
  return (s.notes ?? '').replace(/^category:\w+\n?/, '').trim();
}
export const BLOCK_LABEL: Record<BlockKind, string> = {
  warmup: 'Warm-up', fundamentals: 'Fundamentals', focus: 'Focused development', gamelike: 'Game-like decisions', compete: 'Compete and play', reflect: 'Reflection'
};

/** Throwing load a drill puts on an arm, for Pitch Smart awareness. */
export type ThrowingLoad = 'none' | 'light' | 'moderate' | 'high';

export interface Drill {
  id: ID;
  name: string;
  category: Category;
  /** Secondary categories the drill also serves. */
  also?: Category[];
  /** Levels the base version suits (inclusive range). */
  levelMin: Level;
  levelMax: Level;
  ageMin?: AgeGroup;
  blocks: BlockKind[];
  /** Typical minutes for one station rotation. */
  minutes: number;
  playersMin: number;
  playersMax: number;
  /** 0 = runs itself with a player leader, 1 = needs a coach, 2 = needs two. */
  coaches: 0 | 1 | 2;
  equipment: Equipment[];
  space: Space;
  indoorOk: boolean;
  /** What the player should get out of it, one sentence. */
  objective: string;
  setup: string;
  /** Short numbered steps. */
  steps: string[];
  /** Coaching cues, short enough to shout. */
  cues: string[];
  /** What "got it" looks like. */
  success: string;
  /** Make it easier / harder without changing the station. */
  easier: string;
  harder: string;
  /** Optional mental-skill angle a coach can attach to the technical objective. */
  mentalHook?: string;
  /** Optional decision the drill forces, for Baseball IQ. */
  decisionHook?: string;
  throwingLoad: ThrowingLoad;
  /** 'library' drills ship with the app; 'custom' were written here. */
  source: 'library' | 'custom';
  /** Where the idea comes from, in general terms (public coaching knowledge, named principles). */
  attribution?: string;
  tags: string[];
  /** Coach-added links (a video he trusts, a page) for home work. Never auto-filled. */
  links?: Array<{ label: string; url: string }>;
  /** Practice style: blocked reps, variable, random/game, decision. Mix matters for retention. */
  style: 'blocked' | 'variable' | 'random' | 'decision' | 'game';
  /** Common mistakes a coach will see, each with the fix. */
  mistakes?: Array<{ see: string; fix: string }>;
  /** One safety line, only when a real one exists. */
  safety?: string;
  /** One line on how to make it a game (score, clock, teams). */
  competitive?: string;
  /** Spacing or distances when they matter. */
  spacing?: string;
  archived?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Plain words for each practice style, for the interface. */
export const STYLE_WORD: Record<'blocked' | 'variable' | 'random' | 'decision' | 'game', string> = { blocked: 'reps', variable: 'mixed reps', random: 'game-speed mix', decision: 'make a read', game: 'competition' };
export const THROWING_LOAD_WORD: Record<'none' | 'light' | 'moderate' | 'high', string> = { none: 'no throwing', light: 'light throwing', moderate: 'some throwing', high: 'hard throwing' };

/** A saved player-specific (or group-specific) version of a drill. The whole station runs one drill; each kid gets his own version. */
export interface DrillVariant {
  id: ID;
  drillId: ID;
  /** Exactly one of playerId / groupLabel. */
  playerId?: ID;
  groupLabel?: string;
  name: string;
  /** Overrides; empty fields fall back to the base drill. */
  objective?: string;
  steps?: string[];
  cues?: string[];
  success?: string;
  reps?: string;
  distance?: string;
  equipment?: string;
  intensity?: 'easy' | 'normal' | 'push';
  /** A reset routine or confidence note to use at this station. */
  mental?: string;
  /** Did it help? Set after a practice; revisable. */
  helped?: 'yes' | 'some' | 'no';
  helpedNote?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Practices
// ---------------------------------------------------------------------------

export interface PracticeInputs {
  teamId: ID;
  presentIds: ID[];
  absentIds: ID[];
  durationMin: number;
  coaches: number;
  equipment: Equipment[];
  space: Space;
  indoor: boolean;
  teamPriorities: Category[];
  /** Per-player focus for this practice (defaults from active goals). */
  playerPriorities: Record<ID, Category[]>;
  /** Players who must not throw hard today (coach decision; Pitch Smart hints feed this). */
  noThrowingIds: ID[];
  /** Keep the plan light on this category today. */
  avoid?: Category[];
}

export interface PlayerObjective {
  playerId: ID;
  technical: string;
  mental?: string;
  variantId?: ID;
  /** Where the objective came from, so the coach can see why. */
  from: 'goal' | 'variant' | 'level' | 'drill' | 'coach';
}

export interface Station {
  id: ID;
  drillId: ID;
  /** The drill's area at the time it was placed (older plans carry it inside `notes` as "category:x"). */
  category?: Category;
  /** Group ids rotating through this station, in order. */
  coach?: string;
  objectives: PlayerObjective[];
  /** Coach-edited override of the drill name/instructions for this station. */
  nameOverride?: string;
  notes?: string;
  /** Set when the generator swapped in the easier progression. */
  progression?: 'easier' | 'base' | 'harder';
}

export interface Group {
  id: ID;
  name: string;
  playerIds: ID[];
}

export interface Block {
  id: ID;
  kind: BlockKind;
  title: string;
  startMin: number;
  minutes: number;
  /** Stations run in parallel; groups rotate through them every `rotationMin` minutes. */
  stations: Station[];
  groups: Group[];
  rotationMin: number;
  /** Whole-team blocks (warm-up, compete, reflect) have one station and one group. */
  wholeTeam: boolean;
}

export interface Observation {
  id: ID;
  practiceId?: ID;
  playerId: ID;
  /** Quick read from the field. Effort and attitude are observed behavior: hustle, teammate, coachable, coasting. */
  read: 'got_it' | 'working' | 'struggled' | 'hesitated' | 'confident' | 'frustrated' | 'reset_worked' | 'hustle' | 'teammate' | 'coachable' | 'coasting' | 'note';
  category?: Category;
  drillId?: ID;
  text?: string;
  /** Details pulled from a narrated rep ("Backhand", "Throw on target"). */
  tags?: string[];
  /** 'game' observations come from game day; they feed practice suggestions too. */
  source: 'practice' | 'game' | 'quick';
  /** Which coach wrote it (from Settings), so merged notes from several phones stay attributed. */
  by?: string;
  ts: ISODateTime;
}

export interface PracticeRecap {
  summary?: string;
  wins: string[];
  followUps: string[];
  /** Variants rated at the end. */
  variantRatings?: Array<{ variantId: ID; helped: 'yes' | 'some' | 'no' }>;
  finishedAt: ISODateTime;
}

export interface Practice {
  id: ID;
  teamId: ID;
  date: ISODate;
  time?: string;
  title?: string;
  status: 'planned' | 'live' | 'done';
  inputs: PracticeInputs;
  blocks: Block[];
  /** Live state survives app closure. */
  live?: {
    startedAt: ISODateTime;
    blockIndex: number;
    rotation: number;
    /** Seconds elapsed in the current rotation when last saved, plus when the clock last ran. */
    elapsedSec: number;
    runningSince?: ISODateTime;
    paused: boolean;
  };
  recap?: PracticeRecap;
  /** Generator notes: why this plan, what was avoided, workload flags. */
  rationale: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Throwing workload (Pitch Smart awareness)
// ---------------------------------------------------------------------------

export interface ThrowingEntry {
  id: ID;
  playerId: ID;
  date: ISODate;
  /** Pitches in a game or bullpen. null = threw, count unknown. */
  pitches: number | null;
  kind: 'game' | 'bullpen' | 'practice' | 'other_team';
  source: 'manual' | 'dugout-dad';
  note?: string;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Parent updates (drafts the coach sends himself)
// ---------------------------------------------------------------------------

export interface ParentUpdate {
  id: ID;
  playerId: ID;
  ts: ISODateTime;
  kind: 'update' | 'home_plan' | 'scorecard';
  channel: 'text' | 'email' | 'file' | 'copy';
  /** The text as drafted (what the coach saw before sending). */
  text: string;
  drillIds: ID[];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  id: 'settings';
  appName: string;
  teamId?: ID;
  coachName?: string;
  /** Default practice inputs. */
  defaultDurationMin: number;
  defaultCoaches: number;
  defaultEquipment: Equipment[];
  defaultSpace: Space;
  /** Pitch Smart age bracket is derived from the team age group unless overridden. */
  pitchSmartAge?: number;
  backupReminderPractices: number;
  lastBackupAt?: ISODateTime;
  /** Parent updates are suggested when a player has had this many practices since his last one. */
  parentUpdateEveryPractices: number;
  /** Signature on drafts. */
  coachSignature?: string;
  /** Optional app lock: SHA-256 of salt + PIN. The app asks for the PIN on open and after being in the background a while. */
  pinHash?: string;
  pinSalt?: string;
  /** When the coach finished or skipped the guided tour. */
  tourSeenAt?: ISODateTime;
  /** Set when this phone was set up from a coach pack or an invite link: who the head coach said this phone belongs to. Notes are tagged with it and the name cannot be edited here. */
  packIdentity?: { helperId: ID; name: string; teamId: ID; from?: string; sentAt: ISODateTime };
  /** Automatic sync with the other coaches' phones. Never leaves this phone. */
  sync?: SyncState;
}

export interface SyncState {
  /** The team secret every invite link carries. Sent in a header, stored nowhere but on the phones. */
  teamKey: string;
  /** sha256 of the team key; the server's row key. */
  teamId: string;
  /** This phone's own token. Revoking it on the head coach's phone shuts this phone off without touching the others. */
  token: string;
  role: 'head' | 'helper';
  /** The name on the invite, which the server stamps on every note from this phone. */
  name: string;
  device: string;
  enabled: boolean;
  /** Set when the head coach turned this phone's access off; sync stops and the screen says so. */
  revoked?: boolean;
  /** The local team this sync carries (the head coach's current team at turn-on). */
  localTeamId?: ID;
  lastPush?: ISODateTime;
  lastPullTs?: string;
  lastSyncAt?: ISODateTime;
  lastError?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  appName: 'Dugout Lab',
  defaultDurationMin: 90,
  defaultCoaches: 2,
  defaultEquipment: ['balls', 'tee', 'net', 'bucket', 'cones', 'bases', 'gloves', 'bats', 'helmets', 'l_screen'],
  defaultSpace: 'full',
  backupReminderPractices: 3,
  parentUpdateEveryPractices: 3
};
