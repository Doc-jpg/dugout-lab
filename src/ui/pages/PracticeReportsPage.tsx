import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCurrentTeam, useDrills, useObservations, useParentUpdates, usePlayers, usePractice, usePractices, useSettings, useVariants, fmtDate, timeAgo } from '../hooks';
import { addParentUpdate, playerName } from '../../db/db';
import { homePlanFor } from '../../engine/home';
import { practiceReportFor, practiceReportFileName, practiceReportMessage, renderPracticeReportHtml, practiceNotes, type ReportChoices } from '../../engine/practiceReport';
import { syncNow } from '../../io/sync';
import { PrintSheet } from '../components/PrintSheet';
import { useToast } from '../components/Sheet';
import type { Player } from '../../engine/types';

/**
 * The end of practice: one report per kid who was there, for his family.
 *
 * The coach checks that every coach's notes are in, opens a kid, reads what will go home, adds a
 * line of his own if he wants, and shares the PDF. The phone's share sheet picks the person; the
 * app shows whose family it is and keeps track of who is done. Nothing goes out on its own.
 */
export function PracticeReportsPage() {
  const { practiceId = '' } = useParams();
  const practice = usePractice(practiceId);
  const team = useCurrentTeam();
  const settings = useSettings();
  const players = usePlayers(practice?.teamId);
  const practices = usePractices(practice?.teamId);
  const observations = useObservations();
  const drills = useDrills();
  const variants = useVariants();
  const updates = useParentUpdates();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, ReportChoices>>({});
  const [busy, setBusy] = useState(false);

  const here = useMemo(() => (practice ? players.filter((p) => practice.inputs.presentIds.includes(p.id)).sort((a, b) => playerName(a).localeCompare(playerName(b))) : []), [players, practice]);
  const notesHere = useMemo(() => (practice ? here.flatMap((p) => practiceNotes(p, practice, observations)) : []), [here, practice, observations]);
  const byCoach = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of notesHere) m.set(o.by ?? settings.coachName ?? 'A coach', (m.get(o.by ?? settings.coachName ?? 'A coach') ?? 0) + 1);
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [notesHere, settings.coachName]);
  const sentAt = (p: Player) => updates.find((u) => u.playerId === p.id && u.kind === 'practice_report' && u.practiceId === practiceId)?.ts;

  if (!practice) return <div className="empty">Loading…</div>;

  const draftFor = (p: Player) => practiceReportFor({
    player: p, practice, team, settings, coachName: settings.coachName, observations, practices, drills,
    plan: homePlanFor(p, drills, observations, variants, { max: 2 }),
    choices: choices[p.id]
  });
  const sendable = here.filter((p) => p.share !== 'none');
  const done = sendable.filter((p) => sentAt(p)).length;
  const next = (after?: string) => { const rest = sendable.filter((p) => !sentAt(p) && p.id !== after); return rest[0]; };

  const pull = async () => {
    setBusy(true);
    try { const r = await syncNow(); toast.show(r.error || r.revoked ? 'Could not reach the other phones' : r.applied ? `${r.applied} new from the other phones` : 'Notes are up to date'); } catch { toast.show('Could not reach the other phones'); }
    setBusy(false);
  };

  const player = here.find((p) => p.id === open);
  const draft = player ? draftFor(player) : undefined;
  const parent = player?.parents?.[0];
  const setChoice = (id: string, patch: Partial<ReportChoices>) => setChoices((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const toggleLine = (pid: string, lineId: string, on: boolean) => {
    const cur = choices[pid] ?? {};
    const include = new Set(cur.include ?? []);
    const exclude = new Set(cur.exclude ?? []);
    if (on) { include.add(lineId); exclude.delete(lineId); } else { exclude.add(lineId); include.delete(lineId); }
    setChoice(pid, { include: [...include], exclude: [...exclude] });
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Link to={`/practices/${practice.id}/recap`} className="btn ghost sm">‹ Recap</Link>
        <span className="muted small">{done} of {sendable.length} shared</span>
      </div>
      <h1>Practice reports</h1>
      <p className="muted small">{fmtDate(practice.date)}{practice.title ? ` · ${practice.title}` : ''}. One page per kid for his family: what the coaches saw, counted reps, what he is working on, and two things for home. You read each one and share it; nothing goes out on its own.</p>

      <div className="card" data-notes-in style={{ marginTop: 10 }}>
        <strong>Are everyone's notes in?</strong>
        <div className="small" style={{ marginTop: 4 }}>{byCoach.length ? byCoach.map(([by, n]) => `${by}: ${n} ${n === 1 ? 'note' : 'notes'}`).join(' · ') : 'No notes were written at this practice yet.'}</div>
        {settings.sync?.enabled
          ? <button className="btn sm" style={{ marginTop: 8 }} disabled={busy} onClick={pull}>{busy ? 'Checking…' : 'Get the latest notes'}</button>
          : <div className="muted small" style={{ marginTop: 4 }}>Only this phone's notes. Link the other coaches' phones in Settings to see theirs here.</div>}
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {here.map((p) => {
          const n = practiceNotes(p, practice, observations).length;
          const at = sentAt(p);
          const who = p.parents?.[0];
          const out = p.share === 'none';
          return (
            <button key={p.id} className="item tappable" data-report-kid={playerName(p)} style={{ textAlign: 'left', opacity: out ? 0.55 : 1 }} disabled={out} onClick={() => setOpen(p.id)}>
              <div className="grow">
                <div className="title">{playerName(p)}</div>
                <div className="sub">{out ? 'Family opted out' : `${n ? `${n} ${n === 1 ? 'note' : 'notes'}` : 'No notes tonight'} · ${who ? `to ${who.name}` : 'no family contact yet'}`}</div>
              </div>
              {at ? <span className="pill ok" data-shared>Shared {timeAgo(at)}</span> : !out && <span className="chev">›</span>}
            </button>
          );
        })}
        {here.length === 0 && <div className="empty">Nobody was marked present at this practice.</div>}
      </div>

      {player && draft && (
        <PrintSheet
          title={`${playerName(player, 'first')}'s report`}
          html={renderPracticeReportHtml(draft.report)}
          fileName={practiceReportFileName(draft.report).replace(/\.pdf$/, '.html')}
          pdf={{ fileName: practiceReportFileName(draft.report), make: async () => { const m = await import('../../io/practiceReportPdf'); return m.buildPracticeReportPdf(draft.report); } }}
          shareText={practiceReportMessage(draft.report, parent?.name)}
          hint={parent ? `Share as PDF opens your phone's share sheet. Pick Messages or Mail and choose ${parent.name}${parent.phone ? ` (${parent.phone})` : parent.email ? ` (${parent.email})` : ''}. The message is already written.` : 'Share as PDF opens your phone\'s share sheet. Pick Messages or Mail and choose the family. Add their contact on the player\'s Family tab and it will show here.'}
          onClose={() => setOpen(null)}
          onShared={async (how) => {
            await addParentUpdate({ playerId: player.id, kind: 'practice_report', practiceId: practice.id, channel: 'file', text: practiceReportMessage(draft.report, parent?.name), drillIds: [] });
            const n = next(player.id);
            toast.show(how === 'shared' ? `${playerName(player, 'first')}: shared${n ? `. Next: ${playerName(n, 'first')}` : '. That is everyone.'}` : `${playerName(player, 'first')}: saved to this phone`);
            setOpen(n ? n.id : null);
          }}
        >
          <div className="card" style={{ marginBottom: 10 }} data-report-controls>
            <div className="small"><strong>Goes to:</strong> {parent ? `${parent.name}${parent.relation ? ` (${parent.relation})` : ''}` : <>no family contact yet. <button className="linklike" onClick={() => nav(`/players/${player.id}#family`)}>Add one</button></>}</div>
            {draft.empty && <div className="banner info small" style={{ marginTop: 8 }}>Nobody wrote a note on {playerName(player, 'first')} at this practice. The report will say so kindly and still carry what he is working on and two things for home. A line from you below makes it worth sending.</div>}
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="report-note">A note from you to the family (optional)</label>
              <textarea id="report-note" className="input" rows={2} placeholder={`One or two sentences about ${playerName(player, 'first')} tonight`} value={choices[player.id]?.note ?? ''} onChange={(e) => setChoice(player.id, { note: e.target.value })} />
            </div>
            {draft.lines.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div className="small"><strong>What goes in from the coaches' notes</strong> <span className="muted">(tap to put a line in or take it out)</span></div>
                {draft.lines.map((l) => (
                  <label key={l.id} className="row" style={{ gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
                    <input type="checkbox" checked={l.included} onChange={(e) => toggleLine(player.id, l.id, e.target.checked)} style={{ marginTop: 3 }} />
                    <span className="small">{l.by ? <strong>{l.by}: </strong> : null}{l.text}{l.kind === 'note' && !l.included ? <span className="muted"> (a plain note, left out unless you tick it)</span> : null}</span>
                  </label>
                ))}
                <div className="muted small" style={{ marginTop: 6 }}>Notes marked struggled, hesitated, frustrated or coasting never go home as written. Say it your way in your note.</div>
              </div>
            )}
          </div>
        </PrintSheet>
      )}
      {toast.el}
    </div>
  );
}
