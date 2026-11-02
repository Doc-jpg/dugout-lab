# Decisions and lessons

Newest first.

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
