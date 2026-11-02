import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings, useTeams } from '../hooks';
import { parseInviteLink, joinTeam, deviceName, syncNow } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';

/**
 * Where an invite link lands (#/join?t=TEAMKEY&c=TOKEN&n=Name&f=From). One button: this phone
 * becomes that person's, and the first sync fills it with the team and the plan.
 */
export function JoinPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const settings = useSettings();
  const teams = useTeams();
  const invite = useMemo(() => parseInviteLink(loc.search || loc.hash || window.location.hash), [loc.search, loc.hash]);
  const [phase, setPhase] = useState<'ask' | 'joining' | 'waiting' | 'done' | 'error'>('ask');
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (phase !== 'waiting') return;
    let stop = false;
    const tick = async () => {
      const r = await syncNow();
      if (stop) return;
      if (r.revoked) { setError('This invite has been turned off. Ask the head coach for a new one.'); setPhase('error'); return; }
      if (!r.error && !r.skipped && r.applied > 0) { setPhase('done'); return; }
      setTries((t) => t + 1);
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { stop = true; window.clearInterval(id); };
  }, [phase]);

  useEffect(() => { if (phase === 'done') { const t = window.setTimeout(() => nav('/today'), 800); return () => window.clearTimeout(t); } }, [phase]);

  if (!SYNC_AVAILABLE) return <div className="empty">Linked phones are not available in this build.</div>;
  if (!invite) return (
    <div>
      <h1>Invite link</h1>
      <div className="card"><p className="small">This link is missing a piece. Ask the head coach to send it again from Settings, Other coaches.</p><button className="btn block" onClick={() => nav('/today')}>Go to Today</button></div>
    </div>
  );
  const alreadyThisTeam = settings.sync?.enabled && settings.sync.teamKey === invite.teamKey;
  const hasOwnData = teams.length > 0 && !settings.sync?.enabled;

  return (
    <div>
      <h1>You're invited</h1>
      <div className="card">
        {phase === 'ask' && (
          <>
            <p><strong>{invite.from ? `${invite.from} invited you` : 'You are invited'}</strong> to coach with Dugout Lab as <strong>{invite.name}</strong>.</p>
            <p className="small">Tap the button and this phone is set up as {invite.name}'s: same team, same roster, same plan. From then on the roster and plans arrive here on their own, and every note you take goes back with your name on it. Nothing to type, nothing to send.</p>
            {alreadyThisTeam && <div className="banner info small">This phone is already linked to this team as {settings.sync?.name}. Joining again as {invite.name} changes the name on your notes from now on.</div>}
            {hasOwnData && <div className="banner warn small">This phone already has a team of its own. Joining keeps it; the invited team is added next to it.</div>}
            <button className="btn primary big-btn block" onClick={async () => {
              setPhase('joining');
              try { await joinTeam(invite, deviceName()); setPhase('waiting'); } catch (e: any) { setError(e.message); setPhase('error'); }
            }}>Set up this phone as {invite.name}</button>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => nav('/today')}>Not now</button>
          </>
        )}
        {phase === 'joining' && <p className="small">Setting up…</p>}
        {phase === 'waiting' && (
          <>
            <p><strong>Linked as {invite.name}.</strong></p>
            <p className="small">Getting the team from {invite.from ?? 'the head coach'}'s phone{tries > 3 ? '. This needs a signal; it will finish the next time the app opens with one' : '…'}</p>
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => nav('/today')}>Go to Today</button>
          </>
        )}
        {phase === 'done' && <p><strong>All set.</strong> The team is here. Opening Today…</p>}
        {phase === 'error' && (
          <>
            <div className="banner warn small">{error}</div>
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => nav('/today')}>Go to Today</button>
          </>
        )}
      </div>
      <p className="muted small">An invite link is for one person. If you got it by mistake, just close it.</p>
    </div>
  );
}
