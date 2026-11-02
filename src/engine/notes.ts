/**
 * Freestyle notes: "Jonah hesitated on the cutoff" typed or spoken, turned into
 * who / what you saw / which area, with the coach confirming the guess.
 *
 * Rules, not magic: names are matched against the roster the coach is looking at
 * (the kids at practice, or the whole active roster), reads and areas come from
 * plain keyword lists. Every guess carries a confidence so the screen can say
 * "Sounds like Jonah" instead of silently filing it on the wrong kid.
 */
import type { Category, Observation, Player } from './types';

export interface NameGuess {
  playerId: string;
  /** 0 to 1. Above 0.85 is a sure thing; 0.5 to 0.85 is "sounds like"; below is a long shot. */
  confidence: number;
  /** Why it matched, for the screen and for tests. */
  reason: 'first' | 'last' | 'full' | 'number' | 'nickname' | 'prefix' | 'close' | 'sounds';
}

export interface ParsedNote {
  /** Best guess, if any, plus the runners-up in order. */
  player?: NameGuess;
  alternatives: NameGuess[];
  read: Observation['read'];
  readConfidence: number;
  category?: Category;
  text: string;
}

const READ_WORDS: Array<[Observation['read'], RegExp]> = [
  ['reset_worked', /\b(reset worked|shook it off|bounced back|let it go|moved on|next pitch)\b/i],
  ['frustrated', /\b(frustrat\w*|upset|mad|angry|pouted|pouting|slammed|threw (his|the) (helmet|glove|bat)|tears|crying|shut down)\b/i],
  ['hesitated', /\b(hesitat\w*|froze|frozen|late (on|to)|slow to|second.?guess\w*|unsure|didn'?t know where|wasn'?t sure|waited too long|stuck)\b/i],
  ['struggled', /\b(struggl\w*|couldn'?t|could not|missed|booted|bobbled|whiffed|lost it|fell apart|kept (missing|dropping)|no luck|rough)\b/i],
  ['got_it', /\b(got it|nailed|clean|figured it out|locked in|great job|perfect|finally|clicked|crushed|dialed|had it|smooth|good rep|good reps)\b/i],
  ['confident', /\b(confiden\w*|wanted the ball|took charge|aggressive|loud|called it)\b/i],
  ['coasting', /\b(coast\w*|motions|lazy|dogging|dogged it|half.?speed|jogged|not trying|checked out|went through)\b/i],
  ['hustle', /\b(hustl\w*|ran hard|sprinted|busted it|first one|dove|all out|effort)\b/i],
  ['teammate', /\b(teammate|picked up|cheered|encouraged|helped|high.?five|leader|leadership)\b/i],
  ['coachable', /\b(took the cue|listened|coachable|adjusted|made the change|fixed it|applied|took it)\b/i],
  ['working', /\b(working on|getting there|better|closer|improving|progress|almost|coming along|halfway)\b/i]
];

const CATEGORY_WORDS: Array<[Category, RegExp]> = [
  ['team_defense', /\b(cutoff|cut.?off|relay|bunt defense|first and third|1st and 3rd|pickoff|pick.?off|rundown|backing up|back up|cover(ed|ing)? (first|second|third|the bag))\b/i],
  ['pitching', /\b(pitch\w*|mound|bullpen|strike zone|windup|stretch|balk|curve|change.?up|fastball|command)\b/i],
  ['catching', /\b(catcher|catching|blocked|blocking|framing|framed|pop.?time|behind the plate|passed ball|gear)\b/i],
  ['hitting', /\b(hit\w*|swing\w*|bat\b|bats\b|batting|tee|at.?bat|contact|barrel|front foot|load|two.?strike|bunt(ed|ing)?|line drive|pop(ped)? up|rolled over|front toss|soft toss)\b/i],
  ['baserunning', /\b(base.?runn\w*|lead(s|ing)? off|stole|steal\w*|slide|slid|sliding|first to third|tag(ged)? up|round(ed|ing)? (first|the bag)|took the extra|secondary)\b/i],
  ['outfield', /\b(outfield\w*|fly ball|fly balls|drop step|over (his|the) head|in the gap|crow hop|center|left field|right field)\b/i],
  ['infield', /\b(infield\w*|ground ball|grounder|backhand|forehand|double play|turn two|short(stop)?|second base|third base|first base|glove side|fielded|fielding|hop|short hop|funnel)\b/i],
  ['throwing', /\b(throw\w*|arm\b|arm slot|long toss|accuracy|four.?seam|threw)\b/i],
  ['situations', /\b(situation\w*|count\b|two outs|runner on|runners on|bases loaded|infield in|where to go|what to do with)\b/i],
  ['baseball_iq', /\b(iq|read the|knew where|anticipat\w*|decision|thinking|heads up|heads-up|smart play|baseball sense)\b/i],
  ['mental', /\b(breath\w*|routine|nerves|nervous|pressure|focus\w*|mindset|calm|composure|body language|self.?talk)\b/i],
  ['athletic', /\b(speed|agility|footwork|quick feet|balance|coordination|ladder|sprint\w*|explosive|lateral)\b/i]
];

/** Edit distance with early exit; fine for names. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let left = i;
    let diag = i - 1;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const cur = Math.min(up + 1, left + 1, diag + cost);
      prev[j - 1] = left;
      diag = up;
      left = cur;
    }
    prev[b.length] = left;
  }
  return prev[b.length];
}

/** A rough sound key so "Jona" and "Jonah", "Kason" and "Cason" land together. */
export function soundKey(s: string): string {
  const t = s.toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return '';
  const first = t[0].replace(/[ck]/, 'k').replace(/[z]/, 's');
  const rest = t.slice(1).replace(/[aeiouyhw]/g, '').replace(/ck/g, 'k').replace(/c/g, 'k').replace(/ph/g, 'f').replace(/z/g, 's').replace(/(.)\1+/g, '$1');
  return (first + rest).slice(0, 5);
}

const STOP = new Set(['that', 'this', 'then', 'them', 'they', 'there', 'their', 'when', 'what', 'with', 'went', 'were', 'will', 'from', 'have', 'just', 'like', 'than', 'into', 'over', 'ball', 'base', 'good', 'well', 'kept', 'make', 'made', 'more', 'nice', 'same', 'some', 'tell', 'told', 'took', 'very', 'want', 'work']);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/'s\b/g, '').replace(/\s+/g, ' ').trim();

/** Match free text against a roster. Returns the best guess first, then the rest, each at most once. */
export function matchPlayers(text: string, players: Player[]): NameGuess[] {
  const t = norm(text);
  if (!t) return [];
  const tokens = t.split(' ').filter(Boolean);
  const guesses = new Map<string, NameGuess>();
  const put = (g: NameGuess) => {
    const cur = guesses.get(g.playerId);
    if (!cur || cur.confidence < g.confidence) guesses.set(g.playerId, g);
  };
  const firstCounts = new Map<string, number>();
  for (const p of players) {
    const f = norm(p.firstName);
    firstCounts.set(f, (firstCounts.get(f) ?? 0) + 1);
  }
  const numberTokens = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const m = /^#?(\d{1,2})$/.exec(tokens[i]);
    if (m) numberTokens.add(m[1]);
    if ((tokens[i] === 'number' || tokens[i] === 'no') && /^\d{1,2}$/.test(tokens[i + 1] ?? '')) numberTokens.add(tokens[i + 1]);
  }
  for (const p of players) {
    const first = norm(p.firstName);
    const last = norm(p.lastName);
    const nick = (p.nicknames ?? []).map(norm).filter(Boolean);
    const shared = (firstCounts.get(first) ?? 0) > 1;
    const firstHit = first && tokens.includes(first);
    const lastHit = last && last.length >= 3 && tokens.includes(last);
    if (firstHit && lastHit) put({ playerId: p.id, confidence: 1, reason: 'full' });
    else if (firstHit) put({ playerId: p.id, confidence: shared ? 0.6 : 0.95, reason: 'first' });
    else if (lastHit) put({ playerId: p.id, confidence: 0.85, reason: 'last' });
    if (nick.some((n) => tokens.includes(n) || (n.includes(' ') && t.includes(n)))) put({ playerId: p.id, confidence: 0.9, reason: 'nickname' });
    if (p.number && numberTokens.has(String(parseInt(p.number, 10)))) put({ playerId: p.id, confidence: 0.9, reason: 'number' });
    if (guesses.has(p.id)) continue;
    // Near misses: typos and speech-to-text slips on the first name
    for (const tok of tokens) {
      if (tok.length < 4 || !first || STOP.has(tok)) continue;
      if (first.length >= 4 && (tok.startsWith(first) || first.startsWith(tok)) && Math.abs(tok.length - first.length) <= 2) { put({ playerId: p.id, confidence: shared ? 0.5 : 0.75, reason: 'prefix' }); continue; }
      const d = editDistance(tok, first);
      if ((first.length >= 4 && d === 1) || (first.length >= 6 && d === 2)) { put({ playerId: p.id, confidence: shared ? 0.45 : 0.7, reason: 'close' }); continue; }
      if (first.length >= 4 && tok.length >= 4 && soundKey(tok) === soundKey(first) && d <= 3) put({ playerId: p.id, confidence: shared ? 0.4 : 0.55, reason: 'sounds' });
    }
  }
  return [...guesses.values()].sort((a, b) => b.confidence - a.confidence);
}

export function guessRead(text: string): { read: Observation['read']; confidence: number } {
  for (const [read, re] of READ_WORDS) if (re.test(text)) return { read, confidence: 0.8 };
  return { read: 'note', confidence: 0 };
}

export function guessCategory(text: string): Category | undefined {
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(text)) return cat;
  return undefined;
}

/** The whole guess for one note against the roster the coach is looking at. */
export function parseNote(text: string, players: Player[]): ParsedNote {
  const guesses = matchPlayers(text, players);
  const [player, ...alternatives] = guesses;
  const r = guessRead(text);
  return { player, alternatives, read: r.read, readConfidence: r.confidence, category: guessCategory(text), text: text.trim() };
}

/** Plain words for the screen. */
export function confidenceWord(c: number): 'Sounds like' | 'Maybe' | 'Could be' {
  if (c >= 0.85) return 'Sounds like';
  if (c >= 0.5) return 'Maybe';
  return 'Could be';
}
