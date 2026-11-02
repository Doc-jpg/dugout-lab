import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Block, Drill, Player, Station } from '../../engine/types';
import { playerName } from '../../db/db';
import { EQUIPMENT_LABEL, stationNote } from '../../engine/types';

/** One station: the drill, who is coaching, and every player's own objective. */
export function StationCard({
  block, station, drill, players, groupLabel, expanded: expandedProp, actions, highlightIds
}: {
  block: Block;
  station: Station;
  drill?: Drill;
  players: Map<string, Player>;
  /** Which group is here now (live mode), to show those objectives first. */
  groupLabel?: string;
  expanded?: boolean;
  actions?: React.ReactNode;
  highlightIds?: string[];
}) {
  const [open, setOpen] = useState(expandedProp ?? false);
  const here = new Set(highlightIds ?? []);
  const objectives = [...station.objectives].sort((a, b) => (here.has(b.playerId) ? 1 : 0) - (here.has(a.playerId) ? 1 : 0) || playerName(players.get(a.playerId), 'short').localeCompare(playerName(players.get(b.playerId), 'short')));
  const shown = highlightIds?.length ? objectives.filter((o) => here.has(o.playerId)) : objectives;
  return (
    <div className={`card station ${/Player-led/.test(station.coach ?? '') ? 'playerled' : ''}`} style={{ padding: 10 }}>
      <button type="button" className="row between station-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="grow">
          <div className="title">{station.nameOverride || drill?.name || 'Drill'}{station.progression && station.progression !== 'base' ? <span className="pill" style={{ marginLeft: 6 }}>{station.progression}</span> : null}</div>
          <div className="sub">{station.coach ? `${station.coach} · ` : ''}{block.wholeTeam ? `${block.rotationMin} min` : `${block.rotationMin} min per group`}{drill ? ` · ${drill.equipment.length ? drill.equipment.slice(0, 3).map((e) => EQUIPMENT_LABEL[e].toLowerCase()).join(', ') : 'no gear'}` : ''}{groupLabel ? ` · ${groupLabel} here` : ''}</div>
        </div>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {drill && (
            <>
              <div className="small"><strong>Goal:</strong> {drill.objective}</div>
              <div className="small muted" style={{ marginTop: 2 }}>{drill.setup}</div>
              <ol className="step-list small">{drill.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              <div>{drill.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>
              <div className="small muted" style={{ marginTop: 4 }}><strong>Got it looks like:</strong> {drill.success}</div>
              {drill.safety && <div className="small" style={{ marginTop: 4, color: 'var(--danger)' }}><strong>Safety:</strong> {drill.safety}</div>}
              {(drill.mistakes?.length || drill.competitive || drill.spacing) ? (
                <details className="small" style={{ marginTop: 4 }}>
                  <summary className="muted">Coach notes</summary>
                  {drill.spacing && <div style={{ marginTop: 4 }}><strong>Spacing:</strong> {drill.spacing}</div>}
                  {drill.mistakes?.map((m, i) => <div key={i} style={{ marginTop: 4 }}>{m.see} <span className="muted">Fix: {m.fix}</span></div>)}
                  {drill.competitive && <div style={{ marginTop: 4 }}><strong>Make it a game:</strong> {drill.competitive}</div>}
                </details>
              ) : null}
              <Link to={`/drills/${drill.id}`} className="small">Full drill ›</Link>
            </>
          )}
          {stationNote(station) && <div className="small" style={{ marginTop: 6 }}><strong>Note:</strong> {stationNote(station)}</div>}
          <div style={{ marginTop: 8 }}>
            <div className="muted small" style={{ marginBottom: 4 }}>Each player's objective{highlightIds?.length ? ' (this group)' : ''}</div>
            {shown.map((o) => (
              <div key={o.playerId} className="objective">
                <div className="who">{playerName(players.get(o.playerId), 'short')}</div>
                <div className="what small">
                  <div>{o.technical}</div>
                  {o.mental && <div className="muted">Mental: {o.mental}</div>}
                  <div className="why">{o.from === 'variant' ? 'his saved version' : o.from === 'goal' ? 'his goal' : o.from === 'level' ? 'from his level' : o.from === 'coach' ? 'you set this' : 'drill'}</div>
                </div>
              </div>
            ))}
          </div>
          {actions && <div className="row wrap" style={{ marginTop: 8 }}>{actions}</div>}
        </div>
      )}
    </div>
  );
}
