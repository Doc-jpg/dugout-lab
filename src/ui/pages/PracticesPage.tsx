import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePractices, fmtDate, fmtTime } from '../hooks';

export function PracticesPage() {
  const team = useCurrentTeam();
  const practices = usePractices(team?.id);
  const nav = useNavigate();
  const groups: Array<[string, typeof practices]> = [
    ['In progress', practices.filter((p) => p.status === 'live')],
    ['Planned', practices.filter((p) => p.status === 'planned').sort((a, b) => a.date.localeCompare(b.date))],
    ['Done', practices.filter((p) => p.status === 'done')]
  ];
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Practices</h1>
        <button className="btn primary" onClick={() => nav('/practices/new')} disabled={!team}>+ New practice</button>
      </div>
      {!team && <div className="empty">Set up a team first (Today, then Set up my team).</div>}
      {groups.map(([title, list]) => list.length > 0 && (
        <div key={title} className="section">
          <div className="section-title"><h3>{title}</h3><span className="muted small">{list.length}</span></div>
          <div className="list">
            {list.map((p) => (
              <Link key={p.id} to={p.status === 'live' ? `/practices/${p.id}/live` : `/practices/${p.id}`} className="item tappable">
                <div className="grow">
                  <div className="title">{p.title || fmtDate(p.date)}{p.time ? `, ${fmtTime(p.time)}` : ''}</div>
                  <div className="sub">{p.title ? fmtDate(p.date) + ' · ' : ''}{p.inputs.durationMin} min · {p.inputs.presentIds.length} players · {p.blocks.reduce((s, b) => s + b.stations.length, 0)} stations{p.recap?.summary ? ` · ${p.recap.summary}` : ''}</div>
                </div>
                <span className="chev">›</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {team && practices.length === 0 && <div className="empty">No practices yet. Tap + New practice.</div>}
    </div>
  );
}
