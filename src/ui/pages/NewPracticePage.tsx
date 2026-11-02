import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePlayers, useGeneratorContext, useSettings, useThrowing } from '../hooks';
import { savePractice, playerName } from '../../db/db';
import { generatePractice, validatePractice } from '../../engine/generator';
import { throwingFlags } from '../../engine/pitchsmart';
import { lightCategories } from '../../engine/suggestions';
import { usePractices } from '../hooks';
import { CATEGORIES, CATEGORY_LABEL, EQUIPMENT_LABEL, SPACE_LABEL, today, teamAgeGroup, activeRestrictions, RESTRICTION_LABEL, type Category, type Equipment, type Space, type PracticeInputs } from '../../engine/types';
import { useToast } from '../components/Sheet';

/** The inputs a volunteer coach actually has: who showed up, how long, how many helpers, what gear, where. */
export function NewPracticePage() {
  const team = useCurrentTeam();
  const players = usePlayers(team?.id);
  const settings = useSettings();
  const throwing = useThrowing();
  const ctx = useGeneratorContext(team?.id);
  const nav = useNavigate();
  const toast = useToast();
  const active = useMemo(() => players.filter((p) => p.status === 'active'), [players]);

  const [date, setDate] = useState(today());
  const [time, setTime] = useState('17:30');
  const [duration, setDuration] = useState(settings.defaultDurationMin);
  const [coaches, setCoaches] = useState(settings.defaultCoaches);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [space, setSpace] = useState<Space>(settings.defaultSpace);
  const [indoor, setIndoor] = useState(false);
  const [equipment, setEquipment] = useState<Set<Equipment>>(new Set(settings.defaultEquipment));
  const [priorities, setPriorities] = useState<Category[]>(team?.priorities ?? []);
  const [noThrow, setNoThrow] = useState<Set<string>>(new Set());
  const [avoid, setAvoid] = useState<Set<Category>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDuration(settings.defaultDurationMin);
    setCoaches(settings.defaultCoaches);
    setSpace(settings.defaultSpace);
    setEquipment(new Set(settings.defaultEquipment));
  }, [settings.defaultDurationMin, settings.defaultCoaches, settings.defaultSpace, settings.defaultEquipment]);
  useEffect(() => {
    if (team) setPriorities(team.priorities);
  }, [team]);

  const flags = useMemo(() => (team ? throwingFlags(active, throwing, teamAgeGroup(team), date) : new Map()), [team, active, throwing, date]);
  const pastPractices = usePractices(team?.id);
  const light = useMemo(() => lightCategories(pastPractices).filter((c) => !priorities.includes(c)).slice(0, 3), [pastPractices, priorities]);
  // Anyone Pitch Smart flags (rest or unknown) or with a no-throwing limit starts on the no-throwing list; "out" starts absent.
  // Seeded once per distinct set (a stable string key), so the coach's own taps are never overwritten.
  const seedKey = useMemo(() => {
    const next: string[] = [];
    const out: string[] = [];
    for (const [id, f] of flags) if (f.status !== 'ok') next.push(id);
    for (const p of active) {
      const lim = activeRestrictions(p, date);
      if (lim.some((r) => r.kind === 'no_throwing')) next.push(p.id);
      if (lim.some((r) => r.kind === 'out')) out.push(p.id);
    }
    return `${[...new Set(next)].sort().join(',')}|${[...new Set(out)].sort().join(',')}`;
  }, [flags, active, date]);
  useEffect(() => {
    const [rest, out] = seedKey.split('|');
    setNoThrow(new Set(rest ? rest.split(',') : []));
    if (out) setAbsent((prev) => new Set([...prev, ...out.split(',')]));
  }, [seedKey]);

  if (!team || !ctx) return <div className="empty">Set up a team first.</div>;

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    setter(n);
  };
  const togglePriority = (c: Category) => {
    if (priorities.includes(c)) return setPriorities(priorities.filter((x) => x !== c));
    if (priorities.length >= 4) return toast.show('Four priorities is plenty; take one off first');
    setPriorities([...priorities, c]);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const presentIds = active.filter((p) => !absent.has(p.id)).map((p) => p.id);
      const playerPriorities: Record<string, Category[]> = {};
      for (const p of active) {
        const cats = [...new Set(p.goals.filter((g) => g.status === 'active').map((g) => g.category))];
        if (cats.length) playerPriorities[p.id] = cats;
      }
      const inputs: PracticeInputs = {
        teamId: team.id, presentIds, absentIds: [...absent], durationMin: duration, coaches, equipment: [...equipment], space, indoor,
        teamPriorities: priorities, playerPriorities, noThrowingIds: [...noThrow].filter((id) => presentIds.includes(id)), avoid: [...avoid]
      };
      const practice = generatePractice(inputs, ctx, { date, time });
      const problems = validatePractice(practice, ctx.players);
      if (problems.length) practice.rationale.push(`Check: ${problems.join('; ')}`);
      await savePractice(practice);
      nav(`/practices/${practice.id}`, { replace: true });
    } catch (e: any) {
      toast.show(`Could not generate: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const present = active.length - absent.size;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => nav(-1)}>‹ Back</button>
      </div>
      <h1>New practice</h1>

      <div className="card" data-tour="quickstart" style={{ borderLeft: '4px solid var(--accent)' }}>
        <div className="section-title" style={{ marginTop: 0 }}><h3>Quick start</h3><span className="muted small">your usual setup</span></div>
        <div className="small" style={{ marginBottom: 8 }}>{present} of {active.length} here · {duration} min · {coaches} coach{coaches === 1 ? '' : 'es'} · {indoor ? 'indoors' : 'outside'}{noThrow.size ? ` · ${noThrow.size} resting an arm` : ''}</div>
        <button className="btn primary big-btn block" onClick={generate} disabled={busy || present === 0}>{busy ? 'Building…' : 'Generate practice'}</button>
        <div className="muted small" style={{ marginTop: 6 }}>Change anything below first if today is different: who is out, how long, the gear, where.</div>
        {light.length > 0 && <div className="small" style={{ marginTop: 8 }}>Light lately: {light.map((c) => <button key={c} className="chip sm" style={{ marginRight: 4 }} onClick={() => togglePriority(c)}>+ {CATEGORY_LABEL[c]}</button>)} <span className="muted">(no station in the last few practices; tap to add as a priority)</span></div>}
      </div>

      <div className="card">
        <div className="inline-fields">
          <div className="field"><label>Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>Start</label><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div className="field"><label>How long</label>
          <div className="chips">{[45, 60, 75, 90, 120].map((m) => <button key={m} className={`chip ${duration === m ? 'on' : ''}`} onClick={() => setDuration(m)}>{m} min</button>)}
            <input className="input" style={{ width: 80 }} type="number" min={20} max={240} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || '0', 10))} onBlur={() => setDuration(Math.max(20, Math.min(240, duration || 60)))} />
          </div>
        </div>
        <div className="field"><label>Coaches and helpers (including you)</label>
          <div className="chips">{[1, 2, 3, 4].map((n) => <button key={n} className={`chip ${coaches === n ? 'on' : ''}`} onClick={() => setCoaches(n)}>{n}</button>)}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Who is here</h3><span className="muted small">{present} of {active.length}; tap anyone who is out</span></div>
        <div className="chips">
          {active.map((p) => (
            <button key={p.id} className={`chip ${absent.has(p.id) ? 'struck' : ''}`} onClick={() => toggle(absent, p.id, setAbsent)}>
              {p.number ? `#${p.number} ` : ''}{playerName(p, 'short')}{activeRestrictions(p, date).length ? ` (${activeRestrictions(p, date).map((r) => RESTRICTION_LABEL[r.kind].toLowerCase()).join(', ')})` : ''}
            </button>
          ))}
          {active.length === 0 && <span className="muted small">No players on the roster yet.</span>}
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Arms</h3><span className="muted small">no hard throwing today</span></div>
        <p className="muted small" style={{ marginTop: 0 }}>Pitch Smart rest days and unknown workloads start checked. Uncheck only if you know he is cleared.</p>
        <div className="chips">
          {active.filter((p) => !absent.has(p.id)).map((p) => {
            const f = flags.get(p.id);
            return (
              <button key={p.id} className={`chip ${noThrow.has(p.id) ? 'on' : ''}`} onClick={() => toggle(noThrow, p.id, setNoThrow)} title={f?.message}>
                {playerName(p, 'short')}{f && f.status !== 'ok' ? ` (${f.status === 'rest' ? 'rest' : '?'})` : ''}
              </button>
            );
          })}
        </div>
        {[...flags.entries()].filter(([id, f]) => f.status !== 'ok' && !absent.has(id)).map(([id, f]) => <div key={id} className="small muted" style={{ marginTop: 6 }}>{playerName(players.find((p) => p.id === id), 'first')}: {f.message}</div>)}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Where and what</h3></div>
        <div className="field"><label>Space</label>
          <div className="chips">{(['tight', 'half', 'full'] as Space[]).map((s) => <button key={s} className={`chip sm ${space === s ? 'on' : ''}`} onClick={() => setSpace(s)}>{SPACE_LABEL[s]}</button>)}</div>
        </div>
        <label className="switch row between" style={{ marginBottom: 10 }}><span>Indoors (gym or cage)</span><input type="checkbox" checked={indoor} onChange={(e) => setIndoor(e.target.checked)} /></label>
        <div className="field"><label>Equipment on hand</label>
          <div className="chips">{(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => <button key={e} className={`chip sm ${equipment.has(e) ? 'on' : ''}`} onClick={() => toggle(equipment, e, setEquipment)}>{EQUIPMENT_LABEL[e]}</button>)}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Team priorities today</h3><span className="muted small">in order, up to four</span></div>
        <div className="chips">{CATEGORIES.map((c) => { const i = priorities.indexOf(c); return <button key={c} className={`chip sm ${i >= 0 ? 'on' : ''}`} onClick={() => togglePriority(c)}>{i >= 0 ? `${i + 1}. ` : ''}{CATEGORY_LABEL[c]}</button>; })}</div>
        <div className="field" style={{ marginTop: 10 }}><label>Go light on</label>
          <div className="chips">{CATEGORIES.map((c) => <button key={c} className={`chip sm ${avoid.has(c) ? 'struck' : ''}`} onClick={() => toggle(avoid, c, setAvoid)}>{CATEGORY_LABEL[c]}</button>)}</div>
        </div>
        <p className="muted small">Each player's own goals are folded in automatically; you will see them as the objective at every station.</p>
      </div>

      <button className="btn primary big-btn block" onClick={generate} disabled={busy || present === 0}>{busy ? 'Building…' : 'Generate practice'}</button>
      {toast.el}
    </div>
  );
}
