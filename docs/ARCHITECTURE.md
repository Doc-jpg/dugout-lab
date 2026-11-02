# Architecture

## Reused from Dugout Dad (inspected 2026-11-02)

Dugout Dad (https://github.com/Doc-jpg/dugout-dad) is a Vite + React + TypeScript PWA with Dexie (IndexedDB), fflate ZIP archives with SHA-256 manifests, a hash router, vite-plugin-pwa precaching, GitHub Pages deploy through `.github/workflows/pages.yml`, a zero-dependency static server, and Playwright acceptance scripts. All of that carries over unchanged in shape. Reused as code: `global.css` (recolored), `Sheet.tsx` (bottom sheet, toast, confirm), `hash.ts`, `server.cjs` (port changed), the Pages workflow, `tests/setup.ts` (fake-indexeddb).

Not reused: the scoring engine, stats, GameChanger import, SQLite export. Dugout Lab does not score games.

## Separation from Dugout Dad

- Different repository and GitHub Pages path, so a different manifest `id`, `start_url` and service-worker scope (`/dugout-lab/`). Service workers are scoped by path; the two never serve each other's files.
- Different IndexedDB database name (`dugout-lab` vs `dugout-dad`). On a laptop where both run under `doc-jpg.github.io` they share an origin but not a database. On an iPhone each home-screen app has its own storage container anyway.
- Different home-screen name, icon and colors (navy vs green).
- Roster sharing is file-based and explicit: Dugout Lab reads a Dugout Dad weekend archive (teams.json, players.json) after the coach picks the file, previews the plan, and confirms. Player ids are kept so a second import updates rather than duplicates. Nothing writes to Dugout Dad.

## Data

One Dexie database, tables: teams, players, drills, variants, practices, observations, throwing, settings, meta. Every record has `createdAt`/`updatedAt` (observations have `ts`), which backup merge uses: add if missing, replace if the backup copy is newer, keep and report if the local copy is newer. Practices embed their blocks, stations, groups and per-player objectives, so a plan is a self-contained document.

## Practice generator (src/engine/generator.ts)

Pure and deterministic for a seed. Steps:

1. Time budget by block kind (warm-up 12%, fundamentals 22%, focus 30%, game-like 20%, compete 11%, reflect 5%; compete dropped under 45 minutes, reflect under 30).
2. Station count = clamp(1..5) of max(min(ceil(present / 4), coaches + 1), ceil(present / 6)): groups of about four, never more than six, never more stations than coaches plus one player-led station (bucket and a task). Each block then fits its own rotation: a rotation is at least 4 minutes after 1-minute transitions, a drill is rejected when it needs more than twice the rotation and scored down when it needs more than the rotation; a block too short to rotate runs whole-team. Game-like blocks allow groups up to eight.
3. Groups: focus block groups kids of similar level so a station runs one progression; other blocks snake-draft for mixed groups.
4. Category weights from team priorities (3/2/1), each player's active goals, categories due for review, a floor for every category, and a discount for categories heavy in the last practice.
5. Candidate drills must pass hard rules (indoors, space, equipment, no high throwing load when anyone is resting an arm); these never relax. Soft rules (coach needed, group size, rotation length) relax step by step if nothing fits, then any drill of the block's kind, then any drill that passes the hard rules. Score = weight, block-style fit (fundamentals prefer blocked/variable, game-like prefer random/decision/game), penalty for drills used in the last two practices, spread of categories within a block, small jitter.
6. Objectives per player per station: saved player variant wins; else an active technical goal in the drill's categories; else the easier/base/harder text by the player's level in that category. A mental objective comes from the player's active mental goal, else the drill's mental hook in the focus block. No-throwing players get a rest instruction on any drill with throwing load; a player's own limits (no hitting, no running, until a date) prefix his objective the same way.
7. Rationale lines explain priorities, groups, avoided drills, absences and arm flags.

Edits keep the rest: `regenerateStation`, `setStationDrill`, `setStationProgression`, and `adjustPractice` (duration rescales blocks and keeps every objective; coaches merges stations; remove/add player; indoor and equipment swap only the stations that no longer fit; no-throwing swaps high-load stations and rewrites one player's objectives). `validatePractice` checks nobody is unassigned.

## Suggestions (src/engine/suggestions.ts)

Rules over observations in the last 30 days per player and category: two or more struggled/hesitated in a category suggests decision work (hesitation) or the easier progression (struggle) with a matching drill and the player's best cue; two frustrated suggests a reset routine and the coach's own confidence note; three good reads with no struggles suggests marking reliable and a game-like transfer check; due-for-review statuses become reminders. Every text starts with "Suggestion" and carries the observation ids it rests on.

## Pitch Smart (src/engine/pitchsmart.ts)

Daily limits and rest days by age from the public MLB / USA Baseball table (see docs/RESEARCH.md). Flags: rest (within required rest days), unknown (threw with no count, or plays for another team with nothing logged this week), ok. Flagged players start on the practice's no-throwing list.

## Offline

vite-plugin-pwa precaches the app shell (about 650 KB including the drill library). Data is in IndexedDB. Live practice state (block, rotation, elapsed seconds, running-since) is written to the practice record on every change and restored on reopen. Storage status: an installed home-screen app counts as safe (iOS never answers the persistence API), a browser tab shows an install prompt.
