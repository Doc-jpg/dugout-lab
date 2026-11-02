# Roadmap

## Phase 1 (done 2026-11-02)
Separate installable PWA, roster, private profiles and notes, original drill library, player-specific versions, practice generator with one-tap adjustments, live mode, history, basic progress, backup and restore, Dugout Dad roster import, demo team. Then in the same day: family drafts and scorecards, coach packs and merge, branding, age groups by graduation year, a simplicity pass, and a full QA and release-readiness audit (docs/DECISIONS.md).

## Next five (from the 2026-11-02 audit)
1. Real-device pass on an iPhone: share sheet for backups and scorecards, sms: and mailto: drafts, PIN relock, iframe print. Nothing here can be verified from a desktop browser.
2. Done 2026-11-02: guided tour (nine stops) and FAQ; freestyle notes typed or spoken with name, read and area guessed. Still open: stored voice clips for playback (not just transcription).
3. Season view: which categories a team has touched by week, so the generator's light-category hint has a picture behind it.
4. Voice note capture during live practice (MediaRecorder where allowed; transcription stays off-device and optional).
5. Drill library second edition: 20 more drills for the thin spots (catching, pitching for 8U to 10U, athletic movement indoors) and a coach-submitted drill review path.

## Phase 2
- Development cycles: plan a season as cycles per category with introduce / practice / reliable / transfer / review stages, and have the generator schedule retention checks.
- Suggestions from observations, next level: tie a suggestion to a specific saved version or progression and track whether it was tried.
- Mental-game routines as a per-player card (pre-at-bat routine, reset routine) printable for the dugout.
- Baseball IQ scenario generator tied to current team priorities (whiteboard questions and small-sided games).
- More detailed skill tracking per sub-skill (for example backhand vs forehand inside infield).
- Lineup and position planning view using the roster (no scoring).
- Voice notes: speech-to-text is in (browser recognition, needs a signal). Next: keep the audio clip with MediaRecorder for playback, and an offline transcription option.

## Phase 3
- Video reference links and locally stored clips, with no claims of mechanical diagnosis.
- Richer analytics with honest sample sizes.
- Done 2026-11-02: multi-coach sync by invite link with per-coach revocation (no accounts; a team key plus per-coach tokens).
- Parent-facing summaries delivered through a server (a link that stays current) rather than a file; never private notes. Phase 1 already drafts texts, emails, home plans and scorecards from the phone.
- Conflict review screen (what merged, what the newer edit replaced).

## Product and resale
- Per-team branding is in. Next for a sellable copy: a build script that takes a brand file (name, colors, icon PNGs) and produces the PWA; a hosted landing page per program; and the sync server from Phase 3 with team invite codes so a program can hand the app to its coaches without passing files.
- Pricing thought (not built): per program per season, with the drill library and parent pages as the value; keep the offline, no-account core free for a single coach.

## Housekeeping
- Hero Digitals feature list could not be verified (site blocked to fetches); revisit.
- Consider shifting a few warm-up drills from blocked to variable to balance the library's style mix.
- tests/library.test.ts gates the library: 110 drills, extras on every drill, no weighted-ball, max-velocity or headfirst-dive content, audit fixes stay applied.
