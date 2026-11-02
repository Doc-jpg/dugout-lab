import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePlayers, useObservations, useDrills, usePractices } from '../hooks';
import { playerName } from '../../db/db';
import { suggestionsForTeam } from '../../engine/suggestions';
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL } from '../../engine/types';

/** Team view: where everyone is by area (coach's own assessments), attendance, and suggestions. No rankings. */
export function ProgressPage() {
  const team = useCurrentTeam();
  const players = usePlayers(team?.id).filter((p) => p.status === 'active');
  const observations = useObservations();
  const drills = useDrills();
  const practices = usePractices(team?.id);
  const nav = useNavigate();
  const suggestions = useMemo(() => suggestionsForTeam(players, observations, drills), [players, observations, drills]);
  const done = practices.filter((p) => p.status === 'done');
  const short = (c: string) => ({ hitting: 'Hit', throwing: 'Thr', catching: 'Cat', pitching: 'Pit', infield: 'Inf', outfield: 'Out', baserunning: 'Run', team_defense: 'TmD', situations: 'Sit', athletic: 'Ath', baseball_iq: 'IQ', mental: 'Mnt' })[c] ?? c;
  if (!team) return <div className="empty">Set up a team first.</div>;
  const dueReview = players.flatMap((p) => Object.entries(p.statuses).filter(([, s]) => s === 'review').map(([c]) => ({ p, c })));
  return (
    <div>
      <h1>Progress</h1>
      <p className="muted small">Levels are your own assessments, per area, changed whenever you see something new. Blank means not assessed. This is for planning, not for ranking kids against each other.</p>
      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="grid-cats" style={{ gridTemplateColumns: `110px repeat(${CATEGORIES.length}, minmax(26px, 1fr))` }}>
          <div />
          {CATEGORIES.map((c) => <div key={c} className="h" title={CATEGORY_LABEL[c]}>{short(c)}</div>)}
          {players.map((p) => (
            <React.Fragment key={p.id}>
              <Link to={`/players/${p.id}`} className="small" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playerName(p, 'short')}</Link>
              {CATEGORIES.map((c) => { const l = p.levels[c]; return <div key={c} className={`c ${l ? `l${l}` : ''}`} title={`${CATEGORY_LABEL[c]}: ${l ?? 'not assessed'}${p.statuses[c] ? `, ${STATUS_LABEL[p.statuses[c]!]}` : ''}`}>{l ?? ''}{p.statuses[c] === 'review' ? '!' : ''}</div>; })}
            </React.Fragment>
          ))}
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>1 introducing · 2 building · 3 steady · 4 reliable · 5 game-ready · ! due for review</div>
      </div>

      {dueReview.length > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}><h3>Due for a retention check</h3></div>
          {dueReview.map(({ p, c }) => <div key={p.id + c} className="small">· {playerName(p, 'short')}: {CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}</div>)}
        </div>
      )}

      <div className="section-title"><h3>Suggestions</h3><span className="muted small">{suggestions.length}</span></div>
      <div className="list">
        {suggestions.map((s) => <div key={s.id} className="card suggestion" style={{ padding: 10, cursor: 'pointer' }} onClick={() => nav(`/players/${s.playerId}`)}><div className="tag">Suggestion{s.fromGame ? ' · from a game' : ''}</div><div className="small">{s.text}</div></div>)}
        {suggestions.length === 0 && <div className="empty">Nothing yet. Suggestions come from patterns in your notes, never from guesses.</div>}
      </div>

      <div className="section-title"><h3>Attendance</h3><span className="muted small">{done.length} finished practices</span></div>
      <div className="list">
        {players.map((p) => { const n = done.filter((x) => x.inputs.presentIds.includes(p.id)).length; return <div key={p.id} className="item small"><span className="grow">{playerName(p, 'short')}</span><span>{n} of {done.length}</span></div>; })}
      </div>

      <div className="section-title"><h3>What the team has worked on</h3></div>
      <div className="row wrap small">
        {CATEGORIES.map((c) => { const n = done.reduce((s, p) => s + p.blocks.reduce((t, b) => t + b.stations.filter((st) => (st.notes ?? '').startsWith(`category:${c}`)).length, 0), 0); return n ? <span key={c} className="pill">{CATEGORY_LABEL[c]} {n}</span> : null; })}
        {done.length === 0 && <span className="muted">No finished practices yet.</span>}
      </div>
    </div>
  );
}
