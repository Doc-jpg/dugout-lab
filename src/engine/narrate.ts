/**
 * Rapid-fire narration: one long dictation during a drill ("Jonah clean backhand quick transfer
 * throw on target, Sam bobbled it throw sailed, ...") cut into one note per kid per rep.
 *
 * The coach says the name first, then what happened. Every time a name from the roster comes up,
 * a new rep starts. Each rep gets the details the words carry (clean or bobbled, forehand or
 * backhand, quick or slow transfer, throw on or off target, strong or soft), a read worked out
 * from those details, and the coach's own words. Nothing is saved until the coach has looked at
 * the list and tapped Save; any rep can be moved to another kid, changed or dropped.
 *
 * Rules, not magic, same as notes.ts: names come from the roster on screen, details from plain
 * keyword lists.
 */
import type { Category, Observation, Player } from './types';
import { matchPlayers, guessRead, guessCategory, type NameGuess } from './notes';

export type Focus = 'fielding' | 'hitting' | 'pitching' | 'general';

export const FOCUS_LABEL: Record<Focus, string> = { fielding: 'Fielding', hitting: 'Hitting', pitching: 'Pitching', general: 'Anything' };

/** The reminder shown above the microphone: the order to say things in, and words that are understood. */
export const FOCUS_PROMPTS: Record<Focus, Array<{ step: string; say: string }>> = {
  fielding: [
    { step: 'Name', say: 'first name, last name or "number 7"' },
    { step: 'Fielding', say: 'clean, bobbled, missed · forehand, backhand · charged it, sat back' },
    { step: 'Transfer', say: 'quick transfer, slow transfer' },
    { step: 'Throw', say: 'on target, high, wide, in the dirt · strong throw, soft throw' },
    { step: 'Next kid', say: 'just say the next name' }
  ],
  hitting: [
    { step: 'Name', say: 'first name, last name or "number 7"' },
    { step: 'Timing', say: 'on time, late, early' },
    { step: 'Contact', say: 'barreled, line drive, rolled over, popped up, swing and miss' },
    { step: 'Decision', say: 'good take, chased' },
    { step: 'Next kid', say: 'just say the next name' }
  ],
  pitching: [
    { step: 'Name', say: 'first name, last name or "number 7"' },
    { step: 'Result', say: 'strike, hit his spot · missed high, missed low, missed away' },
    { step: 'Delivery', say: 'balanced, under control · rushed, flew open, fell off' },
    { step: 'Next kid', say: 'just say the next name' }
  ],
  general: [
    { step: 'Name', say: 'first name, last name or "number 7"' },
    { step: 'What you saw', say: 'got it, struggled, hesitated, hustled, took the cue, frustrated' },
    { step: 'Any detail', say: 'in your own words' },
    { step: 'Next kid', say: 'just say the next name' }
  ]
};

export const FOCUS_EXAMPLE: Record<Focus, string> = {
  fielding: 'Jonah, clean backhand, quick transfer, strong throw on target. Sam, bobbled the forehand, throw was high. Theo, charged it, clean, throw in the dirt.',
  hitting: 'Jonah, on time, barreled it. Sam, late, rolled over. Theo, good take, then a line drive.',
  pitching: 'Jonah, strike, balanced. Sam, missed high, rushed. Theo, hit his spot.',
  general: 'Jonah hustled on every rep. Sam hesitated on the cutoff. Theo took the cue on his drop step.'
};

type Area = 'fielding' | 'throwing' | 'hitting' | 'pitching';
interface Detail { tag: string; area: Area; tone: 1 | 0 | -1; re: RegExp }

/** What the words can carry. `tone` feeds the read: all good is "Got it", all bad "Struggled", a mix "Working on it". */
export const DETAILS: Detail[] = [
  { tag: 'Bobbled', area: 'fielding', tone: -1, re: /\b(bobbl\w*|booted|kicked it|juggled|double.?clutch\w*|dropped it)\b/i },
  { tag: 'Missed it', area: 'fielding', tone: -1, re: /\b(missed it|missed the ball|under (his|the) glove|through (his|the) legs|got by him|went by him|got past him)\b/i },
  { tag: 'Fielded clean', area: 'fielding', tone: 1, re: /\b(clean|cleanly|scooped it|picked it|smooth|fielded it well|good hands)\b/i },
  { tag: 'Backhand', area: 'fielding', tone: 0, re: /\bback.?hand\w*\b/i },
  { tag: 'Forehand', area: 'fielding', tone: 0, re: /\b(fore.?hand\w*|front.?hand\w*|glove side)\b/i },
  { tag: 'Charged it', area: 'fielding', tone: 1, re: /\b(charged|came through it|attacked (it|the ball)|got to it quick\w*)\b/i },
  { tag: 'Sat back', area: 'fielding', tone: -1, re: /\b(sat back|waited on it|let it play him|flat.?footed|on his heels)\b/i },
  { tag: 'Quick transfer', area: 'throwing', tone: 1, re: /\b(quick|fast|speedy|good|clean) (transition|transfer|exchange|release|hands)\b|\b(transition|transfer|exchange|release) (was |is )?(quick|fast|speedy|good|clean)\b/i },
  { tag: 'Slow transfer', area: 'throwing', tone: -1, re: /\b(slow|late|long|sloppy|bad) (transition|transfer|exchange|release)\b|\b(transition|transfer|exchange|release) (was |is )?(slow|late|long|sloppy)\b/i },
  { tag: 'Throw on target', area: 'throwing', tone: 1, re: /\b(on target|hit the target|on the money|chest high|right to (him|the bag|first|the glove)|good throw|great throw|made the throw|accurate)\b/i },
  { tag: 'Throw off target', area: 'throwing', tone: -1, re: /\b(off target|missed the target|wide|sailed|in the dirt|bounced it|pulled (him|the first baseman) off|airmailed|threw it away|off.?line|bad throw|throw (was |is |went )?(high|low|wide|short|up the line)|(high|low|short) throw)\b/i },
  { tag: 'Strong throw', area: 'throwing', tone: 1, re: /\b(strong|hard|firm) throw\b|\bthrow (was |is )?(strong|hard|firm)\b|\bon a line\b|\bgunned\b|\bstrong arm\b/i },
  { tag: 'Soft throw', area: 'throwing', tone: 0, re: /\b(soft|easy|weak) throw\b|\bthrow (was |is )?(soft|easy|weak)\b|\blobbed\b|\brainbow\w*\b/i },
  { tag: 'No throw', area: 'throwing', tone: 0, re: /\b(no throw|held (it|the ball)|ate it)\b/i },
  { tag: 'On time', area: 'hitting', tone: 1, re: /\bon time\b/i },
  { tag: 'Late', area: 'hitting', tone: -1, re: /\b(late|behind it)\b/i },
  { tag: 'Early', area: 'hitting', tone: -1, re: /\b(early|out front|out in front)\b/i },
  { tag: 'Hard contact', area: 'hitting', tone: 1, re: /\b(hard contact|barrel\w*|squared (it )?up|line drive|drove it|smoked|ripped|hard hit|hit it hard)\b/i },
  { tag: 'Weak contact', area: 'hitting', tone: -1, re: /\b(weak contact|rolled over|pop(ped)? (it )?up|jammed|off the end|dribbler|topped it)\b/i },
  { tag: 'Swing and miss', area: 'hitting', tone: -1, re: /\b(swing and (a )?miss|whiff\w*|swung through|missed it)\b/i },
  { tag: 'Good take', area: 'hitting', tone: 1, re: /\b(good take|laid off|took (a|the) ball)\b/i },
  { tag: 'Chased', area: 'hitting', tone: -1, re: /\b(chased|out of the zone|swung at a bad)\b/i },
  { tag: 'Strike', area: 'pitching', tone: 1, re: /\b(strikes?|in the zone|hit (his|the) spot|painted)\b/i },
  { tag: 'Missed the zone', area: 'pitching', tone: -1, re: /\b(ball (one|two|three|four)|missed (high|low|up|down|in|away|outside|inside)|walk\w*|wild)\b/i },
  { tag: 'Balanced', area: 'pitching', tone: 1, re: /\b(balanced|good balance|stayed tall|under control|good tempo)\b/i },
  { tag: 'Rushed', area: 'pitching', tone: -1, re: /\b(rushed|flew open|fell off|opened (up )?early)\b/i }
];

const AREAS_FOR: Record<Focus, Area[]> = { fielding: ['fielding', 'throwing'], hitting: ['hitting'], pitching: ['pitching'], general: ['fielding', 'throwing', 'hitting', 'pitching'] };
const DEFAULT_CATEGORY: Record<Focus, Category | undefined> = { fielding: 'infield', hitting: 'hitting', pitching: 'pitching', general: undefined };
const FIELDING_CATEGORIES: Category[] = ['infield', 'outfield', 'catching', 'team_defense', 'throwing'];

export function extractDetails(text: string, focus: Focus): { tags: string[]; tone: { good: number; bad: number } } {
  const areas = AREAS_FOR[focus];
  const tags: string[] = [];
  let good = 0;
  let bad = 0;
  for (const d of DETAILS) {
    if (!areas.includes(d.area)) continue;
    // In "Anything" mode the hitting and fielding lists both know "missed it"; fielding is listed first and wins.
    if (d.tag === 'Swing and miss' && tags.includes('Missed it')) continue;
    if (!d.re.test(text)) continue;
    tags.push(d.tag);
    if (d.tone > 0) good += 1;
    if (d.tone < 0) bad += 1;
  }
  // "clean" next to "bobbled" is about the throw or the transfer, not the glove
  if (tags.includes('Bobbled') || tags.includes('Missed it')) {
    const i = tags.indexOf('Fielded clean');
    if (i >= 0 && !/\b(fielded|picked|scooped)\b[^.]{0,12}\bclean/i.test(text)) { tags.splice(i, 1); good -= 1; }
  }
  return { tags, tone: { good, bad } };
}

export interface Rep {
  /** Stable within one narration, for the review list. */
  key: string;
  playerId?: string;
  /** How sure the name was, and who else it could have been. */
  confidence: number;
  alternatives: string[];
  /** The name as it was said. */
  heard?: string;
  text: string;
  read: Observation['read'];
  category?: Category;
  tags: string[];
}

const SOFT_REASONS: NameGuess['reason'][] = ['prefix', 'close', 'sounds'];

interface Tok { raw: string; clean: string; startsSentence: boolean }

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  let startsSentence = true;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const clean = raw.replace(/^[^A-Za-z0-9#']+|[^A-Za-z0-9']+$/g, '');
    if (clean) out.push({ raw, clean, startsSentence });
    startsSentence = /[.!?]["')]*$/.test(raw);
  }
  return out;
}

/**
 * Cut a narration into reps. A rep starts at every roster name; adjacent name words
 * ("Owen Tate", "number 7 Sam") are one name. Words before the first name are kept as a rep
 * with no player so nothing the coach said is lost.
 */
export function splitNarration(text: string, players: Player[], focus: Focus = 'general', categoryHint?: Category): Rep[] {
  const toks = tokenize(text);
  type Hit = { at: number; end: number; ids: string[]; confidence: number; heard: string };
  const hits: Hit[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    let probe = t.clean;
    let end = i;
    if (/^(number|no)$/i.test(t.clean) && /^\d{1,2}$/.test(toks[i + 1]?.clean ?? '')) { probe = `number ${toks[i + 1].clean}`; end = i + 1; }
    else if (/^#\d{1,2}$/.test(t.clean)) probe = t.clean;
    else if (/^\d+$/.test(t.clean)) continue; // a bare number is a count ("7 out of 10"), not a jersey
    const guesses = matchPlayers(probe, players).filter((g) => g.confidence >= 0.4);
    if (!guesses.length) { i = end; continue; }
    // Near misses ("Jona") count only when speech-to-text wrote it like a name: capitalized. They come out as a "Maybe" for the coach to confirm.
    const exact = guesses.filter((g) => !SOFT_REASONS.includes(g.reason));
    const soft = guesses.filter((g) => SOFT_REASONS.includes(g.reason));
    const looksLikeName = /^[A-Z]/.test(t.clean);
    const use = exact.length ? exact : looksLikeName ? soft.slice(0, 1) : [];
    if (!use.length) { i = end; continue; }
    const top = use[0].confidence;
    const ids = use.filter((g) => g.confidence >= top - 0.01).map((g) => g.playerId);
    const prev = hits[hits.length - 1];
    if (prev && prev.end === i - 1) {
      // "Owen Tate": keep whoever both words agree on
      const both = prev.ids.filter((id) => use.some((g) => g.playerId === id));
      if (both.length) { prev.ids = both; prev.end = end; prev.confidence = both.length === 1 ? 1 : prev.confidence; prev.heard += ` ${toks.slice(i, end + 1).map((x) => x.clean).join(' ')}`; i = end; continue; }
    }
    hits.push({ at: i, end, ids, confidence: ids.length > 1 ? Math.min(top, 0.6) : top, heard: toks.slice(i, end + 1).map((x) => x.clean).join(' ') });
    i = end;
  }
  const reps: Rep[] = [];
  const make = (from: number, to: number, hit?: Hit): void => {
    const words = toks.slice(from, to).map((x) => x.raw).join(' ').replace(/^[\s,;:.\-]+|[\s,;:\-]+$/g, '').trim();
    if (!hit && !words) return;
    const { tags, tone } = extractDetails(words, focus);
    const guessed = guessRead(words);
    let read: Observation['read'] = guessed.read;
    if (['got_it', 'struggled', 'working', 'note'].includes(read) && (tone.good || tone.bad)) read = tone.good && tone.bad ? 'working' : tone.good ? 'got_it' : 'struggled';
    const said = guessCategory(words);
    const category = categoryHint ?? (focus === 'fielding' ? (said && FIELDING_CATEGORIES.includes(said) && said !== 'throwing' ? said : DEFAULT_CATEGORY.fielding) : focus === 'general' ? said : DEFAULT_CATEGORY[focus]);
    reps.push({ key: `r${reps.length}`, playerId: hit?.ids[0], confidence: hit?.confidence ?? 0, alternatives: hit ? hit.ids.slice(1) : [], heard: hit?.heard, text: words, read, category, tags });
  };
  if (!hits.length) { make(0, toks.length); return reps; }
  if (hits[0].at > 0) make(0, hits[0].at);
  hits.forEach((h, k) => make(h.end + 1, hits[k + 1]?.at ?? toks.length, h));
  return reps;
}

/** For the live line under the microphone: who has been heard so far, in order, without repeats. */
export function heardSoFar(reps: Rep[]): string[] {
  const seen: string[] = [];
  for (const r of reps) if (r.playerId && !seen.includes(r.playerId)) seen.push(r.playerId);
  return seen;
}
