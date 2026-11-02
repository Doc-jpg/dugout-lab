import React, { useMemo, useState } from 'react';
import { useDrills, useObservations, useVariants, usePractices, usePlayers, useSettings, useTeam, useParentUpdates, timeAgo } from '../hooks';
import { updatePlayer, addParentUpdate, playerName } from '../../db/db';
import { homePlanFor, parentTextDraft, parentEmailDraft, scorecardFor, renderScorecardHtml, renderHomePlanHtml, smsLink, mailtoLink } from '../../engine/home';
import { CATEGORY_LABEL, type Player, type ParentContact } from '../../engine/types';
import { Sheet, useToast } from '../components/Sheet';
import { PrintSheet } from '../components/PrintSheet';

/**
 * Family: who to reach, what to send, and the drafts. The app never sends anything; it opens
 * Messages or Mail with the text filled in, or hands the coach a file to share.
 */
export function FamilyPanel({ player }: { player: Player }) {
  const drills = useDrills();
  const observations = useObservations();
  const variants = useVariants();
  const practices = usePractices(player.teamId);
  const teamPlayers = usePlayers(player.teamId);
  const settings = useSettings();
  const team = useTeam(player.teamId);
  const updates = useParentUpdates(player.id);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [personal, setPersonal] = useState('');
  const [preview, setPreview] = useState<{ title: string; text: string; kind: 'text' | 'email'; subject?: string; to?: string } | null>(null);
  const [page, setPage] = useState<{ title: string; html: string; fileName: string; kind: 'home_plan' | 'scorecard' } | null>(null);

  const plan = useMemo(() => homePlanFor(player, drills, observations, variants), [player, drills, observations, variants]);
  const ctx = { player, team, settings, coachName: settings.coachName, observations, practices, plan, personal: personal || undefined };
  const brand = { team, settings, coachName: settings.coachName };
  const textDraft = useMemo(() => parentTextDraft(ctx), [player, observations, practices, plan, settings.coachName, personal]);
  const emailDraft = useMemo(() => parentEmailDraft(ctx), [player, observations, practices, plan, settings.coachName, personal]);
  const parent = player.parents?.[0];
  const share = player.share ?? 'summary';

  const record = (kind: 'update' | 'home_plan' | 'scorecard', channel: 'text' | 'email' | 'file' | 'copy', text: string) =>
    addParentUpdate({ playerId: player.id, kind, channel, text, drillIds: plan.drills.map((d) => d.drill.id) });

  // Messages and Mail open with the draft filled in; the app cannot see whether it was sent, so the log says "drafted".
  const openText = () => {
    if (!parent?.phone) { toast.show('Add a phone number first'); return; }
    window.location.href = smsLink(parent.phone, textDraft);
    record('update', 'text', textDraft);
  };
  const openEmail = () => {
    if (!parent?.email) { toast.show('Add an email first'); return; }
    window.location.href = mailtoLink(parent.email, emailDraft.subject, emailDraft.body);
    record('update', 'email', emailDraft.body);
  };
  const copy = async (text: string, kind: 'update' | 'home_plan') => {
    try {
      await navigator.clipboard.writeText(text);
      await record(kind, 'copy', text);
      toast.show('Copied');
    } catch {
      toast.show('Could not copy; select the text in the preview instead');
    }
  };
  const card = () => scorecardFor(player, teamPlayers, observations, practices, { teamName: team?.brand?.programName || team?.name, brand });
  const first = player.firstName;

  return (
    <>
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Family</h3><button className="btn sm" onClick={() => setEditing(true)}>{player.parents?.length ? 'Edit' : '+ Add contact'}</button></div>
        {(player.parents ?? []).map((c, i) => <div key={i} className="small">{c.name}{c.relation ? ` (${c.relation})` : ''}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}{c.preferred ? ` · prefers ${c.preferred}` : ''}</div>)}
        {!player.parents?.length && <div className="muted small">No contact yet. Add a parent to draft texts and emails.</div>}
        <div className="small muted" style={{ marginTop: 6 }}>Shares: {share === 'none' ? 'nothing (family opted out)' : share === 'summary' ? 'update and home work' : 'update, home work and scorecard'}</div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Home work for {first}</h3><span className="muted small">{plan.minutesPerSession} min, {plan.sessionsPerWeek}x a week</span></div>
        <div className="small"><strong>Working on:</strong> {plan.focus.map((f) => `${CATEGORY_LABEL[f.category]}: ${f.text}`).join(' · ')}</div>
        {plan.drills.map((d) => (
          <div key={d.drill.id} className="small" style={{ marginTop: 6 }}>
            <strong>{d.drill.name}</strong> · {d.objective} · {d.reps}
            <div>{d.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>
          </div>
        ))}
        {plan.drills.length === 0 && <div className="muted small">No backyard-friendly drill matched his goals yet; add a goal or a note and this fills in.</div>}
        {plan.mental && <div className="small" style={{ marginTop: 6 }}><strong>Mental:</strong> {plan.mental}</div>}
        <details className="small muted" style={{ marginTop: 6 }}><summary>Why these</summary><ul style={{ paddingLeft: 18 }}>{plan.basis.map((b, i) => <li key={i}>{b}</li>)}</ul></details>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => setPage({ title: `${first}'s yard work`, html: renderHomePlanHtml(player, plan, { coachName: settings.coachName, teamName: team?.brand?.programName || team?.name, brand }), fileName: `${first}-home-plan.html`, kind: 'home_plan' })}>Open and share the printable</button>
        </div>
      </div>

      {share !== 'none' && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}><h3>Update to send</h3><span className="muted small">drafts only; you tap send</span></div>
          <div className="field"><label>A personal line (optional)</label><input className="input" value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="Loved his energy Saturday." /></div>
          <div className="row wrap">
            <button className="btn primary" onClick={() => setPreview({ title: 'Text draft', text: textDraft, kind: 'text', to: parent?.phone })}>Text</button>
            <button className="btn primary" onClick={() => setPreview({ title: 'Email draft', text: emailDraft.body, kind: 'email', subject: emailDraft.subject, to: parent?.email })}>Email</button>
            {share === 'scorecard' && <button className="btn" onClick={() => setPage({ title: `${first}'s scorecard`, html: renderScorecardHtml(card()), fileName: `${first}-scorecard.html`, kind: 'scorecard' })}>Scorecard</button>}
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>What goes in: wins first, what we are working on, the home work. What never goes in: your private notes on how he handles frustration, raw note text, or anything about other kids. The scorecard shows the team as a band, not as names.</p>
        </div>
      )}

      {updates.length > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}><h3>Sent before</h3></div>
          {updates.slice(0, 6).map((u) => <div key={u.id} className="small muted">{timeAgo(u.ts)} · {u.kind.replace('_', ' ')} {u.channel === 'text' || u.channel === 'email' ? `drafted in ${u.channel === 'text' ? 'Messages' : 'Mail'}` : u.channel === 'file' ? 'shared as a file' : 'copied'}</div>)}
        </div>
      )}

      {page && <PrintSheet title={page.title} html={page.html} fileName={page.fileName} onClose={() => setPage(null)} onShared={() => record(page.kind, 'file', `${page.fileName} (file)`)} />}
      {editing && <ContactSheet player={player} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast.show('Saved'); }} />}
      {preview && (
        <Sheet title={preview.title} onClose={() => setPreview(null)} footer={<>
          <button className="btn" onClick={() => copy(preview.text, 'update')}>Copy</button>
          <button className="btn primary" onClick={() => { setPreview(null); preview.kind === 'text' ? openText() : openEmail(); }}>{preview.kind === 'text' ? (preview.to ? `Open Messages` : 'Add a phone first') : (preview.to ? 'Open Mail' : 'Add an email first')}</button>
        </>}>
          {preview.subject && <div className="small"><strong>Subject:</strong> {preview.subject}</div>}
          <pre className="small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--bg-sunk)', padding: 10, borderRadius: 8 }}>{preview.text}</pre>
          <p className="muted small">Edit it in Messages or Mail before sending; this is a draft from your notes.</p>
        </Sheet>
      )}
      {toast.el}
    </>
  );
}

function ContactSheet({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<ParentContact[]>(player.parents?.length ? player.parents : [{ name: '' }]);
  const [share, setShare] = useState<NonNullable<Player['share']>>(player.share ?? 'summary');
  const set = (i: number, k: keyof ParentContact, v: string) => setList(list.map((c, j) => (j === i ? { ...c, [k]: v || undefined } : c)));
  return (
    <Sheet title="Family contacts" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { await updatePlayer(player.id, { parents: list.filter((c) => c.name?.trim()), share }); onSaved(); }}>Save</button></>}>
      {list.map((c, i) => (
        <div key={i} className="card" style={{ padding: 10 }}>
          <div className="inline-fields">
            <div className="field"><label>Name</label><input className="input" value={c.name} onChange={(e) => set(i, 'name', e.target.value)} /></div>
            <div className="field"><label>Relation</label><input className="input" value={c.relation ?? ''} onChange={(e) => set(i, 'relation', e.target.value)} placeholder="mom" /></div>
          </div>
          <div className="field"><label>Mobile</label><input className="input" type="tel" value={c.phone ?? ''} onChange={(e) => set(i, 'phone', e.target.value)} /></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={c.email ?? ''} onChange={(e) => set(i, 'email', e.target.value)} /></div>
          <div className="field"><label>Prefers</label><div className="chips"><button className={`chip sm ${c.preferred === 'text' ? 'on' : ''}`} onClick={() => set(i, 'preferred', 'text')}>Text</button><button className={`chip sm ${c.preferred === 'email' ? 'on' : ''}`} onClick={() => set(i, 'preferred', 'email')}>Email</button></div></div>
          {list.length > 1 && <button className="btn sm" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</button>}
        </div>
      ))}
      <button className="btn sm" onClick={() => setList([...list, { name: '' }])}>+ Another contact</button>
      <div className="field" style={{ marginTop: 12 }}><label>What this family gets</label>
        <div className="chips">
          <button className={`chip sm ${share === 'summary' ? 'on' : ''}`} onClick={() => setShare('summary')}>Update and home work</button>
          <button className={`chip sm ${share === 'scorecard' ? 'on' : ''}`} onClick={() => setShare('scorecard')}>Plus scorecard</button>
          <button className={`chip sm ${share === 'none' ? 'on' : ''}`} onClick={() => setShare('none')}>Nothing (opted out)</button>
        </div>
        <div className="muted small">Ask the family once. Contact details stay on this phone.</div>
      </div>
    </Sheet>
  );
}
