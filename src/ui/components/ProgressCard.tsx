import React, { useMemo, useState } from 'react';
import { useObservations, usePractices, useThrowing, useSettings, useTeam } from '../hooks';
import { addParentUpdate } from '../../db/db';
import { smsLink, mailtoLink } from '../../engine/home';
import { progressFor, renderProgressHtml, progressTextDraft, progressEmailDraft, stretchWords, countWords, PERIODS, PERIOD_LABEL, TREND_WORD, type Period, type Trend } from '../../engine/progress';
import type { Player } from '../../engine/types';
import { Sheet, useToast } from './Sheet';
import { PrintSheet } from './PrintSheet';

const TREND_PILL: Record<Trend, { cls: string; text: string } | undefined> = {
  up: { cls: 'pill ok', text: TREND_WORD.up },
  down: { cls: 'pill warn', text: TREND_WORD.down },
  same: { cls: 'pill', text: TREND_WORD.same },
  not_enough: { cls: 'pill', text: 'Too few to call' },
  none: undefined
};

/**
 * Counted reps over time for one player, and the page a parent can be sent.
 *
 * `coach` (the Progress tab) shows every count with the stretch before it. `family` (the Family
 * tab) is the same numbers with the ways to send them. Nothing is sent by the app: Share hands
 * the page to the phone, Text and Email open a draft the coach reads first.
 */
export function ProgressCard({ player, mode }: { player: Player; mode: 'coach' | 'family' }) {
  const observations = useObservations(player.id);
  const practices = usePractices(player.teamId);
  const throwing = useThrowing();
  const settings = useSettings();
  const team = useTeam(player.teamId);
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('five');
  const [page, setPage] = useState(false);
  const [preview, setPreview] = useState<{ title: string; text: string; kind: 'text' | 'email'; subject?: string; to?: string } | null>(null);

  const report = useMemo(
    () => progressFor(player, observations, practices, throwing, { period, brand: { team, settings, coachName: settings.coachName } }),
    [player, observations, practices, throwing, period, team, settings]
  );
  const first = player.firstName;
  const parent = player.parents?.[0];
  const optedOut = player.share === 'none';
  const record = (channel: 'text' | 'email' | 'file' | 'copy', text: string) => addParentUpdate({ playerId: player.id, kind: 'progress', channel, text, drillIds: [] });
  const text = () => progressTextDraft({ report, coachName: settings.coachName });
  const email = () => progressEmailDraft({ report, coachName: settings.coachName });

  const send = (
    <div className="row wrap" style={{ marginTop: 8 }}>
      <button className="btn primary" onClick={() => setPage(true)}>Progress page</button>
      <button className="btn" onClick={() => setPreview({ title: 'Progress text draft', text: text(), kind: 'text', to: parent?.phone })}>Text it</button>
      <button className="btn" onClick={() => { const e = email(); setPreview({ title: 'Progress email draft', text: e.body, kind: 'email', subject: e.subject, to: parent?.email }); }}>Email it</button>
    </div>
  );

  return (
    <>
      <div className="card" data-progress-card={mode}>
        <div className="section-title" style={{ marginTop: 0 }}><h3>{mode === 'coach' ? 'Counted reps, over time' : `How ${first} is doing, over time`}</h3>{mode === 'family' && <span className="muted small">drafts only; you tap send</span>}</div>
        <div className="chips" style={{ marginBottom: 8 }}>
          {PERIODS.map((p) => <button key={p} className={`chip sm ${period === p ? 'on' : ''}`} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>)}
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>{report.sessions ? `From ${stretchWords(report)}. ${report.repsCounted} counted rep${report.repsCounted === 1 ? '' : 's'}.` : 'Nothing recorded yet.'}</div>

        {report.skills.length > 0 && (
          <div className="list">
            {(mode === 'coach' ? report.skills : report.skills.slice(0, 4)).map((s) => {
              const pill = TREND_PILL[s.trend];
              return (
                <div key={s.skill.id} className="item small">
                  <div className="grow">
                    <div className="title">{s.skill.label}</div>
                    <div className="sub">{countWords(s.recent, s.skill.word)}{report.hasBefore ? ` · before that ${s.before.total ? `${s.before.good} of ${s.before.total}` : 'none counted'}` : ''}</div>
                  </div>
                  {pill && <span className={pill.cls}>{pill.text}</span>}
                </div>
              );
            })}
            {mode === 'family' && report.skills.length > 4 && <div className="muted small">and {report.skills.length - 4} more on the page</div>}
          </div>
        )}
        {report.skills.length === 0 && <div className="muted small">No counted reps in this stretch. They come from Narrate: talk through a drill ("{first}, clean backhand, throw on target") and each rep is counted here.</div>}
        {report.thin && report.skills.length > 0 && <div className="muted small" style={{ marginTop: 6 }}>Not much written down yet, so read these as a first look.</div>}

        {mode === 'coach' && <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>A change is only called when both stretches have at least 8 counted reps and the gap is bigger than luck. {first} against {first}; no one else is on this.</p>}
        {optedOut ? <div className="muted small" style={{ marginTop: 8 }}>This family opted out of updates, so there is nothing to send.</div> : mode === 'family' ? send : <div className="row wrap" style={{ marginTop: 8 }}><button className="btn" onClick={() => setPage(true)}>Open the parent page</button></div>}
        {mode === 'family' && !optedOut && <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>What goes in: his own counts, levels then and now, goals, practices and pitches logged. What never goes in: note text, your private notes, or any other kid.</p>}
      </div>

      {page && <PrintSheet title={`${first}'s progress`} html={renderProgressHtml(report, { coachName: settings.coachName })} fileName={`${first}-progress.html`} onClose={() => setPage(false)} onShared={() => record('file', `${first}-progress.html (${PERIOD_LABEL[period]})`)} />}
      {preview && (
        <Sheet title={preview.title} onClose={() => setPreview(null)} footer={<>
          <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(preview.text); await record('copy', preview.text); toast.show('Copied'); } catch { toast.show('Could not copy; select the text instead'); } }}>Copy</button>
          <button className="btn primary" onClick={() => {
            const pv = preview;
            setPreview(null);
            if (pv.kind === 'text') {
              if (!parent?.phone) return toast.show('Add a phone number first');
              window.location.href = smsLink(parent.phone, pv.text);
              record('text', pv.text);
            } else {
              if (!parent?.email) return toast.show('Add an email first');
              window.location.href = mailtoLink(parent.email, pv.subject ?? '', pv.text);
              record('email', pv.text);
            }
          }}>{preview.kind === 'text' ? (preview.to ? 'Open Messages' : 'Add a phone first') : (preview.to ? 'Open Mail' : 'Add an email first')}</button>
        </>}>
          {preview.subject && <div className="small"><strong>Subject:</strong> {preview.subject}</div>}
          <pre className="small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--bg-sunk)', padding: 10, borderRadius: 8 }}>{preview.text}</pre>
          <p className="muted small">Edit it in Messages or Mail before sending; this is a draft from your counts.</p>
        </Sheet>
      )}
      {toast.el}
    </>
  );
}
