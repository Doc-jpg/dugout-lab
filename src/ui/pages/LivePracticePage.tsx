import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePractice, useGeneratorContext, usePlayerMap, useDrills, useObservations, useOnline } from '../hooks';
import { savePractice, updatePractice, playerName, addObservation } from '../../db/db';
import { regenerateStation, adjustPractice, setStationProgression } from '../../engine/generator';
import { nowIso, type Practice, type Observation, type Category } from '../../engine/types';
import { StationCard } from '../components/StationCard';
import { Sheet, useToast } from '../components/Sheet';
import { GameNoteSheet } from './TodayPage';

/**
 * Live practice: one hand, on the field. Current block and rotation, a big timer, the station
 * you are standing at, each kid's objective, and a two-tap observation.
 * Live state (block, rotation, clock) is saved to the practice so closing the app loses nothing.
 */
export function LivePracticePage() {
  const { practiceId = '' } = useParams();
  const practice = usePractice(practiceId);
  const ctx = useGeneratorContext(practice?.teamId);
  const players = usePlayerMap(practice?.teamId);
  const drills = useDrills();
  const observations = useObservations();
  const online = useOnline();
  const nav = useNavigate();
  const toast = useToast();
  const [stationIdx, setStationIdx] = useState(0);
  const [note, setNote] = useState<{ playerId: string } | null>(null);
  const [freeNote, setFreeNote] = useState(false);
  const [swap, setSwap] = useState(false);
  const [tick, setTick] = useState(0);
  const drillMap = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);

  // Start the practice the first time this screen opens.
  useEffect(() => {
    if (!practice) return;
    if (practice.status === 'planned' || !practice.live) {
      updatePractice(practice.id, { status: 'live', live: { startedAt: nowIso(), blockIndex: 0, rotation: 0, elapsedSec: 0, runningSince: nowIso(), paused: false } });
    }
  }, [practice?.id, practice?.status]);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!practice || !ctx) return <div className="empty">Loading…</div>;
  const live = practice.live ?? { startedAt: nowIso(), blockIndex: 0, rotation: 0, elapsedSec: 0, paused: true };
  const block = practice.blocks[Math.min(live.blockIndex, practice.blocks.length - 1)];
  const nextBlock = practice.blocks[live.blockIndex + 1];
  const rotations = block.wholeTeam ? Math.max(1, block.stations.length) : Math.max(1, block.groups.length);
  const rotationSec = block.rotationMin * 60;
  const elapsed = live.elapsedSec + (live.runningSince && !live.paused ? Math.floor((Date.now() - new Date(live.runningSince).getTime()) / 1000) : 0);
  void tick;
  const remaining = rotationSec - elapsed;
  const mm = Math.floor(Math.abs(remaining) / 60);
  const ss = Math.abs(remaining) % 60;
  const timerText = `${remaining < 0 ? '-' : ''}${mm}:${String(ss).padStart(2, '0')}`;

  // In a whole-team block the "rotation" is which drill is running; otherwise which group is at which station.
  const station = block.wholeTeam ? block.stations[Math.min(live.rotation, block.stations.length - 1)] : block.stations[Math.min(stationIdx, block.stations.length - 1)];
  const groupHere = block.wholeTeam ? block.groups[0] : block.groups[(stationIdx + live.rotation) % Math.max(1, block.groups.length)];
  const hereIds = groupHere?.playerIds ?? practice.inputs.presentIds;
  const todayObs = observations.filter((o) => o.practiceId === practice.id);

  const setLive = (patch: Partial<NonNullable<Practice['live']>>) => updatePractice(practice.id, { live: { ...live, ...patch } });
  const pause = () => setLive(live.paused ? { paused: false, runningSince: nowIso() } : { paused: true, elapsedSec: elapsed, runningSince: undefined });
  const addMinutes = async (n: number) => {
    const blocks = practice.blocks.map((b, i) => (i === live.blockIndex ? { ...b, rotationMin: Math.max(1, b.rotationMin + n), minutes: Math.max(1, b.minutes + n * rotations) } : b));
    await updatePractice(practice.id, { blocks });
    toast.show(`${n > 0 ? '+' : ''}${n} min this rotation`);
  };
  const next = async () => {
    if (live.rotation + 1 < rotations) {
      await setLive({ rotation: live.rotation + 1, elapsedSec: 0, runningSince: nowIso(), paused: false });
    } else if (nextBlock) {
      await setLive({ blockIndex: live.blockIndex + 1, rotation: 0, elapsedSec: 0, runningSince: nowIso(), paused: false });
      setStationIdx(0);
    } else {
      nav(`/practices/${practice.id}/recap`);
    }
  };
  const back = async () => {
    if (live.rotation > 0) await setLive({ rotation: live.rotation - 1, elapsedSec: 0, runningSince: nowIso(), paused: false });
    else if (live.blockIndex > 0) {
      await setLive({ blockIndex: live.blockIndex - 1, rotation: 0, elapsedSec: 0, runningSince: nowIso(), paused: false });
      setStationIdx(0);
    }
  };
  const quick = async (playerId: string, read: Observation['read'], text?: string) => {
    const d = drillMap.get(station.drillId);
    await addObservation({ practiceId: practice.id, playerId, read, category: d?.category as Category | undefined, drillId: d?.id, text, source: 'practice' });
    toast.show(`${playerName(players.get(playerId), 'first')}: ${READ_LABEL[read]}`);
    setNote(null);
  };
  const swapStation = async (easier: boolean) => {
    const nextP = easier ? setStationProgression(practice, block.id, station.id, 'easier', ctx) : regenerateStation(practice, block.id, station.id, { ...ctx, seed: Date.now() }, {});
    const changed = JSON.stringify(nextP.blocks) !== JSON.stringify(practice.blocks);
    if (changed) await savePractice(nextP);
    toast.show(!changed ? 'Nothing else fits here; try a different drill from the plan page' : easier ? 'Easier version at this station' : 'Station swapped');
    setSwap(false);
  };

  return (
    <div className="live">
      <div className="row between">
        <button className="btn ghost sm" onClick={() => nav(`/practices/${practice.id}`)}>‹ Plan</button>
        <div className="row">
          {!online && <span className="pill">Offline, saving on phone</span>}
          <button className="btn" onClick={() => setFreeNote(true)}>+ Note</button>
          <button className="btn" onClick={() => nav(`/practices/${practice.id}/recap`)}>Finish</button>
        </div>
      </div>

      <div className="card center" style={{ marginTop: 8 }}>
        <div className="muted small">{block.title} · {block.wholeTeam ? `${live.rotation + 1} of ${rotations}` : `rotation ${live.rotation + 1} of ${rotations}`} · block {live.blockIndex + 1} of {practice.blocks.length}</div>
        <div className={`timer ${remaining < 0 ? 'over' : remaining < 60 ? 'warn' : ''}`}>{timerText}</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="btn" onClick={() => addMinutes(-2)} aria-label="Two minutes less">-2</button>
          <button className="btn" onClick={pause}>{live.paused ? 'Resume' : 'Pause'}</button>
          <button className="btn" onClick={() => addMinutes(2)} aria-label="Two minutes more">+2</button>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="btn sm ghost" onClick={back} disabled={live.rotation === 0 && live.blockIndex === 0}>‹ Back</button>
          <button className="btn primary" onClick={next}>{live.rotation + 1 < rotations ? 'Next rotation ›' : nextBlock ? `Next: ${nextBlock.title} ›` : 'Finish ›'}</button>
        </div>
        {nextBlock && live.rotation + 1 >= rotations && <div className="muted small" style={{ marginTop: 6 }}>Up next: {nextBlock.title}, {nextBlock.minutes} min</div>}
      </div>

      {!block.wholeTeam && block.stations.length > 1 && (
        <div className="chips" style={{ margin: '10px 0 6px' }}>
          {block.stations.map((s, i) => <button key={s.id} className={`chip ${i === stationIdx ? 'on' : ''}`} onClick={() => setStationIdx(i)}>{s.nameOverride || drillMap.get(s.drillId)?.name || `Station ${i + 1}`}</button>)}
        </div>
      )}

      <StationCard key={station.id + String(live.rotation)} block={block} station={station} drill={drillMap.get(station.drillId)} players={players} groupLabel={block.wholeTeam ? undefined : groupHere?.name} highlightIds={block.wholeTeam ? undefined : hereIds} expanded actions={<button className="btn" onClick={() => setSwap(true)}>This station is not working</button>} />

      <div className="section-title"><h3>Quick note</h3><span className="muted small">{todayObs.length} so far</span></div>
      <div className="chips">
        {hereIds.map((id) => {
          const n = todayObs.filter((o) => o.playerId === id).length;
          return <button key={id} className="chip" onClick={() => setNote({ playerId: id })}>{playerName(players.get(id), 'short')}{n ? ` (${n})` : ''}</button>;
        })}
      </div>

      {note && (
        <Sheet title={`${playerName(players.get(note.playerId), 'short')}: what did you see?`} onClose={() => setNote(null)}>
          <div className="small muted" style={{ marginBottom: 8 }}>{station.objectives.find((o) => o.playerId === note.playerId)?.technical}</div>
          <div className="btn-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['got_it', 'working', 'struggled', 'hesitated'] as Observation['read'][]).map((r) => <button key={r} className="btn" onClick={() => quick(note.playerId, r)}>{READ_LABEL[r]}</button>)}
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="muted small">More: confidence, effort, attitude</summary>
            <div className="chips read-chips" style={{ marginTop: 8 }}>
              {(['confident', 'frustrated', 'reset_worked', 'hustle', 'teammate', 'coachable', 'coasting'] as Observation['read'][]).map((r) => <button key={r} className="chip" onClick={() => quick(note.playerId, r)}>{READ_LABEL[r]}</button>)}
            </div>
          </details>
          <QuickText onSave={(t) => quick(note.playerId, 'note', t)} />
        </Sheet>
      )}
      {freeNote && <GameNoteSheet players={[...players.values()]} source="practice" practiceId={practice.id} onClose={() => setFreeNote(false)} onSaved={() => { setFreeNote(false); toast.show('Saved'); }} />}
      {swap && (
        <Sheet title="Fix this station" onClose={() => setSwap(false)}>
          <div className="col">
            <button className="btn block" onClick={() => swapStation(true)}>Run the easier version (same drill)</button>
            <button className="btn block" onClick={() => swapStation(false)}>Swap in a different drill</button>
            {practice.inputs.coaches > 1 && <button className="btn block" onClick={async () => { await savePractice(adjustPractice(practice, { kind: 'coaches', coaches: practice.inputs.coaches - 1 }, ctx)); setSwap(false); setStationIdx(0); toast.show('Stations merged for one fewer coach'); }}>Lost a coach: merge stations</button>}
          </div>
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}

export const READ_LABEL: Record<Observation['read'], string> = {
  got_it: 'Got it', working: 'Working on it', struggled: 'Struggled', hesitated: 'Hesitated', confident: 'Confident', frustrated: 'Frustrated', reset_worked: 'Reset worked',
  hustle: 'Hustled', teammate: 'Good teammate', coachable: 'Took the cue', coasting: 'Went through the motions', note: 'Note'
};

function QuickText({ onSave }: { onSave: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div className="row" style={{ marginTop: 10 }}>
      <input className="input grow" placeholder="Or type a few words" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn" disabled={!t.trim()} onClick={() => onSave(t.trim())}>Save</button>
    </div>
  );
}
