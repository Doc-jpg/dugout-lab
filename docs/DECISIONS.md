# Decisions and lessons

Newest first.

## 2026-11-02, simplicity pass (Deren: depth with ease of use for non-technical coaches)

- Wrote docs/DESIGN_PRINCIPLES.md (two taps during practice, one screen before, depth behind a fold, parent words, nothing required to start, defaults do the work, say why).
- First run is a three-step setup page (team and class year or age group, paste roster, generate) instead of Settings. Demo stays one tap away.
- New practice has Quick start at the top: the usual setup, one Generate button; the full form sits below.
- Live quick note: four big buttons, the other seven reads under "More".
- Player edit: basics, then "Coaching notes" and "More" folded.
- Jargon removed from lists (levels written out, style words in plain English), legend under the progress grid.


## 2026-11-02, age groups (Deren: "why only even numbers?")

- Age groups are 6U to 18U one per year, plus HS. Pitch Smart brackets and drill age gates derive from the number (`ageOf`); old "16U+" values still parse.
- A team can carry a graduation year ("Class of 2032"). `teamAgeGroup` computes the age group for the season: `18 - (gradYear - seasonYear)`, with `seasonYearFor` treating August onward as the coming spring's season (fall ball plays up). The team moves up on its own every year. Fixed age group remains for school teams and one-offs.
- Pitch Smart has no 6U row; 6U uses the 7-8 row.


## 2026-11-02, branding (Deren: "think about it from a product standpoint")

- Branding lives on the team (`Team.brand`): program name, tagline, logo (resized to 320 px, stored as a data URL), primary and accent, coaches with contacts, footer. Per team, so one install can carry several programs; the app name in Settings is only the fallback.
- Logo colors: `paletteFromPixels` buckets pixels (skipping transparent, white-ish and gray) and `suggestPair` picks the most used plus the most different; the eyedropper samples the canvas on tap. Button color is a darkened shade when the primary is too pale for white text (`usableAsAccent`, `inkFor`).
- The primary recolors the live app through CSS variables (`--accent`, `--accent-ink`); scorecards and home plans get a brand bar (logo, name, tagline), brand colors, and a coaches footer; email drafts sign with coach, program, and that coach's contact line.
- White-label build: `BRAND_NAME` and `BRAND_COLOR` env vars set the installed app's name and theme color at build time (manifest, Apple title), for a reseller copy. The in-app program name still overrides on screen.
- Limitation to remember: the home-screen icon label is fixed when the user adds it; renaming inside the app does not rename the icon. A white-label build does.
- Tests: 37 vitest (brand helpers, branded exports and signatures); `scripts/branding.cjs` runs upload, palette, auto-pick, eyedropper, recolor and the branded scorecard in a browser.


## 2026-11-02, family side (Deren: "parents have no idea")

- Parent communication is drafts only: the app builds the text and opens Messages (`sms:` link) or Mail (`mailto:`), or hands over a printable HTML file through the share sheet. Nothing is sent by the app, and every draft is logged (kind, channel, text) so "who is due" works.
- Scorecards show the player's own levels and recent reads plus the team as a band per area (low, middle, high, count assessed). Deren asked for "everyone else, redacted"; on a 12-kid roster a redacted list is still identifiable, so bands replaced rows. Same information about where he stands, no way to pin it on a teammate.
- What never goes to a parent: `responseNotes`, `confidenceNotes`, raw observation text, anything about other players. Drafts use counts and categories only. Tone: wins first, "what we are working on", never "correction" or "punishment".
- Home plans pick two or three yard-sized drills (space tight or half, one adult at most, two players at most, home gear only, no high throwing load) from active technical goals, then rough-note categories, then the lowest assessed area. A saved player version wins; goal words are matched against drill names and tags so "drop step" finds the drop-step drill.
- Effort and attitude are observed behaviors in the quick-note chips (Hustled, Good teammate, Took the cue, Went through the motions), not ratings.
- Family opt-out is a per-player setting (`share: 'none'`) and the due list respects it.
- Several coaches, no server: a coach pack (roster without private fields or family contacts, drills, versions, open practices) goes to each assistant; after practice each one backs up and the head coach merges. Observations carry `by` (the coach's name from Settings). Merge keeps the head coach's private player fields even when the assistant's copy of the player is newer (`keepPrivate`), because a pack-stripped record would otherwise erase them. Tested end to end in suggestions_backup.test.ts.
- Multi-coach live sync stays Phase 3: the data model already merges by record (backup merge), which is the hard part; the server, accounts and roles are the remaining work. Decision: ship to one coach first, build sync only if two or more adopt it.
- Tests: 30 vitest; browser walkthrough extended with the family flow (contact, home plan, text and email drafts without private note text, scorecard popup with band and no teammate names, parents page).


## 2026-11-02, Phase 1 build

- Built as a separate PWA next to Dugout Dad, same stack, own repository and Pages path, own IndexedDB name, own icon. Roster sharing is an explicit file import from a Dugout Dad weekend archive, never a direct read of the other app's database (home-screen apps on iOS cannot see each other's storage anyway).
- The individualized objective is the center: every station carries one objective per player with its origin (saved version, goal, level, drill, or coach). Saved player versions of a drill always win.
- Suggestions are rules over the coach's own notes and always say "Suggestion"; two notes make a pattern, one does not. Nothing is inferred from a single rep, from video, or from a label.
- Pitch Smart flags default a player onto the no-throwing list; the coach can take him off. Unknown workload is never treated as cleared (the prompt's rule).
- Hard constraints (indoors, space, equipment, resting arms) never relax in the generator's fallbacks; the first browser run found a rain swap pulling in an outdoor-only drill because the fallback dropped the indoor filter. Fixed in `candidatePool`.
- Research lives in docs/RESEARCH.md: Pitch Smart table confirmed from MLB's pages; Hero Digitals could not be read (blocked), so its advertised feature list is taken from the prompt and flagged unverified; branded hitting and mental-game sources are summarized as optional perspectives.
- Tests: 21 vitest (generator incl. acceptance A and D, variants, adjustments, throwing; suggestions incl. acceptance E; Pitch Smart; persistence incl. B; backup round trip and merge incl. G; Dugout Dad import). Browser script `scripts/acceptance.cjs`: demo, plan, regenerate one station, 90 to 60, live mode with timer and reload, easier version, recap with labeled suggestion, player page (E), drill version persists after reload (B), new practice with Pitch Smart flags, backup and restore into a fresh profile (G), offline reload and an offline note (C as far as a desktop browser can go).
- Deployment: same GitHub Pages workflow as Dugout Dad. Needs the `Doc-jpg/dugout-lab` repository to exist and the Claude GitHub app to be allowed into it.

## Lessons for the first real practice

- The plan is a draft. Expect to regenerate two or three stations the first time; the generator learns nothing from that yet, so write the lesson here.
- Quick notes are the whole data entry. If a kid gets no note, nothing is assumed about him.

## 2026-11-02, QA, product audit and release-readiness pass

Method: inventory of every screen and engine function; a second agent did a cold read of the code for correctness, data integrity and privacy; a third audited all 110 drills; vitest stress tests (rosters 1 to 30 with 1, 2 and 4 coaches, 20-minute and 120-minute practices, no gear, tight space, indoors, every arm resting, 6U and HS, two-coach merge, v1 to v2 migration, cascading deletes); then a Playwright walk of the coach flows on an iPhone 13 viewport. Walkthroughs are simulated; no coach feedback was collected.

Found and fixed (P0 to P2, all verified by test or script):
- P0: New practice page could loop (a filtered array rebuilt each render fed a reset effect). Memoized and keyed the one-time seeding.
- Backup cancel on iOS counted as a backup; now a two-step sheet and `shareOrDownload` reports cancelled.
- Printables opened with `window.open` fail in an installed iOS app; scorecards and home plans now open in an in-app sheet (iframe) with Print and Share.
- Settings text fields wrote to the database per keystroke; now save on blur.
- Station notes were hidden behind a `category:` prefix; `Station.category` is its own field with a migration shim.
- Toast timers leaked; cleared on unmount.
- Generator: fallback could drop hard rules (indoor drill outdoors); group split 4,4,4,1; four-minute rotations on twelve-minute drills; game-like groups capped at five. Fixed in `candidatePool`, `similarGroups`, rotation-aware filtering and `stationCount`.
- Today showed Start practice for a plan days away; now Open the plan until the day.
- Recap had two Finish buttons; one now. Variant ratings save on tap. Attendance can be corrected in the recap.
- Deleting a player or practice left orphans; cascades now cover observations, variants, throwing, parent updates and planned practices.
- Toolchain: react-router 6 moderate advisory, upgraded to 7; vite 6, vitest 5, vite-plugin-pwa 1.x. Zero critical or high; ten moderate dev-only in the workbox build chain.

Drill audit (own assessment, not quoted feedback): library graded 8/10 before fixes. Twenty drills changed in text; the one unsafe item was a harder variant that bounced baseballs off a wall at a fielder's face, replaced with faster tennis balls and a called hop. Other fixes: distance caps by age on long toss, pop-fly and relay drills; the bullpen-style catching and pitching drills now carry high throwing load; live at-bats capped at 20 pitches and counted as the day's bullpen; feet-first slides and getting back standing gated on the sliding drill for 10U; full L-screen and 15 feet for 13U and up on short front toss; 21 outs became 15 with one coach hitting. Every drill now carries coaching extras (common mistakes with the fix, a safety line where one exists, how to make it a game, spacing), merged at seed time from `drills-extra.ts` and shown on the drill page and under Coach notes on each station. `LIBRARY_VERSION` 2 refreshes untouched library drills on next open. `tests/library.test.ts` keeps all of this true.

Deliberately unchanged:
- No accounts, server or sync. The merge-by-record model is in; the server is Phase 3 and only if a second coach adopts it.
- No voice notes yet (browser permissions on an installed iOS app are uneven; roadmap).
- Suggestions stay rules over the coach's own notes with a count behind each one; nothing statistical pretends to be more than it is.
- Scorecards keep the team band, never names; the "went through the motions" count stays off parent pages.
- Quick-note vocabulary stays at four big buttons plus More. Adding reads is cheap; adding buttons is not.

Rollback: branch `rollback/pre-audit-2026-11-02` (commit 31b9880). Restore by pointing main at it; the IndexedDB schema did not change in this pass, so old data opens.

## 2026-11-02, tour, FAQ and freestyle notes

- Deren asked for a tour he can revisit, an FAQ, and notes by voice or free text that land on the right kid without a long form. "Everybody has their own preferences": the note sheet now takes a note three ways (tap, say, type) and the same sheet serves Today, live practice and the player page.
- Name matching is rules over the roster the coach is looking at (present kids in live mode, active roster elsewhere): exact first or last name, number ("number 7", "#7"), nicknames the coach added, then typo and speech slips (prefix, one edit, a rough sound key). Shared first names drop to a "Maybe" and offer the other kid; the full name or the number settles it. A confidence word ("Sounds like", "Maybe", "Could be") is always shown so nothing files silently on the wrong kid. Reads and areas come from keyword lists; the coach can override every piece and the override sticks while he keeps typing.
- Speech uses the browser's recognition (Safari and Chrome send audio to Apple or Google), so it needs a signal and the mic permission. With neither, the keyboard mic still dictates into the same box, which the FAQ says. Stored audio clips stay on the roadmap.
- Tour: nine stops on the real screens with the real element lit, offered once on Today, from the last setup step, and from Help any time. It navigates to the latest open practice for the plan stops and falls back to the list.
- Tests: tests/notes.test.ts (7) and new acceptance checks (typed note guessing who, read and area; a slip marked as a maybe; nine tour stops; FAQ search). 90 unit tests, 63 browser checks.

## 2026-11-02, two coaches, two phones: no overwriting, attribution always, Android

- Deren is fine with two copies that reconcile by file, as long as nothing is written over, nothing has to be entered twice, and every note says whose it is. Checked the merge rather than assuming: it was whole-record newer-wins, so a goal he added Tuesday would have been erased by a cue Aaron added Thursday. A test now proves that case both directions.
- Fix: `mergePlayer` combines lists that grow (goals by id, cues, strengths, challenges, approaches, positions, nicknames), keeps a level or status the newer copy never set, and still lets the newer record win on plain fields. Private fields never leave the head coach's phone. Observations are append-only by id and never overwrite.
- Attribution: every backup and coach pack carries the sender's coach name in the manifest; a note that left a phone before the coach typed his name is credited to the sender on merge, and the restore screen asks for the name if it is still blank. The restore sheet says "From Aaron, Nov 2".
- A fresh phone restoring a coach pack now ends up pointed at the team; a Replace restore never imports another coach's name, PIN or tour flag.
- Android: the app is a plain web app, which is the point. Both browser walkthroughs run green as a Pixel 5 (Chromium, the engine Android Chrome uses) and as an iPhone 13. The install path, share sheet, file picker and speech recognition are all standard on Android Chrome. Real-device checks still pending on both platforms.

## 2026-11-02, packs made for a person

- Deren wanted attribution set on his end, not typed by the helper: "I indicate who I'm sending the pack to, and it's tagged as that person the entire time." So a team keeps a list of helpers (name, role, pack sent, notes back). A coach pack is made for one of them; the manifest carries `recipient` and `kind: 'coach-pack'`. Restoring such a pack sets `settings.packIdentity` on that phone: the name is locked in Settings, notes are stamped with it, and the phone's own backups carry the recipient. When the head coach merges one of those backups, every note is stamped with the recipient's name whatever the phone said (`forcedBy`), and the helper's `lastReceivedAt` is set.
- One-button setup on the helper's side ("Set up this phone as Mark"): replace if the team is not on the phone, merge if it is. Quick picks from the helper list and from the branding coaches list; new person is a first name and an optional role.
- Tested end to end in the browser (pack for Mark, fresh phone, locked name, a note by voice-or-text, backup, merge, note on the kid tagged Mark) and in vitest with a tampered `by`.

## 2026-11-02, linked phones (Deren: "I don't want to send packs or get on anyone's phone")

Deren asked for the Athletic Lab sync design applied to coaches: named invite links instead of packs, automatic two-way sync, per-coach revocation, same merge rules, packs kept as the no-signal fallback.

- **Server:** the same free Supabase project as Athletic Lab, two new tables (`dugout_members`, `dugout_records`; schema in `docs/sync-schema.sql`, applied in the dashboard SQL editor from Deren's Chrome). The Athletic Lab `records` table is untouched. Two secrets ride in headers and are stored only as hashes: the team key (made once, in every invite link) and a per-coach token (made per invite). A request sees a team's rows only when the key matches and the token belongs to a member who is not revoked. Only a head member can add or revoke members; the first member of a brand-new team is the head coach's own phone.
- **Attribution is the server's job.** The trigger stamps every accepted row with the writing member's invite name and the client sets a note's `by` from it on pull, so a phone cannot change whose notes they are (tested with a tampered `by`). Equal or older stamps are no-ops on the server, which also kills the echo a phone would otherwise send after pulling.
- **Merge rules are the backup's** (`mergeRecord`: players field by field with list unions, everything else newer wins). A merge that added something is stamped newer than both sides so the union travels on (found by the goal-union test; equal stamps would have stalled it).
- **What never leaves the head coach's phone:** family contacts, private player fields, parent update history, settings, untouched library drills. Helpers push notes, pitch counts, versions, practice progress and player edits; their deletions of players, teams and drills are ignored.
- **Revocation:** a helper's write comes back 401; the client checks its own member row and marks the phone revoked, which stops the loop and shows "Your access was turned off by the head coach." A revoked phone with nothing to send asks once per quiet sync. Turning him back on works from the head phone; his phone needs a fresh invite only if it left the team.
- **When:** open, foreground, back online, two seconds after a change (Dexie hooks dispatch `dugout-lab:changed`; pulls are applied with the gate quiet so they do not re-kick), every two minutes while open. `digest()` lives in Supabase's `extensions` schema; functions with a locked search_path must call it as `extensions.digest`.
- **Keepalive:** `.github/workflows/keepalive.yml` pings `dugout_records` every three days, like Athletic Lab's.
- **Tested:** 7 sync tests on a fake server with the schema rules (join, attribution, unions, roster to helper, tombstones and helper limits, revocation and isolation, offline skip), one live round trip against the real project (`LIVE_SYNC=1 npm test`), and the browser walk now invites Aaron by link on a second simulated phone through the live server: his phone sets itself up, a note flows back tagged Aaron, a goal flows to him, revocation stops him. 80 checks as iPhone 13 and as Pixel 5.

## 2026-11-11, narrate a drill (Deren: "one free form dictation that gets parsed and sorted and applied at the end")

- Deren wants to keep his eyes on the drill and talk: name, two or three things about the fielding, two or three about the throw, next kid, rapid fire, then sort it out at the end with a "is this what you meant" step.
- `src/engine/narrate.ts`: `splitNarration` starts a new rep at every roster name (first, last, nickname, "number 7", full names as one, shared first names flagged, capitalized near misses as a "Maybe"; bare numbers are counts, not jerseys; ordinary lowercase words never split). Each rep gets detail tags from keyword lists (fielding, transfer, throw, hitting, pitching), a read worked out from the tags (all good Got it, all bad Struggled, a mix Working on it; behavior reads like hesitated or hustle still win), the station's area, and the coach's words. The same kid twice is two reps, on purpose: that is rep-level data.
- `NarrateSheet`: focus chips (Fielding, Hitting, Pitching, Anything) with the say-it-in-this-order reminder on top, one big dictation box with a live "4 reps heard" line, then a review list where a rep can be moved to another kid, confirmed, joined to the one above, trimmed of a detail, or dropped. Nothing saves before review. Notes carry `tags` (new optional field; it syncs and backs up like any other).
- Dictation keeps listening through pauses (`useSpeech` keep-alive restarts the recognizer when the phone ends it) until the coach taps stop. Needs a signal like the Talk button; the keyboard mic works without one.
- Open, for the real-phone pass: how well iPhone dictation holds up outdoors with wind and kids, and whether it capitalizes roster names reliably. Next step if this gets used: per-kid tallies from the tags (backhand 3 of 5 clean) on Progress.
- Tests: tests/narrate.test.ts (6) and nine new browser checks.

## 2026-11-11, keepalive made nightly and self-sustaining

Supabase warned Deren that his family-history project would pause for inactivity (that one was a skipped workflow, fixed in its own repo the same day). He asked that the same never happen here. The keepalive now runs every night about 2:23 AM Central instead of every three days, and does a real write and read-back in a throwaway keepalive team rather than an empty read, plus a read of Athletic Lab's table. Because GitHub turns off schedules in a repo with no commits for 60 days, the job commits `.github/heartbeat` whenever the last commit is three weeks old. A red run means the database did not answer; restore it from the dashboard.

## 2026-11-14, dark brand colors in dark mode (v0.6.1)

The team is moving under the Warriors program, whose colors are a very dark navy (#0d2241) and a mid blue (#286aa5). Branding stays per team and is set on the phone (Settings, Branding, upload the logo, Auto-pick), so no logo ships in this public repository. What needed code: the app's dark-mode page color is itself navy (#0e1626), so a navy primary made buttons, links and the active tab disappear. `brandCss(brand, dark)` now checks the primary against the dark page; if it does not reach 4.5 to 1 it switches to the brand's lighter color and lightens that until it does (Warriors comes out #5186b6 with dark text). Light mode is unchanged. `App.tsx` listens for the phone switching between light and dark. Mid-tone brands (the old teal) also get a slightly lighter shade in dark mode for the same reason. Placeholder team names changed from Rattlers to Warriors. Tests: one new case in tests/brand.test.ts; full acceptance and branding walkthroughs pass.

## 2026-11-16, drill diagrams (v0.7.0) (Deren: "do the diagrams. Double check your work for completeness and accuracy in how you visually represent them")

Deren sent screenshots of a paid coaching product whose main draw is animated drill diagrams and asked what was worth taking. Diagrams were the one clear gap: every drill here was words only.

- **A diagram is data, not a drawing.** `src/engine/diagram.ts` describes who stands where, who runs, and where the ball goes, one step at a time. The same data is checked by rules, drawn as a picture (`DrillDiagram.tsx`), and played. Nothing is traced or copied from anyone's diagrams; each one was written from the drill's own setup and steps.
- **The rules a picture must pass** (tests/diagrams.test.ts, 48 tests): first base on the right and every fielder on his own side; corner infielders off the base paths; every ball starts in someone's hands (or off the plate with a coach beside it) and ends in someone's hands; runners go round the bases the right way; no two markers on top of each other at the start or after any step; no line through a person it has nothing to do with unless the picture says the throw is meant to pass him (a cutoff man, the pitcher on a throw to second); no words on a line or off the edge; nothing leaves the picture; every sentence short enough to read out loud.
- **Then every picture was looked at.** `npm run diagrams` draws all of them next to the drill's words. That pass caught what rules cannot: a first baseman standing on the base path (moved in `PLACES`), a slow roller drawn 52 ft out when the drill says 20 to 40, a coach drawn beside the L-screen instead of behind it, a made-up "20 to 30 ft" backup distance (removed; every distance on a picture now comes from the drill's words), a throw from right field to third drawn on top of the runner's path (the single is now pulled toward the line and the first baseman holds the runner), a feeder at 22 ft where the drill says 30, and crowded plays that needed a closer view.
- **Honest limits, said on the picture.** Not to scale for every age (the words carry the real distances). Cutoff and coverage assignments are the common ones and the note says to coach it your way if your program differs. A coach's own copy of a drill keeps the original's picture with a line saying to go by his words if he changed it.
- **Where it shows:** the drill page (between setup and steps), any station in a plan or at practice behind "Show the diagram", and a "diagram" tag in the drill list. Works offline; no video, no outside files.
- **Covered so far: 28 of 110 drills**, the ones where a picture adds the most (positions, cutoffs, coverages, baserunning reads): infield 003 004 005 006 007 009; outfield 001 003 006 008; baserunning 001 003 004 005 006 008; team defense 001 002 003 004 005 008; throwing 005 006 011; pitching 008; catching 005; hitting 004. Many of the other 82 are single-player mechanics drills where a field picture adds little; the next batch should be chosen by what coaches actually open.
- **Not done:** diagrams on the printed plan; a way for a coach to draw his own.


## 2026-11-22, progress over time for parents (v0.8.0) (Deren, after a Pocket Radar "Player Profiles" ad: "an ongoing access for a parent to see their kid's ongoing results and trends? Maybe not a login or portal but the reports can be individual and cumulative or trends or the most recent X number")

- **No login, no portal.** The page goes out the way the scorecard does: the coach opens it, shares the file or drafts a text or email, and sends it himself. A link that stays current would put kids' data on a server, which this app does not do; that stays a separate decision (Phase 3).
- **Where the numbers come from.** Narrated reps already carry details. A skill is a pair of them, what went right and what went wrong (`SKILLS` in `src/engine/progress.ts`): fielding the ball, backhand side, forehand side, getting to the ball, glove to hand, throws, timing, contact, swing decisions, pitches, delivery. "Backhand side 10 of 12 clean" means twelve reps were called out with a backhand and ten were clean. A rep that says both sides of a skill is not counted either way. A test keeps the skill list and the narration word list in step.
- **Stretches.** Last practice, last 5, last 10, everything. A session is a finished practice he was at or any day with a note about him. The stretch before it is everything earlier. Asked for five with three on record, it says three.
- **A change is only named when it beats chance.** Counts are always shown as they are. "Up" or "down" needs at least 8 counted reps in both stretches and a gap past a two-proportion z of 1.96 (about 19 in 20). Otherwise "about the same", or "too few reps to say". Seven of eight against three of eight is up; five of eight against four of eight is not. Reason: a parent handed "up" will act on it, and with a dozen reps most gaps are luck.
- **Thin data says so.** Fewer than 5 counted reps and fewer than 3 notes in the stretch puts "Not much written down yet" at the top of the page and in the drafts.
- **Him against himself only.** No teammate, no team band (that is the scorecard), no raw note text, no private profile fields. Narrated reps are not counted a second time as quick reads. When every fielding rep was on one side, the general "Fielding the ball" row is dropped so the same numbers do not appear twice.
- **Levels then and now.** New `levelLog` on the player: each time the coach sets a level it is logged, so the page can say "was 2 Building on Oct 20". A level that existed before the log began is kept as the starting point with no date. The log is unioned when two phones merge. Only a level raised inside the stretch is announced in the text draft; older moves are on the full page.
- **Family setting.** The page is offered to every family that is not opted out. "Plus scorecard" still gates the page that shows the team band.
- **Where it shows:** player, Progress tab ("Counted reps, over time", every row, for the coach) and Family tab ("How he is doing, over time", with Progress page, Text it, Email it). Each draft or share is logged under "Sent before" as progress.
- **Left out on purpose:** per-session charts (three dots invite a line through noise), any speed or measurement (none exists here; Dugout Vision is unproven), game statistics (Dugout Dad's), and a team table of counts (it would read as a ranking).
- **Checked:** tests/progress.test.ts (21 tests) and scripts/progress.cjs (31 browser checks on the demo team: Ellis's backhand goes up, his throws read about the same, Jonah holds steady, Hank has nothing counted).

## 2026-11-23, tryouts with several coaches scoring (v0.9.0) (Deren, the morning of the first of two tryout nights: "allow us to run tonight's and next week's tryouts with inputs from at least me, if not me and Aaron, and maybe another Warriors coach or two ... compare and assimilate our inputs to make decisions ... flexible and fluid to whatever specific drills or whatever quantity of kids show up")

- **Built in Dugout Lab, not Dugout Dad,** because linked phones already exist here. Today, Tryouts.
- **The one place kids are compared.** The app's rule is no rankings; a tryout is a selection decision, so the Board ranks. It is coach-only, says so on the screen and on the printout, feeds no parent page, scorecard or player profile, and a kid trying out is a `Candidate`, never a `Player`. The head coach can delete the whole tryout when the choices are made, and the deletion reaches the linked phones.
- **What is kept about a kid:** name, tonight's number, positions, current team, one short note. No birthday, parent or phone number; a sign-up sheet pasted with its heading row has those columns dropped (tested).
- **Flexible on purpose.** Kids: paste a list or add a walk-up in one sheet, from any coach's phone. Stations: add, rename, reorder, hide at any time; a hidden or renamed station keeps its marks. Nights: any number; marks are per night.
- **Scale:** 1 to 5 against our own team (1 not at our level yet, 2 below our middle, 3 fits our middle, 4 would play a lot, 5 standout), so two coaches mean the same thing by a 3. Plus a yes, maybe or no and notes.
- **Blind scoring.** The scoring screen shows only this coach's marks, so nobody is steered by someone else's number. The Board shows everyone.
- **How the Board adds up** (`src/engine/tryout.ts`): a station is the average of the coaches, each coach counted once however many nights he scored (his own nights averaged first). A station nobody scored is left out of the overall, not counted as zero. Coaches 2 or more apart at a station get a shaded box. A coach's lean is his latest one. Overall is the plain average of the scored stations; no weighting, on purpose, because the coaches should argue about weights out loud.
- **One record per mark.** The id is built from tryout, kid, station, night and coach, so tapping again updates the same record on any phone. Clearing keeps the record (no value) so the clearing syncs; nothing is deleted by a helper. Kids are taken "off the list" (hidden), not deleted.
- **Sync:** three new tables ride the existing server with no server change (`tbl` is free text). The server's coach name overwrites `by` on pulled marks, as it does for notes. A phone on the older app skips rows of tables it does not know but still moves its pull mark, so `SYNC_SCHEMA` (now 2) makes an updated phone do one full pull.
- **A linked coach's phone waits for the head coach's tryout** ("Check now") instead of offering to start a second one.
- **Limits, said plainly:** inviting a coach through linked phones also shows him this team's roster and plans (there is no tryout-only guest yet). Two coaches editing the station list in the same minute: the later save wins. Tryout data is not in the backup file yet (linked phones hold copies). Numbers only as 1 to 5; no stopwatch or radar fields.
- **Checked:** tests/tryout.test.ts (18), two more in tests/sync.test.ts, `scripts/tryout.cjs` (34 browser checks, made-up kids), and `scripts/tryout-live.cjs`: two phones through the live server, the second coach waiting then joining with one tap, blind scoring, a walk-up and a station added from the second phone, the board on both, a mark made with no signal arriving later, delete reaching the other phone. Not yet used at a field.

## 2026-11-23, what a kid is wearing (v0.9.1) (Deren, same morning: "add a way to physically identify them, like something about what they're wearing, just in case we don't remember all the names. Like, you know, bright green shirt")

- Each tryout kid can carry a short "what he is wearing" tag, shown as a highlighted pill under his name on the scoring screen, on his board sheet and on the printed board. Clothes only.
- It is kept **per night**, because next week he will be in a different shirt: night two's scoring screen shows "+ what he is wearing" again instead of last week's clothes. The board with all nights shows each night's tag.
- Set it when adding a kid, or tap the pill (or the "+ what he is wearing" link) on the scoring screen. Any linked coach can set it and it reaches the others like any other edit to a kid.

## 2026-11-23, nobody reads the scale upside down (v0.9.2) (Deren, same morning: "Is your system also clear on one being bad and five being good? ... Make it abundantly clear and simple")

- Yes: 5 is best everywhere. Averages, the board's order (highest on top) and the colors all assume it.
- **Said three ways on the scoring screen, with nothing to tap:** a card at the top ("5 is best. 1 is lowest." then "Compare each kid with our own team. A 3 is about our average player." then "Did not see it? Leave it blank. A blank is not held against him."); the words lowest, average and best printed on the 1, 3 and 5 buttons of every row; and color (a red edge under 1 through a green edge under 5, and the picked button fills with that color). The colors are fixed, not the team's brand colors, so they read the same on every phone.
- **Plainer words for the five:** 5 one of our best, 4 above our average, 3 about our average player, 2 below our average, 1 well below our team. Behind "See what each number means", best first.
- **Board:** "Higher is better." and the same sentence at the top; 4 and up in green, 2 and down in red. The printed board leads with the sentence too. One constant (`SCALE_RULE`) feeds every screen and printout so the wording cannot drift.

## 2026-11-23, the Warriors look is the default (v0.9.3) (Deren: "add the Warriors branding to the app ... just as a default? I don't think any other team is gonna use this right now ... we're gonna try this for a full season before we ever consider it going outside of just my hands")

- One object, `HOUSE_BRAND` in `src/engine/brand.ts`: Warriors Baseball, "Stewards Sports Guthrie | Baseball Development", navy #0D2241, blue #286AA5, footer "Warriors • Stewards Sports Guthrie". `brandFor(team)` is what every screen and parent page now asks for.
- **All or nothing per team.** A team that has set its own name, color or logo keeps exactly what it set and never picks up Warriors words (the Dirtbags demo stays the Dirtbags). A team that has set none of those gets the whole house look, plus any coaches it has listed.
- The app's own first-paint colors and the installed app's bar are the same navy, so nothing flashes blue-then-navy. Dark mode uses the lightened blue (#5186b6) that v0.6.1 worked out.
- The Branding sheet opens pre-filled with the house look for a team still on it, so adding a logo and saving keeps the name and colors.
- **The logo is in the code, by Deren's yes.** The repository and the site are public and the logo is the program's, so Claude left it out and asked; Deren said yes the same evening. It is the W mark at 224 px in src/data/house-logo.ts (about 32 KB), the only real program's image in the repository. A team can still upload a different logo for itself on the phone.
- **The tryout board prints with the team header, sideways.** After night one Deren asked for a branded copy to keep and send to the other coaches before anything could be changed by accident. The board page now carries the team's name, logo and color, prints landscape so eight stations fit, and puts each coach's mark on its own line. It still says coaches only. Released the evening of 2026-11-23, after the tryout ended, instead of the next morning.
- No religion in the tagline or footer (Deren, 2026-11-14). No coach names in the code; coaches are listed per team on the phone.
- To hand the app to another program later: change `HOUSE_BRAND`, or empty it for a plain app. The white-label build variables still set the installed name and bar color.
- **Released the morning after it was built,** not during the first tryout night, so the app did not update itself under two coaches mid-scoring.

## 2026-11-23, the tryout report (v0.9.4) (Deren, after night one: "include all the commentary ... put it under each kid and just like delineate which coach said it ... eliminate drills or categories of drills that we didn't run tonight and only include the three kids that showed up")

- **The printed board is now a report of what happened.** A kid with no mark, lean or note is left out. A station nobody scored is left out. A line at the bottom says what was left out, so nothing vanishes silently. The on-screen Board still lists everyone.
- **Summary first, then kid by kid.** The summary keeps the averages and the shaded disagreements. Each kid then gets every coach's marks side by side, who leans yes, maybe or no by name, the decision, and every note grouped under the coach who wrote it with the station it was about.
- **It prints upright unless more than five stations were run**, then sideways.
- **Why in the app and not made by Claude:** the marks live on the coaches' phones and the linked-phone server under the team's key. Claude does not hold that key and the kids' names stay out of Claude's workspace and the public code, so the report is made on the phone.

## 2026-11-23, the report as a real PDF and dressed as the Warriors (v0.9.5) (Deren, same night: "Print doesn't work" and then, on seeing the first report, "I need way more effort on branding please")

- **Print never worked from the iPhone home screen.** An app opened from the home screen gets no print dialog from the system, so the Print button did nothing and "Print, then save as PDF" was a dead end. The Print button is now hidden there and stays where a phone or computer can print.
- **Share as PDF.** The Board's report sheet makes a real PDF on the phone (src/io/tryoutPdf.ts, jsPDF, loaded only when the sheet opens and cached for use with no signal) and the main button shares it: Messages, Mail, AirDrop, Save to Files. The PDF is made as the sheet opens, not on the tap, because an iPhone only opens its share sheet in direct answer to a tap. If the PDF cannot be made, the button falls back to sharing the page file and says so.
- **One rule for what is in it.** reportScope in src/engine/tryout.ts decides the kids, stations and columns for both the on-screen page and the PDF, so they cannot disagree. The Yes / Maybe / No and Decision columns only appear when somebody used them. With "All nights" picked while only one night has marks, the report names that night.
- **Dressed as the program's document.** Color bar, the Warriors wordmark, a navy band with the letterhead line and a "Coaches only" pill, table heads and each kid's name bar in navy with the blue as the second color, an Overall badge per kid, a footer on every page. Another team gets the same layout in its own colors with its logo and name; colors are checked so words stay readable on them.
- **The wordmark is now in the public code** (src/data/house-logo.ts, 760 px, about 27 KB), next to the W mark. Deren approved the logo in the code earlier the same evening and then asked for much stronger branding; the wordmark is that same logo. Told to him plainly in the reply; he can have it taken out.
- **Upright unless the summary has more than eight columns.** Six stations fit upright and read better on a phone.

## 2026-11-23, the report says the minute it was made (v0.9.6)

- Deren exported the PDF, then saw different numbers on the Board. Nothing was wrong: a coach's marks changed after the export (three averages each moved by exactly what one coach lowering a 2 to a 1 would do). But "as of Nov 23" could not show that. The report now says the time of day it was made and says in its top box that it is a copy and later changes are only in the app.
