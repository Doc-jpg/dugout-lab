import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePlayers, usePractices, useParentUpdates, useSettings, timeAgo } from '../hooks';
import { playerName } from '../../db/db';
import { dueForUpdate } from '../../engine/home';

/** Who is due for a word home, and one tap to draft it. */
export function ParentsPage() {
  const team = useCurrentTeam();
  const players = usePlayers(team?.id);
  const practices = usePractices(team?.id);
  const updates = useParentUpdates();
  const settings = useSettings();
  const nav = useNavigate();
  const due = useMemo(() => dueForUpdate(players, practices, updates, settings.parentUpdateEveryPractices), [players, practices, updates, settings.parentUpdateEveryPractices]);
  const lastFor = (id: string) => updates.find((u) => u.playerId === id);
  const active = players.filter((p) => p.status === 'active');
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Link to="/today" className="btn ghost sm">‹ Today</Link>
        <Link to="/settings" className="small">Every {settings.parentUpdateEveryPractices} practices</Link>
      </div>
      <h1>Parent updates</h1>
      <p className="muted small">Each update is a draft from your notes: wins first, what we are working on, two or three things for the yard. It opens in Messages or Mail; you read it and tap send. Nothing goes out on its own.</p>
      <div className="section-title"><h3>Due now</h3><span className="muted small">{due.length}</span></div>
      <div className="list">
        {due.map(({ player, practicesSince, last }) => (
          <button key={player.id} className="item tappable" style={{ textAlign: 'left' }} onClick={() => nav(`/players/${player.id}#family`)}>
            <div className="grow"><div className="title">{playerName(player)}</div><div className="sub">{practicesSince} practice{practicesSince === 1 ? '' : 's'} since {last ? `the last update (${timeAgo(last)})` : 'the start; no update yet'}{!player.parents?.length ? ' · no contact on file' : ''}</div></div>
            <span className="chev">›</span>
          </button>
        ))}
        {due.length === 0 && <div className="empty">Nobody is due. Updates come due after {settings.parentUpdateEveryPractices} practices with a player.</div>}
      </div>
      <div className="section-title"><h3>Everyone</h3></div>
      <div className="list">
        {active.map((p) => { const u = lastFor(p.id); return (
          <button key={p.id} className="item tappable" style={{ textAlign: 'left' }} onClick={() => nav(`/players/${p.id}#family`)}>
            <div className="grow"><div className="title">{playerName(p)}</div><div className="sub">{p.share === 'none' ? 'family opted out' : u ? `last ${u.kind.replace('_', ' ')} ${timeAgo(u.ts)} by ${u.channel}` : 'never'}{p.parents?.length ? ` · ${p.parents[0].name}` : ' · no contact'}</div></div>
            <span className="chev">›</span>
          </button>
        ); })}
      </div>
    </div>
  );
}
