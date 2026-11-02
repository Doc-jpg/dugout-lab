import React from 'react';
import { Link } from 'react-router-dom';

/** Plain-English walkthrough. */
export function HelpPage() {
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Link to="/today" className="btn ghost sm">‹ Today</Link>
        <Link to="/settings" className="btn ghost sm">Settings</Link>
      </div>
      <h1>How Dugout Lab works</h1>
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
          <li>Quick note: tap a kid's name, then Got it, Struggled, Hesitated, Frustrated, Reset worked, or type a few words. That is the whole data entry.</li>
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
