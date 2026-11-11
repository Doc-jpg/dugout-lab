import React, { useMemo, useState } from 'react';
import type { Category, Observation, Player } from '../../engine/types';
import { CATEGORY_LABEL } from '../../engine/types';
import { splitNarration, heardSoFar, DETAILS, FOCUS_LABEL, FOCUS_PROMPTS, FOCUS_EXAMPLE, type Focus, type Rep } from '../../engine/narrate';
import { addObservation, playerName } from '../../db/db';
import { Sheet } from './Sheet';
import { TalkBox, READ_LABEL } from './SmartNote';

const FOCI: Focus[] = ['fielding', 'hitting', 'pitching', 'general'];
const READS = Object.keys(READ_LABEL) as Observation['read'][];

export function focusFor(category?: Category): Focus {
  if (!category) return 'fielding';
  if (category === 'hitting') return 'hitting';
  if (category === 'pitching') return 'pitching';
  if (['infield', 'outfield', 'catching', 'throwing', 'team_defense'].includes(category)) return 'fielding';
  return 'general';
}

/**
 * Narrate a drill: one long dictation, name first, then what happened, next name.
 * "Done" cuts it into a rep per kid with the details pulled out; the coach looks it over,
 * fixes anything, and saves the lot.
 */
export function NarrateSheet({ players, onClose, onSaved, source = 'practice', practiceId, drillId, drillName, category }: {
  players: Player[];
  onClose: () => void;
  onSaved: (count: number, kids: number) => void;
  source?: Observation['source'];
  practiceId?: string;
  drillId?: string;
  drillName?: string;
  /** The station's area, when narrating from live practice. */
  category?: Category;
}) {
  const active = players.filter((p) => p.status === 'active');
  const [focus, setFocus] = useState<Focus>(focusFor(category));
  const [text, setText] = useState('');
  const [reps, setReps] = useState<Rep[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hint = category && focusFor(category) === focus && focus !== 'general' ? category : undefined;
  const live = useMemo(() => splitNarration(text, active, focus, hint), [text, active, focus, hint]);
  const heard = heardSoFar(live);
  const name = (id?: string) => playerName(active.find((p) => p.id === id), 'short');
  const patch = (key: string, change: Partial<Rep>) => setReps((rs) => rs!.map((r) => (r.key === key ? { ...r, ...change } : r)));

  if (!reps) {
    return (
      <Sheet title={drillName ? `Narrate: ${drillName}` : 'Narrate a drill'} onClose={onClose}
        footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!text.trim()} onClick={() => setReps(live.filter((r) => r.playerId || r.text))}>Done, sort it out</button></>}>
        <div className="chips" style={{ marginBottom: 8 }}>{FOCI.map((f) => <button key={f} className={`chip sm ${focus === f ? 'on' : ''}`} onClick={() => setFocus(f)}>{FOCUS_LABEL[f]}</button>)}</div>
        <div className="narrate-prompts">
          {FOCUS_PROMPTS[focus].map((p, i) => (
            <div key={p.step} className="narrate-step"><span className="n">{i + 1}</span><span><strong>{p.step}</strong> <span className="muted">{p.say}</span></span></div>
          ))}
        </div>
        <TalkBox value={text} onChange={setText} rows={6} keepAlive placeholder={`Tap Talk and narrate as it happens. For example: ${FOCUS_EXAMPLE[focus]}`} />
        <div className="small" style={{ marginTop: 6 }} aria-live="polite">
          {heard.length ? <><strong>{live.filter((r) => r.playerId).length} rep{live.filter((r) => r.playerId).length === 1 ? '' : 's'} heard:</strong> {heard.map(name).join(', ')}</> : <span className="muted">Say a kid's name to start his rep. Each new name starts the next one.</span>}
        </div>
      </Sheet>
    );
  }

  const ready = reps.filter((r) => r.playerId);
  const loose = reps.length - ready.length;
  const save = async () => {
    setBusy(true);
    const t0 = Date.now();
    let n = 0;
    for (const r of ready) {
      await addObservation({ playerId: r.playerId!, read: r.read, category: r.category, text: r.text || undefined, tags: r.tags.length ? r.tags : undefined, source, practiceId, drillId, ts: new Date(t0 + n).toISOString() });
      n += 1;
    }
    onSaved(n, new Set(ready.map((r) => r.playerId)).size);
  };
  const joinUp = (idx: number) => setReps((rs) => {
    const prev = rs![idx - 1];
    const cur = rs![idx];
    const words = [prev.text, cur.heard, cur.text].filter(Boolean).join(' ');
    const again = splitNarration(words, [], focus, hint)[0];
    const merged: Rep = { ...prev, text: words, tags: again?.tags ?? prev.tags, read: again?.read ?? prev.read };
    return rs!.filter((_, i) => i !== idx).map((r, i) => (i === idx - 1 ? merged : r));
  });

  return (
    <Sheet title="Is this what you meant?" onClose={onClose}
      footer={<><button className="btn" onClick={() => setReps(null)}>‹ Fix the words</button><button className="btn primary" disabled={!ready.length || busy} onClick={save}>Save {ready.length} note{ready.length === 1 ? '' : 's'}</button></>}>
      <p className="muted small" style={{ marginTop: 0 }}>{ready.length} rep{ready.length === 1 ? '' : 's'} for {new Set(ready.map((r) => r.playerId)).size} kid{new Set(ready.map((r) => r.playerId)).size === 1 ? '' : 's'}{loose ? `, ${loose} with no name yet` : ''}. Tap a name to move a rep, a detail to drop it.</p>
      {reps.length === 0 && <div className="empty">No reps left. Go back and fix the words, or cancel.</div>}
      {reps.map((r, idx) => (
        <div key={r.key} className={`card rep ${r.playerId ? '' : 'loose'}`}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <button className={`chip ${r.playerId ? 'on' : ''}`} onClick={() => setPicking(picking === r.key ? null : r.key)}>
              {r.playerId ? `${r.confidence < 0.85 ? 'Maybe ' : ''}${name(r.playerId)}` : 'Who was this?'}
            </button>
            <div className="row">
              {idx > 0 && <button className="btn ghost sm" onClick={() => joinUp(idx)} title="This was part of the rep above">Join above</button>}
              <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => setReps(reps.filter((x) => x.key !== r.key))} aria-label="Drop this rep">Drop</button>
            </div>
          </div>
          {r.playerId && r.confidence < 0.85 && picking !== r.key && (
            <div className="small muted" style={{ marginTop: 4 }}>Heard "{r.heard}".{r.alternatives.length ? <> Or: {r.alternatives.map((id) => <button key={id} className="chip sm" style={{ marginLeft: 4 }} onClick={() => patch(r.key, { playerId: id, confidence: 1, alternatives: [] })}>{name(id)}</button>)}</> : null} <button className="chip sm" style={{ marginLeft: 4 }} onClick={() => patch(r.key, { confidence: 1, alternatives: [] })}>Yes, {name(r.playerId)}</button></div>
          )}
          {picking === r.key && (
            <div className="chips" style={{ marginTop: 6 }}>{active.map((p) => <button key={p.id} className={`chip sm ${r.playerId === p.id ? 'on' : ''}`} onClick={() => { patch(r.key, { playerId: p.id, confidence: 1, alternatives: [] }); setPicking(null); }}>{playerName(p, 'short')}</button>)}</div>
          )}
          {r.tags.length > 0 && <div className="chips" style={{ marginTop: 6 }}>{r.tags.map((t) => { const tone = DETAILS.find((d) => d.tag === t)?.tone ?? 0; return <button key={t} className={`chip sm tag ${tone > 0 ? 'good' : tone < 0 ? 'bad' : ''}`} onClick={() => patch(r.key, { tags: r.tags.filter((x) => x !== t) })}>{t}</button>; })}</div>}
          {r.text && <div className="small" style={{ marginTop: 6 }}>"{r.text}"</div>}
          <div className="row" style={{ marginTop: 6 }}>
            <select className="input sm" value={r.read} onChange={(e) => patch(r.key, { read: e.target.value as Observation['read'] })} aria-label="What you saw">{READS.map((x) => <option key={x} value={x}>{READ_LABEL[x]}</option>)}</select>
            {r.category && <span className="muted small">{CATEGORY_LABEL[r.category]}</span>}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
