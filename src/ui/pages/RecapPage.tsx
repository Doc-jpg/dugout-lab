import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePractice, usePlayerMap, useObservations, useDrills, useVariants, usePlayers } from '../hooks';
import { updatePractice, playerName, saveVariant, db, updatePlayer } from '../../db/db';
import { suggestionsForTeam } from '../../engine/suggestions';
import { nowIso, CATEGORY_LABEL } from '../../engine/types';
import { READ_LABEL } from './LivePracticePage';
import { useToast } from '../components/Sheet';

/** End of practice: what happened, who had wins, what to follow up, did the custom versions help. */
export function RecapPage() {
  const { practiceId = '' } = useParams();
  const practice = usePractice(practiceId);
  const players = usePlayerMap(practice?.teamId);
  const playerList = usePlayers(practice?.teamId);
  const observations = useObservations();
  const drills = useDrills();
  const variants = useVariants();
  const nav = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'yes' | 'some' | 'no'>>({});

  const todayObs = useMemo(() => observations.filter((o) => o.practiceId === practiceId), [observations, practiceId]);
  const suggestions = useMemo(() => (practice ? suggestionsForTeam(playerList.filter((p) => practice.inputs.presentIds.includes(p.id)), observations, drills) : []), [practice, playerList, observations, drills]);
  if (!practice) return <div className="empty">Loading…</div>;

  const wins = todayObs.filter((o) => o.read === 'got_it' || o.read === 'confident' || o.read === 'reset_worked');
  const struggles = todayObs.filter((o) => o.read === 'struggled' || o.read === 'hesitated' || o.read === 'frustrated');
  const usedVariantIds = new Set(practice.blocks.flatMap((b) => b.stations.flatMap((s) => s.objectives.map((o) => o.variantId).filter(Boolean) as string[])));
  const usedVariants = variants.filter((v) => usedVariantIds.has(v.id));
  const counts = todayObs.reduce<Record<string, number>>((acc, o) => ((acc[o.read] = (acc[o.read] ?? 0) + 1), acc), {});
  const autoSummary = `${practice.inputs.presentIds.length} players, ${practice.blocks.length} blocks. ${todayObs.length} notes: ${Object.entries(counts).map(([k, n]) => `${n} ${READ_LABEL[k as keyof typeof READ_LABEL].toLowerCase()}`).join(', ') || 'none'}.`;
  const line = (o: (typeof todayObs)[number]) => `${playerName(players.get(o.playerId), 'first')}: ${READ_LABEL[o.read].toLowerCase()}${o.category ? ` (${CATEGORY_LABEL[o.category].toLowerCase()})` : ''}${o.text ? `, ${o.text}` : ''}`;

  const rate = async (variantId: string, helped: 'yes' | 'some' | 'no') => {
    setRatings({ ...ratings, [variantId]: helped });
    const v = await db.variants.get(variantId);
    if (v) await saveVariant({ ...v, helped });
  };
  const finish = async () => {
    await updatePractice(practice.id, {
      status: 'done',
      live: practice.live ? { ...practice.live, paused: true, elapsedSec: 0, runningSince: undefined } : undefined,
      recap: {
        summary: summary ?? autoSummary,
        wins: wins.map(line),
        followUps: [...struggles.map(line), ...suggestions.slice(0, 5).map((s) => s.text)],
        variantRatings: Object.entries(ratings).map(([variantId, helped]) => ({ variantId, helped })),
        finishedAt: nowIso()
      }
    });
    toast.show('Practice saved');
    nav('/today');
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => nav(-1)}>‹ Back</button>
      </div>
      <h1>Recap</h1>
      <div className="card">
        <div className="field"><label>How it went</label><textarea className="input" value={summary ?? practice.recap?.summary ?? autoSummary} onChange={(e) => setSummary(e.target.value)} /></div>
      </div>

      <div className="section-title"><h3>Who was here</h3><span className="muted small">{practice.inputs.presentIds.length} of {playerList.filter((p) => p.status === 'active').length}; tap to fix</span></div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {playerList.filter((p) => p.status === 'active').map((p) => {
          const here = practice.inputs.presentIds.includes(p.id);
          return <button key={p.id} className={`chip sm ${here ? 'on' : 'struck'}`} onClick={async () => { const presentIds = here ? practice.inputs.presentIds.filter((id) => id !== p.id) : [...practice.inputs.presentIds, p.id]; const absentIds = here ? [...practice.inputs.absentIds, p.id] : practice.inputs.absentIds.filter((id) => id !== p.id); await updatePractice(practice.id, { inputs: { ...practice.inputs, presentIds, absentIds } }); }}>{playerName(p, 'short')}</button>;
        })}
      </div>

      <div className="section-title"><h3>Wins</h3><span className="muted small">{wins.length}</span></div>
      <div className="list">{wins.map((o) => <div key={o.id} className="item small"><span className="grow">{line(o)}</span></div>)}{wins.length === 0 && <div className="empty">No wins noted. Next time, tap a name and "Got it" when you see one; kids remember being noticed.</div>}</div>

      <div className="section-title"><h3>Work on next</h3><span className="muted small">{struggles.length}</span></div>
      <div className="list">{struggles.map((o) => {
        const pl = players.get(o.playerId);
        const marked = !!(o.category && pl?.statuses[o.category] === 'review');
        return (
          <div key={o.id} className="item small">
            <span className="grow">{line(o)}</span>
            {o.category && pl && <button className={`btn sm ${marked ? 'ghost' : ''}`} disabled={marked} onClick={async () => { await updatePlayer(pl.id, { statuses: { ...pl.statuses, [o.category!]: 'review' } }); toast.show(`${pl.firstName}: ${CATEGORY_LABEL[o.category!]} marked for follow-up`); }}>{marked ? 'Follow-up set' : 'Follow up'}</button>}
          </div>
        );
      })}{struggles.length === 0 && <div className="empty">Nothing flagged today.</div>}</div>

      {usedVariants.length > 0 && (
        <>
          <div className="section-title"><h3>Did the custom versions help?</h3></div>
          <div className="list">
            {usedVariants.map((v) => (
              <div key={v.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><div className="title">{playerName(players.get(v.playerId ?? ''), 'short')}: {v.name}</div><div className="sub">{drills.find((d) => d.id === v.drillId)?.name}{v.helped ? ` · last time: ${v.helped}` : ''}</div></div>
                <div className="chips">{(['yes', 'some', 'no'] as const).map((h) => <button key={h} className={`chip sm ${(ratings[v.id] ?? v.helped) === h ? 'on' : ''}`} onClick={() => rate(v.id, h)}>{h}</button>)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title"><h3>Suggestions for next practice</h3><span className="muted small">from your notes</span></div>
      <div className="list">
        {suggestions.slice(0, 6).map((s) => <div key={s.id} className="card suggestion" style={{ padding: 10 }}><div className="tag">Suggestion</div><div className="small">{s.text}</div></div>)}
        {suggestions.length === 0 && <div className="empty">Suggestions appear once a pattern shows up in your notes (two or more on the same thing).</div>}
      </div>

      {practice.status !== 'done' && <button className="btn primary big-btn block" style={{ marginTop: 16 }} onClick={finish}>Finish practice</button>}
      {practice.status === 'done' && <button className="btn block" style={{ marginTop: 16 }} onClick={() => nav('/parents')}>Draft parent updates</button>}
      {toast.el}
    </div>
  );
}
