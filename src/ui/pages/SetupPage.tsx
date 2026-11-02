import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTeam, createPlayer, saveSettings } from '../../db/db';
import { loadDemoData } from '../../data/demo';
import { ageGroupForClass, seasonYearFor, AGE_GROUPS, type AgeGroup } from '../../engine/types';
import { useToast } from '../components/Sheet';
import { parseRoster } from '../../engine/roster';

/** First run: three short steps and the coach is at a practice plan. Everything else can wait. */
export function SetupPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [coach, setCoach] = useState('');
  const [gradYear, setGradYear] = useState<number | undefined>(undefined);
  const [fixed, setFixed] = useState<AgeGroup | undefined>(undefined);
  const [roster, setRoster] = useState('');
  const [busy, setBusy] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const seasonYear = seasonYearFor();
  const years = Array.from({ length: 13 }, (_, i) => seasonYear + i);

  const saveTeam = async () => {
    setBusy(true);
    try {
      const ag = gradYear ? ageGroupForClass(gradYear) : fixed ?? '12U';
      const t = await createTeam({ name: name.trim(), ageGroup: ag, gradYear, priorities: [] });
      await saveSettings({ teamId: t.id, coachName: coach.trim() || undefined });
      setTeamId(t.id);
      setStep(2);
    } finally {
      setBusy(false);
    }
  };
  const saveRoster = async () => {
    if (!teamId) return;
    setBusy(true);
    try {
      let n = 0;
      for (const r of parseRoster(roster)) {
        await createPlayer({ teamId, firstName: r.firstName, lastName: r.lastName, number: r.number });
        n += 1;
      }
      toast.show(`${n} players added`);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>Set up</h1>
      <div className="muted small" style={{ marginBottom: 10 }}>Step {step} of 3. Two minutes, then you are planning a practice. Everything else (logo, colors, parents, goals) can come later.</div>

      {step === 1 && (
        <div className="card">
          <div className="field"><label>Team name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rattlers" autoFocus /></div>
          <div className="field"><label>Your first name (goes on parent notes as "Coach ...")</label><input className="input" value={coach} onChange={(e) => setCoach(e.target.value)} placeholder="Deren" /></div>
          <div className="field"><label>Graduation year of the kids</label>
            <div className="chips">{years.map((y) => <button key={y} className={`chip sm ${gradYear === y ? 'on' : ''}`} onClick={() => { setGradYear(gradYear === y ? undefined : y); setFixed(undefined); }}>{y} ({ageGroupForClass(y)})</button>)}</div>
            <div className="muted small">The age group then moves up every year on its own. School team or not sure? Pick a fixed age group instead:</div>
            <div className="chips" style={{ marginTop: 6 }}>{AGE_GROUPS.map((a) => <button key={a} className={`chip sm ${fixed === a && !gradYear ? 'on' : ''}`} onClick={() => { setFixed(a); setGradYear(undefined); }}>{a}</button>)}</div>
          </div>
          <button className="btn primary big-btn block" disabled={!name.trim() || (!gradYear && !fixed) || busy} onClick={saveTeam}>Next: the roster</button>
          <button className="btn block" style={{ marginTop: 8 }} onClick={async () => { setBusy(true); try { const r = await loadDemoData(); nav(`/practices/${r.practiceId}`); } finally { setBusy(false); } }} disabled={busy}>Or try the demo team first</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="field"><label>Roster, one per line: number then name</label><textarea className="input" rows={8} value={roster} onChange={(e) => setRoster(e.target.value)} placeholder={'1 Eli Flesher\n24 Hudson Fuerst\n4 AJ Todd'} autoFocus /></div>
          <div className="muted small" style={{ marginBottom: 8 }}>Paste it from a text or a spreadsheet column. Numbers are optional. You can also import it from a Dugout Dad export later in Settings.</div>
          <button className="btn primary big-btn block" disabled={!roster.trim() || busy} onClick={saveRoster}>Next: first practice</button>
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => setStep(3)}>Skip for now</button>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>You are set</h2>
          <p className="small">Next: generate a practice (who is here, how long, how many coaches) and run it from your phone. During practice, tap a kid's name and what you saw; that is the whole data entry. Goals, parent contacts and the program's logo can be added any time from a player's page and Settings.</p>
          <button className="btn primary big-btn block" onClick={() => nav('/practices/new')}>Generate the first practice</button>
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => nav('/today')}>Go to Today</button>
        </div>
      )}
      {toast.el}
    </div>
  );
}
