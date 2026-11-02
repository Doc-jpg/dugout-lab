import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTour } from '../components/Tour';
import { FAQ } from './faq';

/** Plain-English walkthrough. */
export function HelpPage() {
  const tour = useTour();
  const [q, setQ] = useState('');
  const hits = q.trim() ? FAQ.filter((f) => (f.q + ' ' + f.a + ' ' + (f.tags ?? '')).toLowerCase().includes(q.trim().toLowerCase())) : FAQ;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Link to="/today" className="btn ghost sm">‹ Today</Link>
        <Link to="/settings" className="btn ghost sm">Settings</Link>
      </div>
      <h1>How Dugout Lab works</h1>
      <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
        <div className="row between">
          <div className="grow"><strong>One-minute tour</strong><div className="small muted">Nine stops on the real screens. Take it any time.</div></div>
          <button className="btn primary" onClick={tour.start}>Take the tour</button>
        </div>
      </div>
      <div className="card">
        <h2>Questions coaches ask</h2>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: voice, rain, parents, backup…" aria-label="Search the questions" />
        <div style={{ marginTop: 8 }}>
          {hits.map((f) => (
            <details key={f.q} className="faq" open={q.trim().length > 0 && hits.length <= 3}>
              <summary>{f.q}</summary>
              <p className="small" style={{ margin: '4px 0 8px' }}>{f.a}</p>
            </details>
          ))}
          {hits.length === 0 && <div className="empty">Nothing matches. Try another word, or read on below.</div>}
        </div>
      </div>
      <div className="card">
        <h2>The idea</h2>
        <p className="small">Every kid is different, every practice has a purpose, every player should improve. The app keeps a living profile for each player, builds a station-based practice in seconds from who showed up, and gives every kid his own objective at every station. What you notice during practice goes in with two taps and comes back as suggestions, labeled as suggestions.</p>
      </div>
      <div className="card">
        <h2>The five screens</h2>
        <ol className="step-list small">
          <li><strong>Today</strong>: the next practice, arms to watch, player reminders, Start practice.</li>
          <li><strong>Practices</strong>: plan a new one, open a plan, see finished ones with their recap.</li>
          <li><strong>Players</strong>: the roster. Each profile answers: what does he need today, what did we do last time, what worked, what to try next.</li>
          <li><strong>Drills</strong>: the library plus your own. Any drill can get a version for one player (same station, different job).</li>
          <li><strong>Progress</strong>: your own level assessments by area, due-for-review checks, suggestions, attendance. No rankings.</li>
        </ol>
      </div>
      <div className="card">
        <h2>Before practice</h2>
        <ol className="step-list small">
          <li>Practices, + New practice. Tap anyone who is out, pick the length and how many coaches, check the gear, set today's priorities. Players flagged by Pitch Smart start on the no-throwing list; uncheck only if you know he is cleared.</li>
          <li>Generate. You get warm-up, fundamentals, focused stations, game-like decisions, a competition and a short reflection, with groups rotating so nobody stands in a line.</li>
          <li>Open any station to see every player's objective and where it came from (his goal, his saved version, or his level). Tap Regenerate this station to swap just that one. Easier / Harder changes the version without changing the drill. Change lets you pick a specific drill or rewrite a kid's objective.</li>
          <li>Adjust handles the surprises: fewer coaches, someone left or arrived late, rain, less gear, shorter practice. Objectives are kept wherever they still fit.</li>
        </ol>
      </div>
      <div className="card">
        <h2>During practice</h2>
        <ol className="step-list small">
          <li>Start practice. The timer runs the rotation; Next moves everyone. Pause, +2 and -2 are there for real life.</li>
          <li>Tap the station you are standing at to see its drill, cues, and the objectives of the group in front of you.</li>
          <li>Quick note, your way: tap a kid's name and a button; or tap + Note and say it ("Jonah hesitated on the cutoff") or type it, and the app fills in who, what you saw and the area for you to confirm. Five seconds either way.</li>
          <li>"This station is not working": run the easier version, swap the drill, or merge stations if you lost a coach.</li>
          <li>Finish: the recap lists wins and things to work on, asks whether each custom version helped, and shows suggestions for next time. Everything is saved on the phone, online or not.</li>
        </ol>
      </div>
      <div className="card">
        <h2>Between practices</h2>
        <ul className="step-list small">
          <li>Game note on Today: "Jonah hesitated on the cutoff." It counts the same as a practice note and shows up as a suggestion when a pattern forms.</li>
          <li>Player, Progress tab: set his level per area (1 introducing to 5 game-ready) and whether the skill is introduced, practicing, reliable, showing up in games, or due for review. Your call, changeable any time.</li>
          <li>Pitches thrown: log games and bullpens, including other teams. Missing data never means cleared.</li>
          <li>Back up after a few practices (Settings). Restore merges and never throws away a newer note on this phone.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Parents</h2>
        <ul className="step-list small">
          <li>Player, Family tab: add a parent's mobile or email and choose what the family gets (update and home work, plus a scorecard, or nothing).</li>
          <li>The update is drafted from your notes: wins first, what we are working on, two or three yard drills with cues and reps, a parent tip. Tap Text or Email, read it, change anything, then send it yourself from Messages or Mail. The app never sends.</li>
          <li>The scorecard shows his levels and recent notes, and the team as a band per area (lowest, middle, highest, how many assessed). No other kid is named or listed.</li>
          <li>What stays private: your notes on how he handles frustration, the text of your observations, and anything about teammates.</li>
          <li>Today, Parent updates: who is due (after a set number of practices), one tap to the draft.</li>
          <li>Quick notes now include effort and attitude as things you saw: Hustled, Good teammate, Took the cue, Went through the motions.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Small things that save time</h2>
        <ul className="step-list small">
          <li><strong>Limits</strong>: on a player's page, "Not today" sets no throwing, no hitting or no running for a stretch. Every plan honors it until the date you set.</li>
          <li><strong>Use this plan again</strong>: at the bottom of any plan. The drills stay, the objectives are rebuilt for who is here that day.</li>
          <li><strong>Groups</strong>: in a plan, Adjust, Move a player, to move a kid between groups for a block.</li>
          <li><strong>Coach notes</strong> on every station: open it for the common mistakes with the fix, the safety line if there is one, spacing, and a way to make it a game.</li>
          <li><strong>Lock</strong>: Settings, Lock with a PIN, if the phone gets handed around at the field. Forgot it? Erase and restore from a backup.</li>
          <li><strong>Attention gaps</strong>: Today tells you when a kid has been at three practices with no note. Quiet kids get overlooked; this is the nudge.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Age groups</h2>
        <p className="small">Teams run 6U through 18U, one per year, plus HS. Give a team its graduation year ("Class of 2032") and the age group follows the calendar: 13U this season, 14U next, with fall ball counting toward the coming spring. Pitch Smart limits and drill age gates follow the number. A school team or a one-off can use a fixed age group instead.</p>
      </div>
      <div className="card">
        <h2>Your program's look</h2>
        <ul className="step-list small">
          <li>Settings, Branding: program name ("Performance Baseball"), tagline, logo, colors, coaches with contact info, a footer line.</li>
          <li>Upload the logo, then tap it to pick colors with the eyedropper, or tap "Auto-pick from logo". The primary color restyles the app; both colors and the logo go on every scorecard and home plan, with the coaches listed at the bottom.</li>
          <li>Branding is per team, so one phone can hold more than one program.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Assistant coaches</h2>
        <ul className="step-list small">
          <li>Settings, Other coaches, "Send a coach pack": pick who it is for, or add a new person. The pack carries his name and has the roster, drills, player versions and the plan, with no family contacts and none of your private notes. He opens it on his phone and taps "Set up this phone as Mark." Nothing to type.</li>
          <li>He runs his station from the same plan and takes quick notes on his phone. After practice he backs up and sends you the file; you tap "Merge a coach's backup". Notes add up and show who wrote them. If you both edited the same kid, goals, cues and levels are combined, not replaced. Nothing of yours is overwritten.</li>
          <li>His notes come back tagged with the name you put on the pack, whatever his phone says. Your list shows when each pack went out and when notes came back. iPhone or Android, same app.</li>
        </ul>
      </div>
      <div className="card">
        <h2>What it will not do</h2>
        <ul className="step-list small">
          <li>Diagnose a child, assign a label, or rank kids against each other. Notes describe behavior you saw.</li>
          <li>Invent results. A skill is not "improved" until you say so.</li>
          <li>Prescribe weighted balls, max-velocity work or heavy loading for kids.</li>
          <li>Replace your judgment on injuries, soreness or return to play.</li>
          <li>Send anything anywhere. No account, no server; the backup file is yours.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Dugout Dad</h2>
        <p className="small">Separate app, separate data. Dugout Lab can read a Dugout Dad weekend archive to copy a roster (Settings, Roster from Dugout Dad). It never changes anything in Dugout Dad.</p>
      </div>
    </div>
  );
}
