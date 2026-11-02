# Dugout Lab

Personalized youth baseball practice planning and player development. Private, offline-first, installs on an iPhone from Safari (Add to Home Screen). No account, no server, no tracking. A separate app from Dugout Dad with its own data.

**Every kid is different. Every practice has a purpose. Every player should improve.**

## What it does

| Feature | Status |
|---|---|
| Living player profile: strengths, challenges, goals (technical and mental), cues that work, coaching approaches that work, confidence notes, response to frustration (observed), self-reflection, other teams | Working |
| Private notes in two taps from the field: got it, working on it, struggled, hesitated, confident, frustrated, reset worked, or free text; game notes from the Today screen | Working |
| Coach's own level (1 to 5) and status (introduced, practicing, reliable, shows up in games, due for review) per area, revisable any time | Working |
| Original drill library: 110 drills across hitting, throwing, catching, pitching, infield, outfield, baserunning, team defense, situations, athletic movement, Baseball IQ, mental skills; each with objective, setup, steps, cues, success, easier, harder, mental hook, decision hook, throwing load | Working |
| Custom drills, "make my version" of a library drill, hide drills | Working |
| Player-specific drill versions (same station, different job): objective, reps, distance, equipment, intensity, cues, success, mental piece; rated after practice (helped: yes, some, no) | Working |
| Practice generator: present and absent, length, coaches, equipment, space, indoor, team priorities, player goals, recent practice history, Pitch Smart flags; station-based blocks (warm-up, fundamentals, focused stations grouped by similar level, game-like decisions, compete, reflect) with group rotations and an objective for every player at every station, with the reason | Working |
| Regenerate one station; easier / base / harder per station; pick a specific drill; edit any player's objective; rename and note a station | Working |
| One-tap adjustments: shorter or longer, fewer or more coaches, player left or arrived late, rain (indoors), different equipment, no throwing for a player | Working |
| Live practice mode: timer per rotation, pause, +2 / -2, next and back, station tabs, the group in front of you, quick notes, "this station is not working" (easier, swap, merge), finish; live state survives closing the app | Working |
| Recap: wins, work on next, rate the custom versions, suggestions for next practice | Working |
| Suggestions from observations, always labeled "Suggestion" or "Suggestion, not a diagnosis", with the notes they are based on; game notes count | Working |
| Pitch Smart awareness: rest days from logged pitch counts, unknown counts and other-team players flagged, never "cleared" by missing data | Working |
| Progress: team grid of your assessments, due-for-review list, suggestions, attendance, what the team has worked on. No rankings | Working |
| Backup (ZIP with checksums) and restore (merge keeps newer local edits; replace for recovery) | Working |
| Roster import from a Dugout Dad weekend archive (explicit, previewed, never touches Dugout Dad) | Working |
| Family: parent contacts, what each family gets, home plan (two or three yard drills from his goals and notes, with cues, reps and a parent tip), text and email drafts opened in Messages or Mail (never auto-sent), printable scorecard with the team as an anonymous band, who-is-due list, update history | Working |
| Effort and attitude reads (hustled, good teammate, took the cue, went through the motions) in quick notes, drafts and scorecards | Working |
| Branding per team: program name, tagline, logo upload, eyedropper and auto palette from the logo, primary and accent colors that restyle the app, coaches with contacts, footer; carried onto scorecards, home plans and parent drafts. White-label build via `BRAND_NAME` / `BRAND_COLOR` | Working |
| Several coaches on their own phones: coach pack export (no private notes or contacts), notes tagged by coach, merge after practice with nothing overwritten | Working |
| Demo team (fictional, marked, removable) | Working |
| Offline: full app shell precached; verified reload with the network off and notes saved offline | Working |
| Voice notes, video reference clips, multi-coach live sync | Roadmap (see docs/ROADMAP.md) |

## Run it

- Live: see docs/IPHONE_SETUP.md for the address and install steps.
- Locally: `npm install`, `npm run build`, `node server.cjs`, open http://localhost:4174 (port 4174 so it never collides with Dugout Dad on 4173).
- Tests: `npm test` (engine, generator, suggestions, Pitch Smart, backup, Dugout Dad import). Browser walkthrough: `URL=http://localhost:4174/ node scripts/acceptance.cjs` (Playwright, iPhone 13 profile; runs acceptance tests A through G as far as a desktop browser can).

## Principles

See docs/DESIGN_PRINCIPLES.md. Short version: two taps during practice, one screen before it, depth behind a fold, words a parent uses, nothing required to start.

## Layout

- `src/engine/` types, practice generator, suggestions, Pitch Smart
- `src/data/` drill library, demo data
- `src/db/` Dexie (IndexedDB) database "dugout-lab"
- `src/io/` backup and Dugout Dad import
- `src/ui/` pages and components
- `docs/` architecture, research, decisions, roadmap, iPhone setup
