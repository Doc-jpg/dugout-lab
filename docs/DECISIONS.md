# Decisions and lessons

Newest first.

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
