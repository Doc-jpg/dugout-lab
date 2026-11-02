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
export const today = (): ISODate => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

/** Age bands used by the drill library and the practice generator. */
export type AgeGroup = '8U' | '10U' | '12U' | '14U' | '16U+';
export const AGE_GROUPS: AgeGroup[] = ['8U', '10U', '12U', '14U', '16U+'];

// ---------------------------------------------------------------------------
// Team and players
// ---------------------------------------------------------------------------

export interface Team {
  id: ID;
  name: string;
  shortName?: string;
  ageGroup: AgeGroup;
  season?: string;
  /** Current team-wide priorities, most important first. */
  priorities: Category[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
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
  /** Practice style: blocked reps, variable, random/game, decision. Mix matters for retention. */
  style: 'blocked' | 'variable' | 'random' | 'decision' | 'game';
  archived?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

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
  /** Quick read from the field. */
  read: 'got_it' | 'working' | 'struggled' | 'hesitated' | 'confident' | 'frustrated' | 'reset_worked' | 'note';
  category?: Category;
  drillId?: ID;
  text?: string;
  /** 'game' observations come from game day; they feed practice suggestions too. */
  source: 'practice' | 'game' | 'quick';
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
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  appName: 'Dugout Lab',
  defaultDurationMin: 90,
  defaultCoaches: 2,
  defaultEquipment: ['balls', 'tee', 'net', 'bucket', 'cones', 'bases', 'gloves', 'bats', 'helmets', 'l_screen'],
  defaultSpace: 'full',
  backupReminderPractices: 3
};
