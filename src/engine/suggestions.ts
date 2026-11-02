/**
 * Coaching suggestions from what the coach actually observed.
 *
 * Every suggestion is labeled a suggestion. Nothing here says what a kid "is"; it says what
 * the coach wrote down, how often, and one reasonable next thing to try. The coach decides.
 */
import type { Category, Drill, Observation, Player, Practice } from './types';
import { CATEGORY_LABEL, CATEGORIES, stationCategory } from './types';
import { playerLevel } from './generator';

export interface Suggestion {
  id: string;
  playerId: string;
  category?: Category;
  kind: 'decision_work' | 'easier_progression' | 'reset_routine' | 'ready_to_advance' | 'transfer_check' | 'rate_variant' | 'review_due' | 'no_attention';
  /** Always starts with "Suggestion". */
  text: string;
  drillId?: string;
  /** Observation ids this is based on, so the coach can see the evidence. */
  basis: string[];
  /** Count of observations behind it. */
  count: number;
  fromGame: boolean;
}

const STRUGGLE: Observation['read'][] = ['struggled', 'hesitated'];

function pickDrill(drills: Drill[], category: Category, level: number, prefer: Drill['style'][]): Drill | undefined {
  const pool = drills.filter((d) => !d.archived && (d.category === category || d.also?.includes(category)) && d.levelMin <= level + 1 && d.levelMax >= level - 1);
  for (const st of prefer) {
    const hit = pool.find((d) => d.style === st);
    if (hit) return hit;
  }
  return pool[0];
}

/** Suggestions for one player from recent observations (default: the last 30 days). */
export function suggestionsFor(player: Player, observations: Observation[], drills: Drill[], opts: { sinceDays?: number; now?: Date } = {}): Suggestion[] {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.sinceDays ?? 30) * 86400000).toISOString();
  const mine = observations.filter((o) => o.playerId === player.id && o.ts >= since);
  const out: Suggestion[] = [];
  const name = player.firstName;
  const byCat = new Map<Category, Observation[]>();
  for (const o of mine) {
    if (!o.category) continue;
    const arr = byCat.get(o.category) ?? [];
    arr.push(o);
    byCat.set(o.category, arr);
  }
  for (const [cat, obs] of byCat) {
    const struggles = obs.filter((o) => STRUGGLE.includes(o.read));
    const wins = obs.filter((o) => o.read === 'got_it' || o.read === 'confident');
    const fromGame = struggles.some((o) => o.source === 'game');
    if (struggles.length >= 2) {
      const hesitated = struggles.filter((o) => o.read === 'hesitated').length >= struggles.length / 2;
      const lvl = playerLevel(player, cat);
      const drill = hesitated ? pickDrill(drills, cat, lvl, ['decision', 'random', 'variable']) : pickDrill(drills, cat, Math.max(1, lvl - 1), ['blocked', 'variable']);
      const what = hesitated ? 'hesitated' : 'struggled';
      out.push({
        id: `s-${player.id}-${cat}-${hesitated ? 'dec' : 'easy'}`,
        playerId: player.id,
        category: cat,
        kind: hesitated ? 'decision_work' : 'easier_progression',
        text: `Suggestion, not a diagnosis: ${name} ${what} on ${CATEGORY_LABEL[cat].toLowerCase()} in ${struggles.length} notes${fromGame ? ' (including a game)' : ''}. ${
          hesitated
            ? `Try a decision rep with a clear read before the ball arrives${drill ? `: ${drill.name}` : ''}. Ask him what he saw, then what he would do, before telling him.`
            : `Try the easier version for a station${drill ? ` (${drill.name})` : ''} so he stacks a few clean reps, then step back up.`
        }${player.cues.length ? ` Cue that has worked for him: "${player.cues[0]}".` : ''}`,
        drillId: drill?.id,
        basis: struggles.map((o) => o.id),
        count: struggles.length,
        fromGame
      });
    }
    if (wins.length >= 3 && struggles.length === 0 && (player.statuses[cat] === 'practicing' || player.statuses[cat] === 'introduced' || !player.statuses[cat])) {
      const drill = pickDrill(drills, cat, playerLevel(player, cat) + 1, ['game', 'random', 'decision']);
      out.push({
        id: `s-${player.id}-${cat}-adv`,
        playerId: player.id,
        category: cat,
        kind: 'ready_to_advance',
        text: `Suggestion: ${name} had ${wins.length} good reads on ${CATEGORY_LABEL[cat].toLowerCase()} and no struggles. Consider marking it reliable, and test it in a game-like setting${drill ? ` (${drill.name})` : ''} before calling it transferred.`,
        drillId: drill?.id,
        basis: wins.map((o) => o.id),
        count: wins.length,
        fromGame: false
      });
    }
  }
  const frustrated = mine.filter((o) => o.read === 'frustrated');
  if (frustrated.length >= 2) {
    const drill = drills.find((d) => d.category === 'mental' && /reset/i.test(d.name + ' ' + d.tags.join(' '))) ?? drills.find((d) => d.category === 'mental');
    out.push({
      id: `s-${player.id}-reset`,
      playerId: player.id,
      category: 'mental',
      kind: 'reset_routine',
      text: `Suggestion, not a diagnosis: ${name} showed frustration in ${frustrated.length} notes. Give him one reset routine to practice on purpose${drill ? ` (${drill.name})` : ''}, pair it with an achievable technical objective, and notice out loud when he uses it.${player.confidenceNotes ? ` Your note on what builds him up: "${player.confidenceNotes}".` : ''}`,
      drillId: drill?.id,
      basis: frustrated.map((o) => o.id),
      count: frustrated.length,
      fromGame: frustrated.some((o) => o.source === 'game')
    });
  }
  const resets = mine.filter((o) => o.read === 'reset_worked');
  if (resets.length >= 2 && frustrated.length) {
    out.push({
      id: `s-${player.id}-reset-win`,
      playerId: player.id,
      category: 'mental',
      kind: 'transfer_check',
      text: `Suggestion: ${name}'s reset routine worked ${resets.length} times. Mention it to him before the next game and ask him to use it on his own.`,
      basis: resets.map((o) => o.id),
      count: resets.length,
      fromGame: false
    });
  }
  for (const [cat, st] of Object.entries(player.statuses)) {
    if (st === 'review') {
      out.push({
        id: `s-${player.id}-${cat}-review`,
        playerId: player.id,
        category: cat as Category,
        kind: 'review_due',
        text: `Reminder: ${CATEGORY_LABEL[cat as Category]} is marked due for review for ${name}. A short retention check at the next practice tells you whether it stuck.`,
        basis: [],
        count: 0,
        fromGame: false
      });
    }
  }
  return out;
}

/** Suggestions for everyone on a team, most evidence first. */
export function suggestionsForTeam(players: Player[], observations: Observation[], drills: Drill[], opts: { sinceDays?: number; now?: Date } = {}): Suggestion[] {
  return players.flatMap((p) => suggestionsFor(p, observations, drills, opts)).sort((a, b) => b.count - a.count);
}

/** Kids who were at the last `n` finished practices and got no note at any of them. Quiet kids get overlooked; this says so. */
export function attentionGaps(players: Player[], observations: Observation[], practices: Practice[], n = 3): Suggestion[] {
  const recent = practices.filter((p) => p.status === 'done').sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  if (recent.length < n) return [];
  const ids = new Set(recent.map((p) => p.id));
  const out: Suggestion[] = [];
  for (const p of players.filter((x) => x.status === 'active')) {
    const attendedAll = recent.every((pr) => pr.inputs.presentIds.includes(p.id));
    if (!attendedAll) continue;
    const noted = observations.some((o) => o.playerId === p.id && o.practiceId && ids.has(o.practiceId));
    if (!noted) out.push({ id: `s-${p.id}-quiet`, playerId: p.id, kind: 'no_attention', text: `${p.firstName} has been at the last ${n} practices with no note on him. Worth one look at his station next time.`, basis: [], count: 0, fromGame: false });
  }
  return out;
}

/** Areas with no station in the last `n` finished practices. */
export function lightCategories(practices: Practice[], n = 4): Category[] {
  const recent = practices.filter((p) => p.status === 'done').sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  if (!recent.length) return [];
  const seen = new Set<Category>();
  for (const p of recent) for (const b of p.blocks) for (const s of b.stations) {
    const c = stationCategory(s);
    if (c) seen.add(c);
  }
  return CATEGORIES.filter((c) => !seen.has(c) && c !== 'pitching' && c !== 'catching');
}
