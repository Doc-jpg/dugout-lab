import React, { useEffect, useState } from 'react';
import { useSettings, useCurrentTeam, useOnline, timeAgo } from '../hooks';
import { Sheet, Confirm, useToast } from './Sheet';
import { startTeamSync, makeInvite, listMembers, setMemberRevoked, syncNow, stopSync, deviceName, type MemberRow, type Invite } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';
import { saveSettings } from '../../db/db';
import { type Team } from '../../engine/types';

/**
 * "Other coaches" for the head coach: turn sync on, invite people by link, see who is connected,
 * turn one person's access off. On a helper's phone: the status line and who set it up.
 */
export function SyncCard({ team, fallback }: { team?: Team; fallback: React.ReactNode }) {
  const settings = useSettings();
  const online = useOnline();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [newPerson, setNewPerson] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<MemberRow | null>(null);
  const s = settings.sync;

  const refresh = async () => {
    if (!s?.enabled || s.role !== 'head') return;
    try { setMembers(await listMembers()); } catch { /* offline; keep what we have */ }
  };
  useEffect(() => { refresh(); }, [s?.enabled, s?.lastSyncAt]);

  if (!SYNC_AVAILABLE) return <>{fallback}</>;

  const status = !s?.enabled ? '' : s.revoked ? 'Your access was turned off by the head coach. This phone keeps what it has but no longer sends or receives.' : s.lastError ? `Last try failed: ${s.lastError}` : s.lastSyncAt ? `Up to date as of ${timeAgo(s.lastSyncAt)}.` : online ? 'Connected; first sync on its way.' : 'Connected; waiting for a signal.';
  const syncNowClick = async () => { setBusy(true); const r = await syncNow(); setBusy(false); toast.show(r.error ? `Could not sync: ${r.error}` : r.skipped ? 'Offline or not connected' : `Synced (${r.pushed} sent, ${r.applied} received)`); await refresh(); };

  // Helper phone
  if (s?.enabled && s.role === 'helper') {
    return (
      <div className="card" id="coaches">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Linked to {s.name === settings.coachName ? 'the head coach' : 'the team'}</h3></div>
        <p className="small" style={{ marginTop: 0 }}>This phone is <strong>{s.name}'s</strong>{settings.packIdentity?.from ? `, set up by ${settings.packIdentity.from}'s invite` : ''}. The roster, goals, cues and plans arrive here on their own; your notes go back tagged {s.name}. {status}</p>
        <div className="row wrap">
          <button className="btn" disabled={busy || !!s.revoked} onClick={syncNowClick}>Sync now</button>
          <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmOff(true)}>Leave the team</button>
        </div>
        {confirmOff && <Confirm title="Leave the team?" text="This phone stops sending and receiving. What is already here stays. Ask the head coach for a new invite to come back." danger yesLabel="Leave" onNo={() => setConfirmOff(false)} onYes={async () => { await stopSync(); await saveSettings({ packIdentity: undefined }); setConfirmOff(false); }} />}
        {toast.el}
      </div>
    );
  }

  // Head coach, sync off
  if (!s?.enabled) {
    return (
      <div className="card" id="coaches">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Other coaches</h3></div>
        <p className="muted small" style={{ marginTop: 0 }}>Turn on linked phones, then invite each coach by link. He opens it, taps one button, and from then on your roster, goals and plans reach his phone on their own and his notes come back tagged with his name. Nothing is ever overwritten. Your private notes and family contacts never leave this phone.</p>
        <button className="btn primary block" disabled={!team || busy || !online} onClick={async () => {
          if (!team) return;
          setBusy(true);
          try { await startTeamSync(settings.coachName || 'Head coach', team.id, deviceName()); toast.show('Linked phones are on'); syncNow().catch(() => undefined); } catch (e: any) { toast.show(e.message); } finally { setBusy(false); }
        }}>{online ? 'Turn on linked phones' : 'Turn on linked phones (needs a signal)'}</button>
        {!settings.coachName && <div className="muted small" style={{ marginTop: 6 }}>Put your name in "Your name on notes" above first so your own notes carry it.</div>}
        <details className="small" style={{ marginTop: 10 }}>
          <summary className="muted">No signal where you coach? Coach packs by file still work.</summary>
          <div style={{ marginTop: 8 }}>{fallback}</div>
        </details>
        {toast.el}
      </div>
    );
  }

  // Head coach, sync on
  const others = (members ?? []).filter((m) => !m.head);
  return (
    <div className="card" id="coaches">
      <div className="section-title" style={{ marginTop: 0 }}><h3>Other coaches</h3><span className="muted small">linked phones on</span></div>
      <p className="small" style={{ marginTop: 0 }}>{status} Your roster, goals, cues and plans reach every linked phone on their own; their notes come back tagged with the name on the invite. Private notes and family contacts stay here.</p>
      {members === null && <div className="muted small">Loading the list…</div>}
      {others.length > 0 && (
        <div className="list" style={{ marginBottom: 8 }}>
          {others.map((m) => (
            <div key={m.token_hash} className="item small">
              <div className="grow">
                <div className="title">{m.name}{m.role ? <span className="muted"> · {m.role}</span> : null}{m.revoked ? <span className="pill" style={{ marginLeft: 6 }}>access off</span> : null}</div>
                <div className="sub">{m.last_seen ? `Last synced ${timeAgo(m.last_seen)}` : 'Invited, has not opened the link yet'}</div>
              </div>
              {m.revoked
                ? <button className="btn sm" disabled={busy} onClick={async () => { setBusy(true); try { await setMemberRevoked(m.token_hash, false); toast.show(`${m.name} is back on`); await refresh(); } catch (e: any) { toast.show(e.message); } finally { setBusy(false); } }}>Turn back on</button>
                : <button className="btn sm ghost" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => setConfirmRevoke(m)}>Turn off</button>}
            </div>
          ))}
        </div>
      )}
      <div className="row wrap">
        <button className="btn primary" disabled={busy || !online} onClick={() => setNewPerson(true)}>+ Invite a coach</button>
        <button className="btn" disabled={busy} onClick={syncNowClick}>Sync now</button>
        <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmOff(true)}>Turn off</button>
      </div>
      <details className="small" style={{ marginTop: 10 }}>
        <summary className="muted">No signal at the field? Coach packs by file still work.</summary>
        <div style={{ marginTop: 8 }}>{fallback}</div>
      </details>
      {newPerson && <InviteSheet team={team} onClose={() => setNewPerson(false)} onMade={(inv) => { setNewPerson(false); setInvite(inv); refresh(); }} />}
      {invite && (
        <Sheet title={`Invite for ${invite.name}`} onClose={() => setInvite(null)} footer={<><button className="btn" onClick={() => setInvite(null)}>Done</button><button className="btn primary" onClick={() => shareInvite(invite, settings.coachName, toast)}>Send the link</button></>}>
          <p className="small">Text or AirDrop this link to {invite.name}. He opens it on his phone, taps one button, and his phone is set up as {invite.name}'s with your team and your plan. Every note he takes comes back with his name on it.</p>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{invite.link}</pre>
          <p className="muted small">Anyone with this link can join as {invite.name}, so send it to him only. You can turn his access off here any time.</p>
        </Sheet>
      )}
      {confirmRevoke && <Confirm title={`Turn off ${confirmRevoke.name}'s access?`} text={`His phone stops sending and receiving on its next try and tells him why. What is already on his phone stays there. You can turn him back on here.`} danger yesLabel="Turn off" onNo={() => setConfirmRevoke(null)} onYes={async () => { const m = confirmRevoke; setConfirmRevoke(null); setBusy(true); try { await setMemberRevoked(m.token_hash, true); toast.show(`${m.name}'s access is off`); await refresh(); } catch (e: any) { toast.show(e.message); } finally { setBusy(false); } }} />}
      {confirmOff && <Confirm title="Turn off linked phones?" text="This phone stops sending and receiving. The other coaches' phones keep what they have and stop too. Nothing is deleted anywhere. Turning it back on makes a new team key and new invites." danger yesLabel="Turn off" onNo={() => setConfirmOff(false)} onYes={async () => { await stopSync(); setConfirmOff(false); setMembers(null); }} />}
      {toast.el}
    </div>
  );
}

async function shareInvite(invite: Invite, from: string | undefined, toast: ReturnType<typeof useToast>) {
  const nav2: any = navigator;
  const text = `${from ? `${from} ` : ''}invited you to coach with Dugout Lab. Open this on your phone: ${invite.link}`;
  try {
    if (nav2.share) { await nav2.share({ title: `Dugout Lab invite for ${invite.name}`, text }); return; }
  } catch (e: any) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(invite.link); toast.show('Link copied'); } catch { toast.show('Copy the link above'); }
}

/** Who is this invite for: someone from the branding coaches list, or a new name and role. */
function InviteSheet({ team, onClose, onMade }: { team?: Team; onClose: () => void; onMade: (inv: Invite) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const suggestions = [...(team?.brand?.coaches ?? []).map((c) => c.name), ...(team?.helpers ?? []).map((h) => h.name)].filter((n, i, a) => n && a.indexOf(n) === i);
  const make = async () => {
    setBusy(true);
    try { onMade(await makeInvite(name.trim(), role.trim() || undefined)); } catch (e: any) { toast.show(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Invite a coach" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim() || busy} onClick={make}>{busy ? 'Making the link…' : 'Make the invite'}</button></>}>
      {suggestions.length > 0 && <div className="field"><label>Quick pick</label><div className="chips">{suggestions.map((n) => <button key={n} className={`chip sm ${name === n ? 'on' : ''}`} onClick={() => setName(n)}>{n}</button>)}</div></div>}
      <div className="field"><label>First name (what his notes will say)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aaron" autoFocus={suggestions.length === 0} /></div>
      <div className="field"><label>Role (optional)</label><div className="chips">{['Assistant', 'Parent coach', 'Guest coach'].map((r) => <button key={r} className={`chip sm ${role === r ? 'on' : ''}`} onClick={() => setRole(role === r ? '' : r)}>{r}</button>)}</div></div>
      <p className="muted small">The link carries his name. His phone is set up as his in one tap; nothing for him to type.</p>
      {toast.el}
    </Sheet>
  );
}
