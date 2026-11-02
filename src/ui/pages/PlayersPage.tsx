import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePlayers, useObservations } from '../hooks';
import { createPlayer, playerName } from '../../db/db';
import { Sheet, useToast } from '../components/Sheet';
import { parseRoster } from '../../engine/roster';
import { CATEGORY_LABEL, type Category } from '../../engine/types';

export function PlayersPage() {
  const team = useCurrentTeam();
  const players = usePlayers(team?.id);
  const observations = useObservations();
  const nav = useNavigate();
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [quick, setQuick] = useState('');
  const active = players.filter((p) => p.status === 'active');
  const inactive = players.filter((p) => p.status !== 'active');

  const addFromText = async () => {
    if (!team) return;
    let n = 0;
    const existing = players.map((p) => `${p.firstName} ${p.lastName}`.trim().toLowerCase());
    let dup = 0;
    for (const r of parseRoster(quick)) {
      if (existing.includes(`${r.firstName} ${r.lastName}`.trim().toLowerCase())) dup += 1;
      await createPlayer({ teamId: team.id, firstName: r.firstName, lastName: r.lastName, number: r.number, ageGroup: team.ageGroup });
      n += 1;
    }
    if (dup) toast.show(`${n} added; ${dup} share a name with someone already here (kept both)`);
    else     toast.show(`${n} player${n === 1 ? '' : 's'} added`);
    setQuick('');
    setAdd(false);
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>{team?.shortName ?? team?.name ?? 'Players'}</h1>
        <button className="btn primary" onClick={() => setAdd(true)} disabled={!team}>+ Add</button>
      </div>
      {!team && <div className="empty">Set up a team first (Today, Set up my team).</div>}
      <div className="list" data-tour="roster">
        {active.map((p) => {
          const goals = p.goals.filter((g) => g.status === 'active');
          const last = observations.find((o) => o.playerId === p.id);
          return (
            <Link key={p.id} to={`/players/${p.id}`} className="item tappable">
              <div className="num" style={{ width: 34, fontWeight: 800, color: 'var(--ink-3)' }}>{p.number ? `#${p.number}` : ''}</div>
              <div className="grow">
                <div className="title">{playerName(p)}{p.positions.length ? <span className="muted small"> · {p.positions.join('/')}</span> : null}</div>
                <div className="sub">{goals.length ? goals.map((g) => `${CATEGORY_LABEL[g.category as Category]}: ${g.text}`).slice(0, 1).join('') : 'No active goal yet'}{goals.length > 1 ? ` (+${goals.length - 1})` : ''}{last?.text ? ` · last note: ${last.text}` : ''}</div>
              </div>
              <span className="chev">›</span>
            </Link>
          );
        })}
        {team && active.length === 0 && <div className="empty">No players yet. Tap + Add, or import your roster from Dugout Dad in Settings.</div>}
      </div>
      {inactive.length > 0 && (
        <details className="small" style={{ marginTop: 12 }}>
          <summary className="muted">{inactive.length} inactive</summary>
          <div className="list">{inactive.map((p) => <Link key={p.id} to={`/players/${p.id}`} className="item tappable"><div className="grow"><div className="title">{playerName(p)}</div></div><span className="chev">›</span></Link>)}</div>
        </details>
      )}
      {add && (
        <Sheet title="Add players" onClose={() => setAdd(false)} footer={<><button className="btn" onClick={() => setAdd(false)}>Cancel</button><button className="btn primary" disabled={!quick.trim()} onClick={addFromText}>Add</button></>}>
          <p className="muted small">One per line: number then name. Only first and last names are needed; everything else is optional and can be filled in as you coach.</p>
          <textarea className="input" rows={6} value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={'7 Owen Tate\n12 Hank Sorensen'} />
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}
