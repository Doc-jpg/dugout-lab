import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlayer, useObservations, useDrills, useVariants, usePractices, useThrowing, timeAgo, fmtDate, useTeam } from '../hooks';
import { updatePlayer, addGoal, addObservation, addThrowing, playerName, db } from '../../db/db';
import { suggestionsFor } from '../../engine/suggestions';
import { throwingFlags } from '../../engine/pitchsmart';
import {
  CATEGORIES, CATEGORY_LABEL, LEVEL_LABEL, STATUS_LABEL, APPROACH_LABEL, POSITIONS, AGE_GROUPS, today, teamAgeGroup,
  type Category, type Level, type SkillStatus, type CoachingApproach, type Player, type Hand, type Position, type Goal
} from '../../engine/types';
import { READ_LABEL } from './LivePracticePage';
import { Sheet, Confirm, useToast } from '../components/Sheet';
import { FamilyPanel } from '../components/FamilyPanel';

/**
 * The living profile. Answers, at the top: what does he need to work on today, what did we do
 * last time, what worked, what should we try next.
 */
export function PlayerPage() {
  const { playerId = '' } = useParams();
  const p = usePlayer(playerId);
  const team = useTeam(p?.teamId);
  const observations = useObservations(playerId);
  const drills = useDrills();
  const variants = useVariants().filter((v) => v.playerId === playerId);
  const practices = usePractices(p?.teamId);
  const throwing = useThrowing();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'today' | 'profile' | 'notes' | 'progress' | 'family'>(window.location.hash.endsWith('#family') ? 'family' : 'today');
  const [editing, setEditing] = useState(false);
  const [goalSheet, setGoalSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [throwSheet, setThrowSheet] = useState(false);
  const [levelSheet, setLevelSheet] = useState<Category | null>(null);
  const [del, setDel] = useState(false);
  const suggestions = useMemo(() => (p ? suggestionsFor(p, observations, drills) : []), [p, observations, drills]);
  if (!p) return <div className="empty">Player not found.</div>;

  const lastPractice = practices.filter((x) => x.status === 'done' && x.inputs.presentIds.includes(p.id))[0];
  const lastObjectives = lastPractice ? lastPractice.blocks.flatMap((b) => b.stations.map((s) => ({ drill: drills.find((d) => d.id === s.drillId)?.name, o: s.objectives.find((o) => o.playerId === p.id) }))).filter((x) => x.o) : [];
  const worked = [...observations.filter((o) => o.read === 'got_it' || o.read === 'reset_worked' || o.read === 'confident')].slice(0, 3);
  const helpedVariants = variants.filter((v) => v.helped === 'yes');
  const flag = team ? throwingFlags([p], throwing, teamAgeGroup(team), today()).get(p.id) : undefined;
  const activeGoals = p.goals.filter((g) => g.status === 'active');
  const attendance = practices.filter((x) => x.status === 'done');
  const attended = attendance.filter((x) => x.inputs.presentIds.includes(p.id)).length;

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => nav('/players')}>‹ Players</button>
        <button className="btn sm" onClick={() => setEditing(true)}>Edit</button>
      </div>
      <h1 style={{ marginBottom: 0 }}>{p.number ? `#${p.number} ` : ''}{playerName(p)}</h1>
      <div className="muted small">{[p.positions.join('/'), p.bats ? `bats ${p.bats}` : '', p.throws ? `throws ${p.throws}` : '', p.ageGroup, p.experience].filter(Boolean).join(' · ')}{p.status !== 'active' ? ' · inactive' : ''}</div>
      {flag && flag.status !== 'ok' && <div className="banner warn small" style={{ marginTop: 6 }}>Arm: {flag.message}</div>}

      <div className="chips" style={{ margin: '10px 0' }}>
        {(['today', 'profile', 'notes', 'progress', 'family'] as const).map((t) => <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t === 'today' ? 'Today' : t === 'profile' ? 'Profile' : t === 'notes' ? `Notes (${observations.length})` : t === 'progress' ? 'Progress' : 'Family'}</button>)}
      </div>

      {tab === 'today' && (
        <>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Work on today</h3><button className="btn sm" onClick={() => setGoalSheet(true)}>+ Goal</button></div>
            {activeGoals.length === 0 && <div className="muted small">No active goal. Add one technical and, if it helps, one mental objective; they become his objectives at every station.</div>}
            <div className="list">
              {activeGoals.map((g) => (
                <div key={g.id} className="item small">
                  <div className="grow"><div><strong>{CATEGORY_LABEL[g.category]}</strong>{g.kind === 'mental' ? ' (mental)' : ''}{g.fromPlayer ? ' · his words' : ''}</div><div>{g.text}</div></div>
                  <button className="btn sm" onClick={async () => { await updatePlayer(p.id, { goals: p.goals.map((x) => (x.id === g.id ? { ...x, status: 'done', doneAt: new Date().toISOString() } : x)) }); toast.show('Goal done'); }}>Done</button>
                </div>
              ))}
            </div>
            {p.cues.length > 0 && <div className="small" style={{ marginTop: 8 }}><strong>Cues that work:</strong> {p.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>}
            {p.approaches.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>Coach him with: {p.approaches.map((a) => APPROACH_LABEL[a]).join(', ')}</div>}
            {p.confidenceNotes && <div className="small" style={{ marginTop: 4 }}><strong>Builds him up:</strong> {p.confidenceNotes}</div>}
          </div>

          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Last time</h3>{lastPractice && <Link to={`/practices/${lastPractice.id}`} className="small">{fmtDate(lastPractice.date)}</Link>}</div>
            {!lastPractice && <div className="muted small">No finished practice with him yet.</div>}
            {lastObjectives.slice(0, 6).map((x, i) => <div key={i} className="small">· {x.drill}: {x.o!.technical}</div>)}
          </div>

          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>What worked</h3></div>
            {worked.length === 0 && helpedVariants.length === 0 && <div className="muted small">Nothing marked yet. "Got it" and "Reset worked" notes land here, and so do drill versions you rated as helping.</div>}
            {helpedVariants.map((v) => <div key={v.id} className="small">· His version of {drills.find((d) => d.id === v.drillId)?.name}: {v.name}</div>)}
            {worked.map((o) => <div key={o.id} className="small">· {READ_LABEL[o.read]}{o.category ? ` (${CATEGORY_LABEL[o.category].toLowerCase()})` : ''}{o.text ? `: ${o.text}` : ''} · {timeAgo(o.ts)}</div>)}
          </div>

          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Try next</h3></div>
            {suggestions.length === 0 && <div className="muted small">Suggestions show up when two or more notes point the same way.</div>}
            {suggestions.map((s) => (
              <div key={s.id} className="suggestion" style={{ padding: '6px 10px', marginBottom: 6 }}>
                <div className="tag">Suggestion{s.fromGame ? ' · from a game' : ''}</div>
                <div className="small">{s.text}</div>
                {s.drillId && <Link to={`/drills/${s.drillId}`} className="small">Open drill ›</Link>}
              </div>
            ))}
          </div>

          <div className="row wrap">
            <button className="btn" onClick={() => setNoteSheet(true)}>+ Note</button>
            <button className="btn" onClick={() => setThrowSheet(true)}>+ Pitches thrown</button>
          </div>
        </>
      )}

      {tab === 'profile' && (
        <>
          <div className="card">
            <h3>Strengths</h3>
            {p.strengths.length ? <ul className="small step-list">{p.strengths.map((s) => <li key={s}>{s}</li>)}</ul> : <div className="muted small">None written yet.</div>}
            <h3 style={{ marginTop: 10 }}>Current challenges</h3>
            {p.challenges.length ? <ul className="small step-list">{p.challenges.map((s) => <li key={s}>{s}</li>)}</ul> : <div className="muted small">None written yet.</div>}
            <h3 style={{ marginTop: 10 }}>How he responds to frustration, pressure, mistakes</h3>
            <div className="small">{p.responseNotes || <span className="muted">Observed behavior only; write what you see, not a label.</span>}</div>
            {p.selfReflection && <><h3 style={{ marginTop: 10 }}>In his own words</h3><div className="small">{p.selfReflection}</div></>}
            {p.otherTeams && <div className="small muted" style={{ marginTop: 8 }}>Also plays for: {p.otherTeams} (throwing workload may be incomplete)</div>}
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Edit profile</button>
          </div>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>His drill versions</h3><Link to="/drills" className="small">Drills</Link></div>
            {variants.length === 0 && <div className="muted small">None yet. Open any drill and tap "Make a version for a player".</div>}
            {variants.map((v) => <Link key={v.id} to={`/drills/${v.drillId}`} className="item tappable"><div className="grow"><div className="title">{v.name}</div><div className="sub">{drills.find((d) => d.id === v.drillId)?.name}{v.helped ? ` · helped: ${v.helped}` : ''}</div></div><span className="chev">›</span></Link>)}
          </div>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Goals, all</h3></div>
            {p.goals.filter((g) => g.status !== 'active').map((g) => <div key={g.id} className="small muted">· {CATEGORY_LABEL[g.category]}: {g.text} ({g.status}{g.doneAt ? `, ${timeAgo(g.doneAt)}` : ''})</div>)}
            {p.goals.every((g) => g.status === 'active') && <div className="muted small">No finished or paused goals.</div>}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => updatePlayer(p.id, { status: p.status === 'active' ? 'inactive' : 'active' })}>{p.status === 'active' ? 'Mark inactive' : 'Mark active'}</button>
            <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={() => setDel(true)}>Delete player</button>
          </div>
        </>
      )}

      {tab === 'notes' && (
        <>
          <div className="row wrap" style={{ marginBottom: 8 }}><button className="btn" onClick={() => setNoteSheet(true)}>+ Note</button></div>
          <div className="list">
            {observations.map((o) => (
              <div key={o.id} className="item small" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div><strong>{READ_LABEL[o.read]}</strong>{o.category ? ` · ${CATEGORY_LABEL[o.category]}` : ''}{o.source === 'game' ? ' · game' : ''}{o.drillId ? ` · ${drills.find((d) => d.id === o.drillId)?.name ?? ''}` : ''}</div>
                  {o.text && <div>{o.text}</div>}
                  <div className="muted">{timeAgo(o.ts)}{o.by ? ` · ${o.by}` : ''}</div>
                </div>
                <button className="btn sm ghost" onClick={async () => { await db.observations.delete(o.id); toast.show('Removed'); }} aria-label="Remove">✕</button>
              </div>
            ))}
            {observations.length === 0 && <div className="empty">No notes yet.</div>}
          </div>
          <p className="muted small">Private to you. Notes never appear in team summaries.</p>
        </>
      )}

      {tab === 'progress' && (
        <>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Where he is, by area</h3><span className="muted small">tap to set</span></div>
            <p className="muted small" style={{ marginTop: 0 }}>Your call, revisable any time. Introducing (1) to game-ready (5). Not assessed stays blank; the generator assumes the middle.</p>
            <div className="list">
              {CATEGORIES.map((c) => {
                const lvl = p.levels[c];
                const st = p.statuses[c];
                return (
                  <button key={c} className="item tappable" style={{ textAlign: 'left' }} onClick={() => setLevelSheet(c)}>
                    <div className="grow"><div className="title">{CATEGORY_LABEL[c]}</div><div className="sub">{lvl ? `${LEVEL_LABEL[lvl]}` : 'not assessed'}{st ? ` · ${STATUS_LABEL[st]}` : ''}</div></div>
                    <span className="level-dots">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={lvl && n <= lvl ? 'on' : ''} />)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Trend, plainly</h3></div>
            <TrendLines observations={observations} />
            <div className="small muted" style={{ marginTop: 6 }}>Attendance: {attended} of {attendance.length} finished practices.</div>
          </div>
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}><h3>Throwing log</h3><button className="btn sm" onClick={() => setThrowSheet(true)}>+ Add</button></div>
            {throwing.filter((t) => t.playerId === p.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((t) => <div key={t.id} className="small row between"><span>{fmtDate(t.date)} · {t.kind.replace('_', ' ')} · {t.pitches == null ? 'count unknown' : `${t.pitches} pitches`}{t.note ? ` · ${t.note}` : ''}</span><button className="btn sm ghost" onClick={() => db.throwing.delete(t.id)}>✕</button></div>)}
            {!throwing.some((t) => t.playerId === p.id) && <div className="muted small">Nothing logged. Missing data never means cleared; log games and bullpens, including other teams.</div>}
          </div>
        </>
      )}

      {tab === 'family' && <FamilyPanel player={p} />}

      {editing && <EditPlayerSheet p={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast.show('Saved'); }} />}
      {goalSheet && <GoalSheet p={p} onClose={() => setGoalSheet(false)} onSaved={() => { setGoalSheet(false); toast.show('Goal added'); }} />}
      {noteSheet && <NoteSheet p={p} onClose={() => setNoteSheet(false)} onSaved={() => { setNoteSheet(false); toast.show('Note saved'); }} />}
      {throwSheet && <ThrowSheet p={p} onClose={() => setThrowSheet(false)} onSaved={() => { setThrowSheet(false); toast.show('Logged'); }} />}
      {levelSheet && <LevelSheet p={p} category={levelSheet} onClose={() => setLevelSheet(null)} onSaved={() => { setLevelSheet(null); toast.show('Saved'); }} />}
      {del && <Confirm title={`Delete ${playerName(p, 'first')}?`} text="His profile, goals, notes and drill versions are removed from this device. Backups keep their copy." danger yesLabel="Delete" onNo={() => setDel(false)} onYes={async () => { await db.transaction('rw', [db.players, db.observations, db.variants, db.throwing], async () => { await db.observations.where('playerId').equals(p.id).delete(); await db.variants.where('playerId').equals(p.id).delete(); await db.throwing.where('playerId').equals(p.id).delete(); await db.players.delete(p.id); }); nav('/players'); }} />}
      {toast.el}
    </div>
  );
}

/** Counts by read over the last 30 and previous 30 days, per category. No percentages, no scores. */
function TrendLines({ observations }: { observations: import('../../engine/types').Observation[] }) {
  const now = Date.now();
  const recent = observations.filter((o) => now - new Date(o.ts).getTime() <= 30 * 86400000);
  const before = observations.filter((o) => { const age = now - new Date(o.ts).getTime(); return age > 30 * 86400000 && age <= 60 * 86400000; });
  const cats = [...new Set([...recent, ...before].map((o) => o.category).filter(Boolean))] as Category[];
  if (!cats.length) return <div className="muted small">No categorized notes in the last 60 days.</div>;
  const good = (o: import('../../engine/types').Observation) => o.read === 'got_it' || o.read === 'confident' || o.read === 'reset_worked';
  const bad = (o: import('../../engine/types').Observation) => o.read === 'struggled' || o.read === 'hesitated' || o.read === 'frustrated';
  return (
    <div className="list">
      {cats.map((c) => {
        const r = recent.filter((o) => o.category === c);
        const b = before.filter((o) => o.category === c);
        return <div key={c} className="small row between"><span><strong>{CATEGORY_LABEL[c]}</strong></span><span>last 30 days: {r.filter(good).length} good, {r.filter(bad).length} rough{b.length ? ` · before that: ${b.filter(good).length} good, ${b.filter(bad).length} rough` : ''}</span></div>;
      })}
    </div>
  );
}

function EditPlayerSheet({ p, onClose, onSaved }: { p: Player; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ firstName: p.firstName, lastName: p.lastName, number: p.number ?? '', ageGroup: p.ageGroup, throws: p.throws, bats: p.bats, positions: p.positions, experience: p.experience ?? '', strengths: p.strengths.join('\n'), challenges: p.challenges.join('\n'), cues: p.cues.join('\n'), approaches: p.approaches, confidenceNotes: p.confidenceNotes ?? '', responseNotes: p.responseNotes ?? '', selfReflection: p.selfReflection ?? '', otherTeams: p.otherTeams ?? '' });
  const set = (k: keyof typeof f, v: any) => setF({ ...f, [k]: v });
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <Sheet title="Edit player" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { await updatePlayer(p.id, { firstName: f.firstName, lastName: f.lastName, number: f.number || undefined, ageGroup: f.ageGroup, throws: f.throws, bats: f.bats, positions: f.positions, experience: f.experience || undefined, strengths: lines(f.strengths), challenges: lines(f.challenges), cues: lines(f.cues), approaches: f.approaches, confidenceNotes: f.confidenceNotes || undefined, responseNotes: f.responseNotes || undefined, selfReflection: f.selfReflection || undefined, otherTeams: f.otherTeams || undefined }); onSaved(); }}>Save</button></>}>
      <div className="inline-fields">
        <div className="field"><label>First</label><input className="input" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
        <div className="field"><label>Last</label><input className="input" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
        <div className="field"><label>#</label><input className="input" style={{ width: 60 }} value={f.number} onChange={(e) => set('number', e.target.value)} /></div>
      </div>
      <div className="field"><label>Age group</label><div className="chips">{AGE_GROUPS.map((a) => <button key={a} className={`chip sm ${f.ageGroup === a ? 'on' : ''}`} onClick={() => set('ageGroup', a)}>{a}</button>)}</div></div>
      <div className="inline-fields">
        <div className="field"><label>Throws</label><div className="chips">{(['R', 'L'] as Hand[]).map((h) => <button key={h} className={`chip sm ${f.throws === h ? 'on' : ''}`} onClick={() => set('throws', h)}>{h}</button>)}</div></div>
        <div className="field"><label>Bats</label><div className="chips">{(['R', 'L', 'B'] as Hand[]).map((h) => <button key={h} className={`chip sm ${f.bats === h ? 'on' : ''}`} onClick={() => set('bats', h)}>{h}</button>)}</div></div>
      </div>
      <div className="field"><label>Positions</label><div className="chips">{POSITIONS.map((pos) => <button key={pos} className={`chip sm ${f.positions.includes(pos) ? 'on' : ''}`} onClick={() => set('positions', toggle<Position>(f.positions, pos))}>{pos}</button>)}</div></div>
      <div className="field"><label>Experience</label><input className="input" value={f.experience} onChange={(e) => set('experience', e.target.value)} placeholder="2nd year travel ball" /></div>
      <details open={!!(p.strengths.length || p.challenges.length || p.cues.length)} style={{ marginBottom: 10 }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Coaching notes (what works for him)</summary>
        <div style={{ marginTop: 8 }}>
          <div className="field"><label>Strengths (one per line)</label><textarea className="input" value={f.strengths} onChange={(e) => set('strengths', e.target.value)} /></div>
          <div className="field"><label>Current challenges (one per line)</label><textarea className="input" value={f.challenges} onChange={(e) => set('challenges', e.target.value)} /></div>
          <div className="field"><label>Cues that work (one per line, best first)</label><textarea className="input" value={f.cues} onChange={(e) => set('cues', e.target.value)} /></div>
          <div className="field"><label>What builds him up</label><textarea className="input" value={f.confidenceNotes} onChange={(e) => set('confidenceNotes', e.target.value)} placeholder="Praise the take, not just the hit." /></div>
        </div>
      </details>
      <details style={{ marginBottom: 10 }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer' }}>More (how he takes coaching, pressure, his own words, other teams)</summary>
        <div style={{ marginTop: 8 }}>
          <div className="field"><label>Takes coaching best with</label><div className="chips">{(Object.keys(APPROACH_LABEL) as CoachingApproach[]).map((a) => <button key={a} className={`chip sm ${f.approaches.includes(a) ? 'on' : ''}`} onClick={() => set('approaches', toggle<CoachingApproach>(f.approaches, a))}>{APPROACH_LABEL[a]}</button>)}</div><div className="muted small">What has worked so far, not a type he is stuck with.</div></div>
          <div className="field"><label>How he responds to frustration, pressure, mistakes (what you see)</label><textarea className="input" value={f.responseNotes} onChange={(e) => set('responseNotes', e.target.value)} /></div>
          <div className="field"><label>In his own words (optional)</label><textarea className="input" value={f.selfReflection} onChange={(e) => set('selfReflection', e.target.value)} placeholder="What he says he wants to get better at" /></div>
          <div className="field"><label>Other teams he throws for</label><input className="input" value={f.otherTeams} onChange={(e) => set('otherTeams', e.target.value)} placeholder="School team" /></div>
        </div>
      </details>
    </Sheet>
  );
}

function GoalSheet({ p, onClose, onSaved }: { p: Player; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<Category>(p.challenges.length ? 'hitting' : 'hitting');
  const [kind, setKind] = useState<Goal['kind']>('technical');
  const [text, setText] = useState('');
  const [fromPlayer, setFromPlayer] = useState(false);
  return (
    <Sheet title="New goal" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!text.trim()} onClick={async () => { await addGoal(p.id, { category, kind, text: text.trim(), fromPlayer }); onSaved(); }}>Add</button></>}>
      <div className="field"><label>Area</label><div className="chips">{CATEGORIES.map((c) => <button key={c} className={`chip sm ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]}</button>)}</div></div>
      <div className="field"><label>Kind</label><div className="chips"><button className={`chip ${kind === 'technical' ? 'on' : ''}`} onClick={() => setKind('technical')}>Technical</button><button className={`chip ${kind === 'mental' ? 'on' : ''}`} onClick={() => setKind('mental')}>Mental</button></div></div>
      <div className="field"><label>The goal, as you would say it to him</label><textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'mental' ? 'Breath, glove tap, next pitch after a strikeout' : 'Backhand: right foot plants, glove out front'} /></div>
      <label className="switch row between"><span>He helped set this goal</span><input type="checkbox" checked={fromPlayer} onChange={(e) => setFromPlayer(e.target.checked)} /></label>
    </Sheet>
  );
}

function NoteSheet({ p, onClose, onSaved }: { p: Player; onClose: () => void; onSaved: () => void }) {
  const [read, setRead] = useState<import('../../engine/types').Observation['read']>('note');
  const [category, setCategory] = useState<Category | ''>('');
  const [text, setText] = useState('');
  const [source, setSource] = useState<'quick' | 'game'>('quick');
  return (
    <Sheet title={`Note on ${playerName(p, 'first')}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={read === 'note' && !text.trim()} onClick={async () => { await addObservation({ playerId: p.id, read, category: category || undefined, text: text.trim() || undefined, source }); onSaved(); }}>Save</button></>}>
      <div className="field"><label>What you saw</label><div className="chips read-chips">{(Object.keys(READ_LABEL) as Array<keyof typeof READ_LABEL>).map((r) => <button key={r} className={`chip ${read === r ? 'on' : ''}`} onClick={() => setRead(r)}>{READ_LABEL[r]}</button>)}</div></div>
      <div className="field"><label>Area</label><div className="chips">{CATEGORIES.map((c) => <button key={c} className={`chip sm ${category === c ? 'on' : ''}`} onClick={() => setCategory(category === c ? '' : c)}>{CATEGORY_LABEL[c]}</button>)}</div></div>
      <div className="field"><label>Where</label><div className="chips"><button className={`chip sm ${source === 'quick' ? 'on' : ''}`} onClick={() => setSource('quick')}>Practice or anytime</button><button className={`chip sm ${source === 'game' ? 'on' : ''}`} onClick={() => setSource('game')}>Game</button></div></div>
      <div className="field"><label>Note</label><textarea className="input" value={text} onChange={(e) => setText(e.target.value)} /></div>
    </Sheet>
  );
}

function ThrowSheet({ p, onClose, onSaved }: { p: Player; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(today());
  const [pitches, setPitches] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [kind, setKind] = useState<'game' | 'bullpen' | 'practice' | 'other_team'>('game');
  return (
    <Sheet title="Pitches thrown" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!unknown && !pitches} onClick={async () => { await addThrowing({ playerId: p.id, date, pitches: unknown ? null : parseInt(pitches, 10), kind, source: 'manual' }); onSaved(); }}>Log</button></>}>
      <div className="inline-fields">
        <div className="field"><label>Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>Pitches</label><input className="input" type="number" value={pitches} disabled={unknown} onChange={(e) => setPitches(e.target.value)} /></div>
      </div>
      <label className="switch row between" style={{ marginBottom: 10 }}><span>Count unknown (he threw, nobody counted)</span><input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} /></label>
      <div className="field"><label>Where</label><div className="chips">{(['game', 'bullpen', 'practice', 'other_team'] as const).map((k) => <button key={k} className={`chip sm ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{k.replace('_', ' ')}</button>)}</div></div>
      <p className="muted small">Pitch Smart rest days are figured from this. League rules may be stricter.</p>
    </Sheet>
  );
}

function LevelSheet({ p, category, onClose, onSaved }: { p: Player; category: Category; onClose: () => void; onSaved: () => void }) {
  const [level, setLevel] = useState<Level | undefined>(p.levels[category]);
  const [status, setStatus] = useState<SkillStatus | undefined>(p.statuses[category]);
  return (
    <Sheet title={CATEGORY_LABEL[category]} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { await updatePlayer(p.id, { levels: { ...p.levels, [category]: level }, statuses: { ...p.statuses, [category]: status } }); onSaved(); }}>Save</button></>}>
      <div className="field"><label>Level</label><div className="chips">{([1, 2, 3, 4, 5] as Level[]).map((l) => <button key={l} className={`chip ${level === l ? 'on' : ''}`} onClick={() => setLevel(level === l ? undefined : l)}>{l} {LEVEL_LABEL[l]}</button>)}</div></div>
      <div className="field"><label>Status</label><div className="chips">{(Object.keys(STATUS_LABEL) as SkillStatus[]).map((s) => <button key={s} className={`chip sm ${status === s ? 'on' : ''}`} onClick={() => setStatus(status === s ? undefined : s)}>{STATUS_LABEL[s]}</button>)}</div></div>
      <p className="muted small">Your assessment, with today's date behind it. Change it whenever you see something new.</p>
    </Sheet>
  );
}
