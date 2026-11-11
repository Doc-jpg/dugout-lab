import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePlayers, usePractices, useObservations, useDrills, useSettings, useOnline, fmtDate, fmtTime, useThrowing, useParentUpdates } from '../hooks';
import { dueForUpdate } from '../../engine/home';
import { storageHealth, type StorageHealth, playerName, addObservation } from '../../db/db';
import { loadDemoData } from '../../data/demo';
import { suggestionsForTeam, attentionGaps } from '../../engine/suggestions';
import { throwingFlags } from '../../engine/pitchsmart';
import { CATEGORY_LABEL, CATEGORIES, today, teamAgeGroup, type Category, type Observation } from '../../engine/types';
import { useToast } from '../components/Sheet';
import { SmartNoteSheet } from '../components/SmartNote';
import { NarrateSheet } from '../components/NarrateSheet';
import { TourOffer } from '../components/Tour';
import { syncNow } from '../../io/sync';
import { programName } from '../../engine/brand';

/** Today: the next practice, what to remember about kids, one tap to start. */
export function TodayPage() {
  const team = useCurrentTeam();
  const players = usePlayers(team?.id);
  const practices = usePractices(team?.id);
  const observations = useObservations();
  const drills = useDrills();
  const settings = useSettings();
  const throwing = useThrowing();
  const online = useOnline();
  const nav = useNavigate();
  const toast = useToast();
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [gameNote, setGameNote] = useState<false | 'game' | 'quick'>(false);
  const [narrate, setNarrate] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    storageHealth().then(setHealth);
  }, []);

  const live = practices.find((p) => p.status === 'live');
  const next = live ?? practices.filter((p) => p.status === 'planned').sort((a, b) => a.date.localeCompare(b.date))[0];
  const lastDone = practices.find((p) => p.status === 'done');
  const suggestions = useMemo(() => [...suggestionsForTeam(players.filter((p) => p.status === 'active'), observations, drills), ...attentionGaps(players, observations, practices)].slice(0, 4), [players, observations, drills, practices]);
  const flags = useMemo(() => (team ? [...throwingFlags(players, throwing, teamAgeGroup(team), today()).entries()].filter(([, f]) => f.status !== 'ok') : []), [team, players, throwing]);
  const updates = useParentUpdates();
  const due = useMemo(() => dueForUpdate(players, practices, updates, settings.parentUpdateEveryPractices), [players, practices, updates, settings.parentUpdateEveryPractices]);
  const doneSinceBackup = practices.filter((p) => p.status === 'done' && (!settings.lastBackupAt || p.updatedAt > settings.lastBackupAt)).length;
  const pn = (id: string) => playerName(players.find((p) => p.id === id), 'first');

  const loadDemo = async () => {
    setBusy(true);
    try {
      const { practiceId } = await loadDemoData();
      toast.show('Demo team loaded');
      nav(`/practices/${practiceId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          {team?.brand?.logo && <img src={team.brand.logo} alt="" style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 8, background: '#fff' }} />}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: programName(team, settings).length > 14 ? 20 : undefined, lineHeight: 1.15 }}>{programName(team, settings)}</h1>
            {team?.brand?.tagline && <div className="muted small">{team.brand.tagline}</div>}
          </div>
        </div>
        <div className="row">
          {!online && <span className="pill">Offline</span>}
          <Link to="/help" className="btn ghost sm">How it works</Link>
          <Link to="/settings" className="btn ghost sm" aria-label="Settings">⚙</Link>
        </div>
      </div>
      <TourOffer />

      {!team && settings.sync?.enabled && settings.sync.role === 'helper' && (
        <div className="card">
          <h2>Linked as {settings.sync.name}</h2>
          <p className="small">Waiting for the team to arrive from {settings.packIdentity?.from ? `${settings.packIdentity.from}'s` : 'the head coach\'s'} phone. It needs a signal on both ends; it finishes on its own the next time this app opens with one.</p>
          <button className="btn" onClick={async () => { const r = await syncNow(); toast.show(r.error ? `Could not sync: ${r.error}` : r.applied ? 'Here it is' : 'Nothing there yet; try again in a minute'); }}>Check now</button>
        </div>
      )}
      {!team && !(settings.sync?.enabled && settings.sync.role === 'helper') && (
        <div className="card">
          <h2>Start here</h2>
          <p className="muted small">Try the demo team to see how a practice comes together, or set up your own roster. Nothing leaves this phone.</p>
          <div className="col">
            <button className="btn primary big-btn" onClick={() => nav('/setup')}>Set up my team (2 minutes)</button>
            <button className="btn" onClick={loadDemo} disabled={busy}>{busy ? 'Loading…' : 'Try the demo team first'}</button>
            <button className="btn ghost" onClick={() => nav('/settings#dugout-dad')}>Import roster from Dugout Dad</button>
          </div>
        </div>
      )}

      {team && (
        <>
          {next ? (
            <div className="card" data-tour="today-next">
              <div className="row between">
                <div>
                  <div className="muted small">{live ? 'Practice in progress' : 'Next practice'}</div>
                  <h2 style={{ margin: '2px 0' }}>{fmtDate(next.date)}{next.time ? `, ${fmtTime(next.time)}` : ''}</h2>
                  <div className="small">{next.inputs.durationMin} min · {next.inputs.presentIds.length} players · {next.inputs.coaches} coach{next.inputs.coaches === 1 ? '' : 'es'}{next.inputs.indoor ? ' · indoors' : ''}</div>
                </div>
              </div>
              <div className="col" style={{ marginTop: 10 }}>
                {(live || next.date <= today()) ? <button className="btn primary big-btn" onClick={() => nav(`/practices/${next.id}/live`)}>{live ? 'Resume practice' : 'Start practice'}</button> : <button className="btn primary big-btn" onClick={() => nav(`/practices/${next.id}`)}>Open the plan</button>}
                {(live || next.date <= today()) ? <button className="btn" onClick={() => nav(`/practices/${next.id}`)}>Open the plan</button> : <button className="btn ghost" onClick={() => nav(`/practices/${next.id}/live`)}>Start it early</button>}
              </div>
            </div>
          ) : (
            <div className="card">
              <h2>No practice planned</h2>
              <p className="muted small">Generate one in seconds: who is here, how long, how many coaches.</p>
              <button className="btn primary big-btn block" data-tour="today-next" onClick={() => nav('/practices/new')}>+ New practice</button>
            </div>
          )}

          {team.priorities.length > 0 && (
            <div className="row wrap" style={{ margin: '8px 0' }}>
              <span className="muted small">Team priorities:</span>
              {team.priorities.map((c) => <span key={c} className="pill">{CATEGORY_LABEL[c]}</span>)}
            </div>
          )}

          {flags.length > 0 && (
            <div className="banner warn">
              <strong>Arms:</strong> {flags.map(([id, f]) => `${pn(id)}: ${f.message}`).join(' ')}
            </div>
          )}

          <div className="section-title"><h3>Player reminders</h3><Link to="/progress" className="small">All</Link></div>
          {suggestions.length === 0 && <div className="empty">Nothing yet. Reminders come from the quick notes you take during practices and games.</div>}
          <div className="list">
            {suggestions.map((s) => (
              <button key={s.id} className="card suggestion" style={{ padding: 10, cursor: 'pointer', textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit' }} onClick={() => nav(`/players/${s.playerId}`)}>
                <div className="tag">Suggestion{s.fromGame ? ' · from a game' : ''}</div>
                <div className="small">{s.text}</div>
              </button>
            ))}
          </div>

          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="btn" data-tour="note" onClick={() => setGameNote('quick')}>+ Note</button>
            <button className="btn" onClick={() => setGameNote('game')}>+ Game note</button>
            <button className="btn" onClick={() => setNarrate(true)}>Narrate a drill</button>
            <button className="btn" onClick={() => nav('/practices/new')}>+ New practice</button>
            <button className="btn" onClick={() => nav('/parents')}>Parent updates{due.length ? ` (${due.length} due)` : ''}</button>
          </div>

          {lastDone && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="muted small">Last practice, {fmtDate(lastDone.date)}</div>
              {lastDone.recap?.summary && <div className="small">{lastDone.recap.summary}</div>}
              {lastDone.recap?.followUps.length ? <div className="small" style={{ marginTop: 4 }}><strong>Follow up:</strong> {lastDone.recap.followUps.slice(0, 3).join(' · ')}</div> : null}
            </div>
          )}

          {doneSinceBackup >= settings.backupReminderPractices && (
            <div className="banner info row between" style={{ marginTop: 12 }}>
              <span>{doneSinceBackup} practices since the last backup.</span>
              <Link to="/settings#backup" className="btn sm">Back up</Link>
            </div>
          )}
        </>
      )}

      {health && health.verdict === 'install' && <div className="banner warn" style={{ marginTop: 12 }}>{health.message}</div>}

      {narrate && team && <NarrateSheet players={players} source="quick" onClose={() => setNarrate(false)} onSaved={(n, k) => { setNarrate(false); toast.show(`${n} note${n === 1 ? '' : 's'} saved for ${k} kid${k === 1 ? '' : 's'}`); }} />}
      {gameNote && team && <SmartNoteSheet players={players} source={gameNote} onClose={() => setGameNote(false)} onSaved={(pid) => { setGameNote(false); toast.show(`${gameNote === 'game' ? 'Game note' : 'Note'} saved for ${playerName(players.find((p) => p.id === pid), 'first')}`); }} />}
      {toast.el}
    </div>
  );
}
