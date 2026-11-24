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
- Done 2026-11-22 (v0.8.0): counted reps by sub-skill from narrated drills (backhand against forehand, throws on target, timing, contact and the rest), over last practice, last 5, last 10 or everything, on the Progress tab and as a parent page with text and email drafts. Next: let a coach tap a count in without narrating; counts on the printed scorecard; a coach-picked date range.
- Lineup and position planning view using the roster (no scoring).
- Voice notes: speech-to-text is in (browser recognition, needs a signal). Next: keep the audio clip with MediaRecorder for playback, and an offline transcription option.

## Phase 3
- Video reference links and locally stored clips, with no claims of mechanical diagnosis.
- Richer analytics with honest sample sizes.
- Done 2026-11-02: multi-coach sync by invite link with per-coach revocation (no accounts; a team key plus per-coach tokens).
- Parent-facing summaries delivered through a server (a link that stays current) rather than a file; never private notes. Phase 1 already drafts texts, emails, home plans, scorecards and (v0.8.0) progress pages from the phone. A standing link per family is the natural next step for the progress page, and it is the first thing that would put kids' data on a server, so it needs Deren's say-so.
- Conflict review screen (what merged, what the newer edit replaced).

## Product and resale
- Per-team branding is in. Next for a sellable copy: a build script that takes a brand file (name, colors, icon PNGs) and produces the PWA; a hosted landing page per program; and the sync server from Phase 3 with team invite codes so a program can hand the app to its coaches without passing files.
- Pricing thought (not built): per program per season, with the drill library and parent pages as the value; keep the offline, no-account core free for a single coach.

## Tryouts (v0.9.0, 2026-11-23)
- Next, from the first real nights: a tryout-only guest link (score without seeing the roster), timed and measured stations (60-yard run, radar), optional weights for the overall, tryout data in the backup file, turning an offered kid into a roster player in one tap (name and positions only).

## Practice reports for families (v0.10.0, 2026-11-24)
Done: one-page PDF per kid per practice, the send screen, line-by-line control of what goes home.
Open, waiting on Deren: how the right family gets filled in (pick in the share sheet as now, a private link in a pre-addressed text, or a mail service that sends). Then: paste a family contact list instead of typing each one; a parent-friendly way to tap a written note at the field so reports are not thin; the same letterhead and PDF for the scorecard, home plan and progress page; send the whole roster's PDFs as one batch to Files.

## Housekeeping
- Done 2026-11-16: compared with the Hero Digitals coaching product from Deren's screenshots; took the one real gap, drill diagrams (28 of 110 so far, v0.7.0). Next: the rest of the library where a picture helps, diagrams on the printed plan, a coach drawing his own.
- Consider shifting a few warm-up drills from blocked to variable to balance the library's style mix.
- tests/library.test.ts gates the library: 110 drills, extras on every drill, no weighted-ball, max-velocity or headfirst-dive content, audit fixes stay applied.
