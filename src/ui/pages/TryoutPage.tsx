import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createTryout, updateTryout, addCandidate, updateCandidate, setScore, deleteTryout, saveSettings } from '../../db/db';
import { useSettings, useCurrentTeam } from '../hooks';
import { LEAN_STATION, NOTE_STATION, localDate, newId, type Candidate, type Tryout, type TryoutScore, type TryoutDecision } from '../../engine/types';
import { DEFAULT_STATIONS, SCALE, LEANS, DECISION_LABEL, SPLIT_AT, visibleStations, sortCandidates, currentSession, parseCandidateList, buildBoard, sortBoard, fmt, myProgress, coachCounts, renderBoardHtml, type BoardRow, type BoardSort } from '../../engine/tryout';
import { shortDate } from '../../engine/progress';
import { Sheet, useToast } from '../components/Sheet';
import { PrintSheet } from '../components/PrintSheet';
import { syncNow } from '../../io/sync';

const nightLabel = (date: string) => {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
const addDays = (date: string, n: number) => { const [y, m, d] = date.split('-').map((x) => parseInt(x, 10)); return localDate(new Date(y, m - 1, d + n)); };
const kidLine = (c: Candidate) => [c.positions, c.team, c.note].filter(Boolean).join(' · ');
const kidName = (c: Candidate) => `${c.number ? `#${c.number} ` : ''}${c.name}`;
/** A column heading that fits a phone: the first word of a long station name. */
const shortLabel = (label: string) => (label.length > 9 ? label.split(' ')[0] : label);

/** Tryouts: start one, or open the one there is. */
export function TryoutsPage() {
  const { tryoutId } = useParams();
  const tryouts = useLiveQuery(() => db.tryouts.toArray(), [], undefined);
  const team = useCurrentTeam();
  const nav = useNavigate();
  const today = localDate(new Date());
  const [name, setName] = useState('');
  const [second, setSecond] = useState(true);
  const settings = useSettings();
  const [checking, setChecking] = useState(false);
  const [anyway, setAnyway] = useState(false);
  // A linked coach who is not the head coach waits for the head coach's tryout instead of starting a second one.
  const waitsForHead = Boolean(settings.sync?.enabled && settings.sync.role === 'helper');
  if (tryoutId) return <TryoutScreen tryoutId={tryoutId} />;
  if (!tryouts) return null;
  if (tryouts.length === 1) return <Navigate to={`/tryouts/${tryouts[0].id}`} replace />;
  const start = async () => {
    const sessions = [{ label: nightLabel(today), date: today }, ...(second ? [{ label: nightLabel(addDays(today, 7)), date: addDays(today, 7) }] : [])];
    const t = await createTryout({ name: name.trim() || `${team?.name ?? 'Team'} tryouts`, stations: DEFAULT_STATIONS.map((label) => ({ label })), sessions });
    nav(`/tryouts/${t.id}`);
  };
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}><Link to="/today" className="btn ghost sm">‹ Today</Link></div>
      <h1>Tryouts</h1>
      <p className="muted small">Each coach marks every kid 1 to 5 at each station on his own phone. The board puts everyone's marks side by side. For coaches only; nothing here goes to a family.</p>
      {tryouts.length > 0 && (
        <div className="list" style={{ marginBottom: 16 }}>
          {tryouts.map((t) => (
            <button key={t.id} className="item tappable" style={{ textAlign: 'left' }} onClick={() => nav(`/tryouts/${t.id}`)}>
              <div className="grow"><div className="title">{t.name}</div><div className="sub">{t.sessions.map((s) => s.label).join(', ')}</div></div><span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
      {waitsForHead && tryouts.length === 0 && (
        <div className="card" data-tryout-wait>
          <div className="section-title" style={{ marginTop: 0 }}><h3>Waiting for the head coach's tryout</h3></div>
          <p className="small" style={{ marginTop: 0 }}>The head coach starts the tryout on his phone and it shows up here by itself the next time this phone has a signal. Do not start a second one.</p>
          <div className="row wrap">
            <button className="btn primary" disabled={checking} onClick={async () => { setChecking(true); try { await syncNow(); } finally { setChecking(false); } }}>{checking ? 'Checking…' : 'Check now'}</button>
            {!anyway && <button className="btn ghost" onClick={() => setAnyway(true)}>Start one anyway</button>}
          </div>
        </div>
      )}
      {(!waitsForHead || tryouts.length > 0 || anyway) && <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Start a tryout</h3></div>
        <div className="field"><label htmlFor="try-name">Name</label><input id="try-name" className="input" value={name} placeholder={`${team?.name ?? 'Team'} tryouts`} onChange={(e) => setName(e.target.value)} /></div>
        <label className="row small" style={{ gap: 8, marginBottom: 12 }}><input type="checkbox" checked={second} onChange={(e) => setSecond(e.target.checked)} /> A second night a week later ({nightLabel(addDays(today, 7))})</label>
        <button className="btn primary block" onClick={start}>Start</button>
        <p className="muted small" style={{ marginBottom: 0 }}>It starts with {DEFAULT_STATIONS.length} stations ({DEFAULT_STATIONS.join(', ').toLowerCase()}). Add, rename or hide any of them at any time, even mid-tryout.</p>
      </div>}
    </div>
  );
}

function TryoutScreen({ tryoutId }: { tryoutId: string }) {
  const tryout = useLiveQuery(() => db.tryouts.get(tryoutId), [tryoutId], null as Tryout | undefined | null);
  const candidates = useLiveQuery(() => db.candidates.where('tryoutId').equals(tryoutId).toArray(), [tryoutId], [] as Candidate[]) ?? [];
  const scores = useLiveQuery(() => db.tryoutScores.where('tryoutId').equals(tryoutId).toArray(), [tryoutId], [] as TryoutScore[]) ?? [];
  const settings = useSettings();
  const [tab, setTab] = useState<'score' | 'board' | 'setup'>('score');
  const [nameDraft, setNameDraft] = useState('');
  const me = (settings.sync?.enabled ? settings.sync.name : settings.coachName)?.trim() ?? '';
  if (tryout === null) return null;
  if (!tryout) return <div><Link to="/tryouts" className="btn ghost sm">‹ Tryouts</Link><div className="empty">That tryout is not on this phone. If another coach deleted it, it is gone here too.</div></div>;
  const shown = candidates.filter((c) => !c.hidden);
  return (
    <div data-tryout>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Link to="/today" className="btn ghost sm">‹ Today</Link>
        <span className="muted small">{me ? `Scoring as ${me}` : ''}</span>
      </div>
      <h1 style={{ marginBottom: 4 }}>{tryout.name}</h1>
      <div className="chips" style={{ margin: '8px 0 12px' }}>
        <button className={`chip ${tab === 'score' ? 'on' : ''}`} onClick={() => setTab('score')}>Score</button>
        <button className={`chip ${tab === 'board' ? 'on' : ''}`} onClick={() => setTab('board')}>Board</button>
        <button className={`chip ${tab === 'setup' ? 'on' : ''}`} onClick={() => setTab('setup')}>Kids and stations ({shown.length})</button>
      </div>
      {!me ? (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}><h3>Who is scoring on this phone?</h3></div>
          <p className="muted small">Your first name goes on every mark you make, so the board can show each coach.</p>
          <div className="row" style={{ gap: 8 }}><input className="input" aria-label="Your first name" placeholder="Your first name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /><button className="btn primary" disabled={!nameDraft.trim()} onClick={() => saveSettings({ coachName: nameDraft.trim() })}>Save</button></div>
        </div>
      ) : tab === 'score' ? <ScoreTab tryout={tryout} candidates={shown} scores={scores} me={me} goSetup={() => setTab('setup')} />
        : tab === 'board' ? <BoardTab tryout={tryout} candidates={candidates} scores={scores} />
        : <SetupTab tryout={tryout} candidates={candidates} scores={scores} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

function Nums({ value, onPick, label }: { value?: number; onPick: (v: number | null) => void; label: string }) {
  return (
    <div className="tnums" role="group" aria-label={label}>
      {SCALE.map((s) => <button key={s.value} className={value === s.value ? 'on' : ''} aria-pressed={value === s.value} aria-label={`${s.value}, ${s.label}`} onClick={() => onPick(value === s.value ? null : s.value)}>{s.value}</button>)}
    </div>
  );
}

/** A note that saves itself a moment after typing stops, and when the field is left. */
function NoteField({ value, onSave, placeholder, rows = 1 }: { value?: string; onSave: (text: string) => void; placeholder: string; rows?: number }) {
  const [text, setText] = useState(value ?? '');
  const saved = useRef(value ?? '');
  const timer = useRef<number | undefined>(undefined);
  // Another phone's sync can change the note under us; take it only when we have nothing unsaved.
  useEffect(() => { if ((value ?? '') !== saved.current && text === saved.current) { setText(value ?? ''); } saved.current = value ?? ''; }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = (t: string) => { window.clearTimeout(timer.current); if (t.trim() !== saved.current.trim()) { saved.current = t.trim(); onSave(t); } };
  const change = (t: string) => { setText(t); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => flush(t), 700); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return rows > 1
    ? <textarea className="input" rows={rows} value={text} placeholder={placeholder} aria-label={placeholder} onChange={(e) => change(e.target.value)} onBlur={(e) => flush(e.target.value)} />
    : <input className="input" value={text} placeholder={placeholder} aria-label={placeholder} onChange={(e) => change(e.target.value)} onBlur={(e) => flush(e.target.value)} />;
}

function ScoreTab({ tryout, candidates, scores, me, goSetup }: { tryout: Tryout; candidates: Candidate[]; scores: TryoutScore[]; me: string; goSetup: () => void }) {
  const stations = visibleStations(tryout);
  const kids = useMemo(() => sortCandidates(candidates), [candidates]);
  const [sessionId, setSessionId] = useState<string>(() => currentSession(tryout, localDate(new Date())) ?? tryout.sessions[0]?.id ?? '');
  const [mode, setMode] = useState<'station' | 'kid'>('station');
  const [stationId, setStationId] = useState<string>(stations[0]?.id ?? '');
  const [kidId, setKidId] = useState<string>('');
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [scale, setScale] = useState(false);
  const session = tryout.sessions.find((s) => s.id === sessionId) ?? tryout.sessions[0];
  const station = stations.find((s) => s.id === stationId) ?? stations[0];
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  // My marks for this night, by "kid|station". Nobody else's numbers are on this screen.
  const mine = useMemo(() => {
    const m = new Map<string, TryoutScore>();
    for (const s of scores) if (s.by === me && s.sessionId === session?.id) m.set(`${s.candidateId}|${s.stationId}`, s);
    return m;
  }, [scores, me, session?.id]);
  if (!session) return <div className="empty">This tryout has no night yet. Add one under Kids and stations.</div>;
  const put = (candidateId: string, stId: string, patch: { value?: number | null; note?: string | null }) => setScore({ tryoutId: tryout.id, candidateId, stationId: stId, sessionId: session.id, by: me, ...patch });
  const row = (c: Candidate, stId: string, title: React.ReactNode, sub?: string) => {
    const cur = mine.get(`${c.id}|${stId}`);
    const key = `${c.id}|${stId}`;
    return (
      <div key={key} className="tscore" data-kid={c.name} data-station={stId}>
        <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
          <div className="grow"><div className="title">{title}</div>{sub && <div className="sub">{sub}</div>}</div>
          <button className={`btn ghost sm ${cur?.note ? 'has-note' : ''}`} aria-label={`Note on ${c.name}`} onClick={() => setNoteOpen(noteOpen === key ? null : key)}>{cur?.note ? 'Note ✓' : '+ Note'}</button>
        </div>
        <Nums value={cur?.value} label={`${c.name}`} onPick={(v) => put(c.id, stId, { value: v })} />
        {noteOpen === key && <div style={{ marginTop: 6 }}><NoteField value={cur?.note} placeholder="What you saw" onSave={(t) => put(c.id, stId, { note: t })} /></div>}
        {cur?.note && noteOpen !== key && <div className="sub" style={{ marginTop: 4 }}>{cur.note}</div>}
      </div>
    );
  };
  return (
    <div>
      {tryout.sessions.length > 1 && (
        <div className="chips" style={{ marginBottom: 8 }} aria-label="Night">
          {tryout.sessions.map((s) => <button key={s.id} className={`chip sm ${s.id === session.id ? 'on' : ''}`} onClick={() => setSessionId(s.id)}>{s.label}</button>)}
        </div>
      )}
      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={`chip sm ${mode === 'station' ? 'on' : ''}`} onClick={() => setMode('station')}>One station, every kid</button>
        <button className={`chip sm ${mode === 'kid' ? 'on' : ''}`} onClick={() => setMode('kid')}>One kid, every station</button>
      </div>
      <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => setScale(!scale)}>{scale ? 'Hide' : 'What the numbers mean'}</button>
      {scale && <div className="card small" style={{ padding: 10 }}>Against our own team, so every coach means the same thing by a 3:<br />{SCALE.map((s) => <span key={s.value}><strong>{s.value}</strong> {s.label.toLowerCase()}{s.value < 5 ? ' · ' : ''}</span>)}<br />Tap a number again to clear it. Skip a station you did not see; a blank is left out, not counted as low.</div>}

      {kids.length === 0 && <div className="empty">No kids yet.<br /><button className="btn primary" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ Add a kid</button> <button className="btn" style={{ marginTop: 10 }} onClick={goSetup}>Paste a list</button></div>}
      {stations.length === 0 && <div className="empty">No stations showing. Add or show one under Kids and stations.</div>}

      {kids.length > 0 && stations.length > 0 && mode === 'station' && station && (
        <>
          <div className="chips" style={{ margin: '8px 0' }} aria-label="Station">
            {stations.map((s) => <button key={s.id} className={`chip ${s.id === station.id ? 'on' : ''}`} onClick={() => { setStationId(s.id); setNoteOpen(null); }}>{s.label}</button>)}
          </div>
          <div className="list">{kids.map((c) => row(c, station.id, kidName(c), kidLine(c)))}</div>
        </>
      )}

      {kids.length > 0 && stations.length > 0 && mode === 'kid' && kid && (
        <>
          <div className="chips" style={{ margin: '8px 0' }} aria-label="Kid">
            {kids.map((c) => { const p = myProgress(tryout, c.id, session.id, me, scores); return <button key={c.id} className={`chip sm ${c.id === kid.id ? 'on' : ''}`} onClick={() => { setKidId(c.id); setNoteOpen(null); }}>{kidName(c)} <span style={{ opacity: 0.7 }}>{p.done}/{p.of}</span></button>; })}
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="title" style={{ fontSize: 18 }}>{kidName(kid)}</div>
            {kidLine(kid) && <div className="sub">{kidLine(kid)}</div>}
          </div>
          <div className="list">{stations.map((s) => row(kid, s.id, s.label))}</div>
          <div className="card" style={{ marginTop: 10 }}>
            <div className="section-title" style={{ marginTop: 0 }}><h3>Would you take him?</h3></div>
            <div className="chips" role="group" aria-label={`Lean on ${kid.name}`}>
              {LEANS.map((l) => { const cur = mine.get(`${kid.id}|${LEAN_STATION}`)?.value; return <button key={l.value} className={`chip ${cur === l.value ? 'on' : ''}`} aria-pressed={cur === l.value} onClick={() => put(kid.id, LEAN_STATION, { value: cur === l.value ? null : l.value })}>{l.label}</button>; })}
            </div>
            <div style={{ marginTop: 10 }}><NoteField key={`${kid.id}|${session.id}`} rows={3} value={mine.get(`${kid.id}|${NOTE_STATION}`)?.note} placeholder={`Anything else about ${kid.name.split(' ')[0]}`} onSave={(t) => put(kid.id, NOTE_STATION, { note: t })} /></div>
          </div>
          <div className="row between" style={{ marginTop: 10 }}>
            <button className="btn" disabled={kids.indexOf(kid) <= 0} onClick={() => { setKidId(kids[kids.indexOf(kid) - 1].id); window.scrollTo(0, 0); }}>‹ Previous kid</button>
            <button className="btn" disabled={kids.indexOf(kid) >= kids.length - 1} onClick={() => { setKidId(kids[kids.indexOf(kid) + 1].id); window.scrollTo(0, 0); }}>Next kid ›</button>
          </div>
        </>
      )}
      {kids.length > 0 && <div className="row wrap" style={{ marginTop: 14 }}><button className="btn" onClick={() => setAdding(true)}>+ Add a kid</button></div>}
      <p className="muted small">You only see your own marks here, so nobody is steered by someone else's number. The Board shows everyone.</p>
      {adding && <KidSheet tryoutId={tryout.id} onClose={() => setAdding(false)} />}
    </div>
  );
}

function KidSheet({ tryoutId, kid, onClose }: { tryoutId: string; kid?: Candidate; onClose: () => void }) {
  const [name, setName] = useState(kid?.name ?? '');
  const [number, setNumber] = useState(kid?.number ?? '');
  const [positions, setPositions] = useState(kid?.positions ?? '');
  const [team, setTeam] = useState(kid?.team ?? '');
  const [note, setNote] = useState(kid?.note ?? '');
  const save = async () => {
    if (!name.trim()) return;
    if (kid) await updateCandidate(kid.id, { name: name.trim(), number: number.trim() || undefined, positions: positions.trim() || undefined, team: team.trim() || undefined, note: note.trim() || undefined });
    else await addCandidate(tryoutId, { name, number, positions, team, note });
    onClose();
  };
  return (
    <Sheet title={kid ? 'Edit kid' : 'Add a kid'} onClose={onClose} footer={<>
      {kid && <button className="btn" onClick={async () => { await updateCandidate(kid.id, { hidden: !kid.hidden }); onClose(); }}>{kid.hidden ? 'Bring him back' : 'Take him off the list'}</button>}
      <button className="btn primary" disabled={!name.trim()} onClick={save}>Save</button>
    </>}>
      <div className="field"><label htmlFor="kid-name">Name</label><input id="kid-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label htmlFor="kid-num">Number tonight (jersey or pinnie)</label><input id="kid-num" className="input" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} /></div>
      <div className="field"><label htmlFor="kid-pos">Positions</label><input id="kid-pos" className="input" value={positions} onChange={(e) => setPositions(e.target.value)} /></div>
      <div className="field"><label htmlFor="kid-team">Current team</label><input id="kid-team" className="input" value={team} onChange={(e) => setTeam(e.target.value)} /></div>
      <div className="field"><label htmlFor="kid-note">Anything short (throws left, grade)</label><input id="kid-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <p className="muted small">No birthdays, parents or phone numbers here. Those stay on the sign-up sheet.</p>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function BoardTab({ tryout, candidates, scores }: { tryout: Tryout; candidates: Candidate[]; scores: TryoutScore[] }) {
  const stations = visibleStations(tryout);
  const [sessionId, setSessionId] = useState<string>('');
  const [sort, setSort] = useState<BoardSort>('overall');
  const [open, setOpen] = useState<string | null>(null);
  const [print, setPrint] = useState(false);
  const settings = useSettings();
  const [fetching, setFetching] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const refresh = async () => { setFetching('busy'); try { const r = await syncNow(); setFetching(r.error || r.skipped ? 'failed' : 'done'); } catch { setFetching('failed'); } };
  const rows = useMemo(() => sortBoard(buildBoard(tryout, candidates, scores, { sessionId: sessionId || undefined }), sort), [tryout, candidates, scores, sessionId, sort]);
  const coaches = coachCounts(tryout, scores, sessionId || undefined);
  const sessionLabel = sessionId ? tryout.sessions.find((s) => s.id === sessionId)?.label ?? '' : tryout.sessions.length > 1 ? 'All nights together' : tryout.sessions[0]?.label ?? '';
  const openRow = rows.find((r) => r.candidate.id === open);
  return (
    <div>
      <div className="card small" style={{ padding: 10, borderLeft: '4px solid var(--warn)' }}><strong>Coaches only.</strong> This compares kids because a tryout is a choice. It is never shown to a family and never becomes part of a player's page.</div>
      {tryout.sessions.length > 1 && (
        <div className="chips" style={{ margin: '8px 0' }} aria-label="Which night">
          <button className={`chip sm ${!sessionId ? 'on' : ''}`} onClick={() => setSessionId('')}>All nights</button>
          {tryout.sessions.map((s) => <button key={s.id} className={`chip sm ${s.id === sessionId ? 'on' : ''}`} onClick={() => setSessionId(s.id)}>{s.label}</button>)}
        </div>
      )}
      <div className="row between" style={{ margin: '8px 0', gap: 8 }}>
        <label className="small muted" htmlFor="board-sort">Order by</label>
        <select id="board-sort" className="input sm" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="overall">Overall</option>
          <option value="number">Number</option>
          <option value="name">Name</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="small muted" style={{ marginBottom: 6 }}>{coaches.length ? `Scored by ${coaches.map((c) => `${c.by} (${c.marks})`).join(', ')}.` : 'Nobody has scored yet.'}</div>
      <div className="table-wrap">
        <table className="stats tboard">
          <thead><tr><th>Kid</th><th onClick={() => setSort('overall')}>Overall</th>{stations.map((s) => <th key={s.id} title={s.label} onClick={() => setSort(s.id)}>{shortLabel(s.label)}</th>)}<th title="Yes, maybe, no">Y / M / N</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.candidate.id} onClick={() => setOpen(r.candidate.id)} style={{ cursor: 'pointer' }} data-board-kid={r.candidate.name}>
                <td><strong>{kidName(r.candidate)}</strong>{r.candidate.decision && <span className={`pill ${r.candidate.decision === 'offer' ? 'ok' : r.candidate.decision === 'pass' ? 'warn' : ''}`} style={{ marginLeft: 6 }}>{DECISION_LABEL[r.candidate.decision]}</span>}</td>
                <td><strong>{fmt(r.overall)}</strong></td>
                {r.cells.map((c) => <td key={c.stationId} className={`${c.split ? 'split' : ''} ${c.avg === undefined ? 'na' : ''}`}>{fmt(c.avg)}</td>)}
                <td>{r.leans.yes.length} / {r.leans.maybe.length} / {r.leans.no.length}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={stations.length + 3} className="na">No kids yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">Each number is the average of the coaches who scored it. A shaded box means two coaches were {SPLIT_AT} or more apart. A dash means nobody scored it, and it is left out of the overall. Tap a kid for each coach's marks and notes.</p>
      <div className="row wrap">
        {settings.sync?.enabled && <button className="btn primary" disabled={fetching === 'busy'} onClick={refresh}>{fetching === 'busy' ? 'Getting them…' : 'Get the latest marks'}</button>}
        <button className="btn" onClick={() => setPrint(true)}>Print or share the board</button>
      </div>
      {settings.sync?.enabled && <p className="muted small">{fetching === 'done' ? 'Up to date as of right now.' : fetching === 'failed' ? 'Could not reach the other phones just now (no signal?). Your own marks are safe on this phone and go out when the signal is back.' : 'Other coaches\' marks arrive by themselves every couple of minutes while this is open, or tap to get them now.'}</p>}
      {openRow && <KidBoardSheet tryout={tryout} row={openRow} onClose={() => setOpen(null)} />}
      {print && <PrintSheet title={`${tryout.name} board`} html={renderBoardHtml(tryout, rows, { sessionLabel, coaches: coaches.map((c) => c.by), asOf: shortDate(localDate(new Date())) })} fileName={`tryout-board.html`} onClose={() => setPrint(false)} />}
    </div>
  );
}

function KidBoardSheet({ tryout, row, onClose }: { tryout: Tryout; row: BoardRow; onClose: () => void }) {
  const c = row.candidate;
  const label = (id: string) => (id === NOTE_STATION ? 'Overall' : tryout.stations.find((s) => s.id === id)?.label ?? 'Station');
  const night = (id: string) => (tryout.sessions.length > 1 ? tryout.sessions.find((s) => s.id === id)?.label : undefined);
  const decide = (d: TryoutDecision) => updateCandidate(c.id, { decision: c.decision === d ? undefined : d });
  return (
    <Sheet title={kidName(c)} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      {kidLine(c) && <div className="muted small" style={{ marginBottom: 8 }}>{kidLine(c)}</div>}
      <div className="small" style={{ marginBottom: 8 }}><strong>Overall {fmt(row.overall)}</strong> from {row.stationsScored} station{row.stationsScored === 1 ? '' : 's'} · scored by {row.coaches.join(', ') || 'no one yet'}</div>
      <div className="list">
        {row.cells.map((x) => (
          <div key={x.stationId} className="item small" style={x.split ? { background: 'var(--warn-bg)' } : undefined}>
            <div className="grow"><div className="title">{label(x.stationId)}</div><div className="sub">{x.byCoach.length ? x.byCoach.map((b) => `${b.by} ${fmt(b.value)}`).join(' · ') : 'not scored'}{x.split ? ' · coaches apart' : ''}</div></div>
            <strong>{fmt(x.avg)}</strong>
          </div>
        ))}
      </div>
      <div className="section-title"><h3>Would take him</h3></div>
      <div className="small">Yes: {row.leans.yes.join(', ') || 'nobody'} · Maybe: {row.leans.maybe.join(', ') || 'nobody'} · No: {row.leans.no.join(', ') || 'nobody'}</div>
      {row.notes.length > 0 && <><div className="section-title"><h3>Notes</h3></div><ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{row.notes.map((n, i) => <li key={i}><strong>{n.by}</strong>, {label(n.stationId)}{night(n.sessionId) ? `, ${night(n.sessionId)}` : ''}: {n.text}</li>)}</ul></>}
      <div className="section-title"><h3>Decision</h3></div>
      <div className="chips" role="group" aria-label="Decision">
        {(Object.keys(DECISION_LABEL) as TryoutDecision[]).map((d) => <button key={d} className={`chip ${c.decision === d ? 'on' : ''}`} aria-pressed={c.decision === d} onClick={() => decide(d)}>{DECISION_LABEL[d]}</button>)}
      </div>
      <div style={{ marginTop: 8 }}><NoteField value={c.decisionNote} placeholder="Why, or what to look for next time" onSave={(t) => updateCandidate(c.id, { decisionNote: t.trim() || undefined })} /></div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Kids and stations
// ---------------------------------------------------------------------------

function SetupTab({ tryout, candidates, scores }: { tryout: Tryout; candidates: Candidate[]; scores: TryoutScore[] }) {
  const settings = useSettings();
  const nav = useNavigate();
  const toast = useToast();
  const [editKid, setEditKid] = useState<Candidate | 'new' | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [newStation, setNewStation] = useState('');
  const [sure, setSure] = useState(false);
  const kids = sortCandidates(candidates);
  const parsed = paste ? parseCandidateList(paste).filter((p) => !candidates.some((c) => c.name.toLowerCase() === p.name.toLowerCase())) : [];
  const saveStations = (stations: Tryout['stations']) => updateTryout(tryout.id, { stations });
  const move = (i: number, d: number) => { const s = [...tryout.stations]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; saveStations(s); };
  const marksAt = (stationId: string) => scores.filter((s) => s.stationId === stationId && typeof s.value === 'number').length;
  const isHelper = settings.sync?.enabled && settings.sync.role === 'helper';
  return (
    <div>
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Kids ({kids.filter((k) => !k.hidden).length})</h3></div>
        <div className="list">
          {kids.map((c) => (
            <button key={c.id} className="item tappable small" style={{ textAlign: 'left', opacity: c.hidden ? 0.5 : 1 }} onClick={() => setEditKid(c)}>
              <div className="grow"><div className="title">{kidName(c)}{c.hidden ? ' (off the list)' : ''}</div><div className="sub">{kidLine(c) || 'tap to add positions or a number'}</div></div><span className="chev">›</span>
            </button>
          ))}
          {kids.length === 0 && <div className="muted small">Nobody yet. Paste the sign-up list, or add kids one at a time as they walk up.</div>}
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => setEditKid('new')}>+ Add a kid</button>
          <button className="btn" onClick={() => setPaste('')}>Paste a list</button>
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Stations</h3><span className="muted small">change any time</span></div>
        <div className="list">
          {tryout.stations.map((s, i) => (
            <div key={s.id} className="item small" style={{ opacity: s.hidden ? 0.5 : 1, gap: 6 }}>
              <input className="input" aria-label={`Station ${i + 1} name`} defaultValue={s.label} key={`${s.id}:${s.label}`} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.label) saveStations(tryout.stations.map((x) => (x.id === s.id ? { ...x, label: v } : x))); }} />
              <button className="btn sm" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="btn sm" aria-label={`Move ${s.label} down`} disabled={i === tryout.stations.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="btn sm" onClick={() => saveStations(tryout.stations.map((x) => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)))}>{s.hidden ? 'Show' : 'Hide'}</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <input className="input" aria-label="New station" placeholder="New station (bunting, 60-yard run)" value={newStation} onChange={(e) => setNewStation(e.target.value)} />
          <button className="btn primary" disabled={!newStation.trim()} onClick={async () => { await saveStations([...tryout.stations, { id: newId(), label: newStation.trim() }]); setNewStation(''); toast.show('Station added'); }}>Add</button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>Hiding a station keeps its marks ({tryout.stations.filter((s) => s.hidden).map((s) => `${s.label}: ${marksAt(s.id)}`).join(', ') || 'none hidden'}) and takes it off the scoring screen and the board. Renaming keeps them too.</p>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Nights</h3></div>
        <div className="list">
          {tryout.sessions.map((s) => (
            <div key={s.id} className="item small" style={{ gap: 6 }}>
              <input className="input" aria-label="Night name" defaultValue={s.label} key={`${s.id}:${s.label}`} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.label) updateTryout(tryout.id, { sessions: tryout.sessions.map((x) => (x.id === s.id ? { ...x, label: v } : x)) }); }} />
              <input className="input" type="date" aria-label={`Date of ${s.label}`} value={s.date} onChange={(e) => { if (e.target.value) updateTryout(tryout.id, { sessions: tryout.sessions.map((x) => (x.id === s.id ? { ...x, date: e.target.value, label: x.label === nightLabel(x.date) ? nightLabel(e.target.value) : x.label } : x)) }); }} />
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}><button className="btn" onClick={() => { const last = tryout.sessions[tryout.sessions.length - 1]; const date = last ? addDays(last.date, 7) : localDate(new Date()); updateTryout(tryout.id, { sessions: [...tryout.sessions, { id: newId(), label: nightLabel(date), date }] }); }}>+ Add a night</button></div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Tryout name</h3></div>
        <input className="input" aria-label="Tryout name" defaultValue={tryout.name} key={tryout.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== tryout.name) updateTryout(tryout.id, { name: v }); }} />
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Other coaches</h3></div>
        {settings.sync?.enabled
          ? <p className="small" style={{ marginTop: 0 }}>This phone is linked as <strong>{settings.sync.name}</strong>. Every linked coach sees this tryout and scores on his own phone; marks cross over whenever a phone has a signal.{settings.sync.role === 'head' ? ' Invite another coach from Settings, Other coaches.' : ''}</p>
          : <p className="small" style={{ marginTop: 0 }}>This phone is not linked to anyone, so only your marks are here. To score with other coaches, turn on linked phones in Settings, Other coaches, and text each coach his invite link.</p>}
        <p className="muted small">A linked coach also sees this team's roster and plans, so only invite coaches you want on the team's side of the app.</p>
        <div className="row wrap"><button className="btn" onClick={() => nav('/settings')}>Open Settings</button></div>
      </div>

      {!isHelper && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}><h3>When the choices are made</h3></div>
          <p className="muted small" style={{ marginTop: 0 }}>Deleting removes every kid, mark and note in this tryout from this phone and from the linked phones. Kids who make the team get added to the roster as players; nothing from here follows them.</p>
          {!sure ? <button className="btn" onClick={() => setSure(true)}>Delete this tryout</button>
            : <div className="row wrap"><button className="btn danger" onClick={async () => { await deleteTryout(tryout.id); nav('/today'); }}>Yes, delete all of it</button><button className="btn" onClick={() => setSure(false)}>Keep it</button></div>}
        </div>
      )}

      {editKid && <KidSheet tryoutId={tryout.id} kid={editKid === 'new' ? undefined : editKid} onClose={() => setEditKid(null)} />}
      {paste !== null && (
        <Sheet title="Paste a list of kids" onClose={() => setPaste(null)} footer={<button className="btn primary" disabled={!parsed.length} onClick={async () => { for (const p of parsed) await addCandidate(tryout.id, p); toast.show(`${parsed.length} added`); setPaste(null); }}>{parsed.length ? `Add ${parsed.length}` : 'Nothing to add yet'}</button>}>
          <p className="muted small" style={{ marginTop: 0 }}>One kid per line: name, positions, current team. Or paste rows copied from the sign-up sheet with its heading row; birthdays, parents and phone numbers are dropped.</p>
          <textarea className="input" rows={8} aria-label="List of kids" placeholder={'Alex Rivers, RHP / OF, Storm 13u\nBen Cole, SS'} value={paste} onChange={(e) => setPaste(e.target.value)} />
          {parsed.length > 0 && <ul className="small" style={{ paddingLeft: 18 }}>{parsed.map((p) => <li key={p.name}><strong>{p.name}</strong>{[p.positions, p.team, p.note].filter(Boolean).length ? `: ${[p.positions, p.team, p.note].filter(Boolean).join(' · ')}` : ''}</li>)}</ul>}
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}

