import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDrill, useVariants, useCurrentTeam, usePlayers } from '../hooks';
import { updateDrill, duplicateDrill, saveVariant, playerName, deleteVariant } from '../../db/db';
import { CATEGORY_LABEL, BLOCK_LABEL, EQUIPMENT_LABEL, SPACE_LABEL, LEVEL_LABEL, STYLE_WORD, THROWING_LOAD_WORD, type DrillVariant } from '../../engine/types';
import { DrillEditor } from '../components/DrillEditor';
import { Sheet, Confirm, useToast } from '../components/Sheet';

/** One drill in full, plus every player's saved version of it. */
export function DrillPage() {
  const { drillId = '' } = useParams();
  const d = useDrill(drillId);
  const variants = useVariants(drillId);
  const team = useCurrentTeam();
  const players = usePlayers(team?.id);
  const nav = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [variant, setVariant] = useState<Partial<DrillVariant> | null>(null);
  const [archive, setArchive] = useState(false);
  if (!d) return <div className="empty">Drill not found.</div>;
  const pn = (id?: string) => playerName(players.find((p) => p.id === id), 'short');

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => nav(-1)}>‹ Back</button>
        <div className="row">
          {d.source === 'custom' ? <button className="btn sm" onClick={() => setEditing(true)}>Edit</button> : <button className="btn sm" onClick={async () => { const c = await duplicateDrill(d.id); toast.show('Your copy is ready to edit'); nav(`/drills/${c.id}`); }}>Make my version</button>}
          <button className="btn primary sm" onClick={() => setVariant({})}>+ Version for a player</button>
        </div>
      </div>
      <h1 style={{ marginBottom: 2 }}>{d.name}</h1>
      <div className="muted small">{CATEGORY_LABEL[d.category]}{d.also?.length ? ` (also ${d.also.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')})` : ''} · {LEVEL_LABEL[d.levelMin]} to {LEVEL_LABEL[d.levelMax]} · {d.minutes} min · {d.playersMin}-{d.playersMax} players · {d.coaches === 0 ? 'player-led' : `${d.coaches} coach${d.coaches > 1 ? 'es' : ''}`} · {STYLE_WORD[d.style]}</div>
      <div className="card" style={{ marginTop: 10 }}>
        <div><strong>Goal:</strong> {d.objective}</div>
        <div className="small muted" style={{ marginTop: 4 }}><strong>Setup:</strong> {d.setup}</div>
        <ol className="step-list">{d.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div>{d.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>
        <div className="small" style={{ marginTop: 8 }}><strong>Got it looks like:</strong> {d.success}</div>
        <div className="small" style={{ marginTop: 4 }}><strong>Easier:</strong> {d.easier}</div>
        <div className="small"><strong>Harder:</strong> {d.harder}</div>
        {d.mentalHook && <div className="small" style={{ marginTop: 4 }}><strong>Mental hook:</strong> {d.mentalHook}</div>}
        {d.decisionHook && <div className="small"><strong>Decision it forces:</strong> {d.decisionHook}</div>}
        {d.spacing && <div className="small" style={{ marginTop: 4 }}><strong>Spacing:</strong> {d.spacing}</div>}
        {d.safety && <div className="small" style={{ marginTop: 4, color: 'var(--danger)' }}><strong>Safety:</strong> {d.safety}</div>}
        {d.mistakes?.length ? <div className="small" style={{ marginTop: 6 }}><strong>What you will see, and the fix</strong><ul className="step-list" style={{ marginTop: 2 }}>{d.mistakes.map((m, i) => <li key={i}>{m.see} <span className="muted">Fix: {m.fix}</span></li>)}</ul></div> : null}
        {d.competitive && <div className="small" style={{ marginTop: 4 }}><strong>Make it a game:</strong> {d.competitive}</div>}
        <div className="small muted" style={{ marginTop: 8 }}>
          {d.blocks.map((b) => BLOCK_LABEL[b]).join(', ')} · {SPACE_LABEL[d.space]} · {d.indoorOk ? 'indoors ok' : 'outdoors only'} · {THROWING_LOAD_WORD[d.throwingLoad]} · {d.equipment.length ? d.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ') : 'no equipment'}
        </div>
        {d.attribution && <div className="small muted" style={{ marginTop: 4 }}>Source: {d.attribution}</div>}
        {d.tags.length > 0 && <div className="small muted">Tags: {d.tags.join(', ')}</div>}
      </div>

      <div className="section-title"><h3>Player versions</h3><span className="muted small">same station, different job</span></div>
      <p className="muted small" style={{ marginTop: 0 }}>A version replaces the generic objective for that player every time this drill is in a plan. Rate it after practice so you know whether it helped.</p>
      <div className="list">
        {variants.map((v) => (
          <div key={v.id} className="item" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="title">{v.playerId ? pn(v.playerId) : v.groupLabel}: {v.name}</div>
              <div className="sub">{[v.objective, v.reps, v.distance, v.equipment, v.intensity && `intensity ${v.intensity}`].filter(Boolean).join(' · ')}</div>
              {v.cues?.length ? <div>{v.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div> : null}
              {v.mental && <div className="small muted">Mental: {v.mental}</div>}
              <div className="small">{v.helped ? `Helped: ${v.helped}${v.helpedNote ? ` (${v.helpedNote})` : ''}` : 'Not rated yet'}</div>
            </div>
            <button className="btn sm" onClick={() => setVariant(v)}>Edit</button>
          </div>
        ))}
        {variants.length === 0 && <div className="empty">No player versions yet.</div>}
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        {d.archived ? <button className="btn sm" onClick={async () => { await updateDrill(d.id, { archived: false }); toast.show('Back in the list'); }}>Unhide this drill</button> : <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={() => setArchive(true)}>Hide this drill</button>}
      </div>

      {editing && <DrillEditor title="Edit drill" initial={d} onClose={() => setEditing(false)} onSave={async (next) => { await updateDrill(d.id, next); setEditing(false); toast.show('Saved'); }} />}
      {variant && <VariantSheet drillId={d.id} initial={variant} players={players} onClose={() => setVariant(null)} onSaved={() => { setVariant(null); toast.show('Version saved'); }} />}
      {archive && <Confirm title="Hide this drill?" text="It stays in your data and in existing plans, but the generator and the list leave it out." yesLabel="Hide" onNo={() => setArchive(false)} onYes={async () => { await updateDrill(d.id, { archived: true }); nav('/drills'); }} />}
      {toast.el}
    </div>
  );
}

function VariantSheet({ drillId, initial, players, onClose, onSaved }: { drillId: string; initial: Partial<DrillVariant>; players: ReturnType<typeof usePlayers>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Partial<DrillVariant>>({ intensity: 'normal', ...initial });
  const [cues, setCues] = useState((initial.cues ?? []).join('\n'));
  const set = (k: keyof DrillVariant, val: any) => setV({ ...v, [k]: val });
  const ok = (v.playerId || v.groupLabel) && v.name?.trim();
  return (
    <Sheet title={v.id ? 'Edit version' : 'Version for a player'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button>{v.id && <button className="btn" style={{ color: 'var(--danger)' }} onClick={async () => { await deleteVariant(v.id!); onSaved(); }}>Delete</button>}<button className="btn primary" disabled={!ok} onClick={async () => { await saveVariant({ ...(v as any), drillId, cues: cues.split('\n').map((c) => c.trim()).filter(Boolean) }); onSaved(); }}>Save</button></>}>
      <div className="field"><label>Player</label><div className="chips">{players.filter((p) => p.status === 'active').map((p) => <button key={p.id} className={`chip sm ${v.playerId === p.id ? 'on' : ''}`} onClick={() => setV({ ...v, playerId: p.id, groupLabel: undefined })}>{playerName(p, 'short')}</button>)}</div></div>
      <div className="field"><label>Or a group label</label><input className="input" value={v.groupLabel ?? ''} onChange={(e) => setV({ ...v, groupLabel: e.target.value || undefined, playerId: e.target.value ? undefined : v.playerId })} placeholder="Newer infielders" /></div>
      <div className="field"><label>Short name</label><input className="input" value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Stationary, soft balls, short" /></div>
      <div className="field"><label>Objective for him</label><textarea className="input" value={v.objective ?? ''} onChange={(e) => set('objective', e.target.value)} /></div>
      <div className="inline-fields">
        <div className="field"><label>Reps</label><input className="input" value={v.reps ?? ''} onChange={(e) => set('reps', e.target.value)} placeholder="2 x 8" /></div>
        <div className="field"><label>Distance</label><input className="input" value={v.distance ?? ''} onChange={(e) => set('distance', e.target.value)} placeholder="15 ft" /></div>
      </div>
      <div className="field"><label>Equipment change</label><input className="input" value={v.equipment ?? ''} onChange={(e) => set('equipment', e.target.value)} placeholder="Soft balls, no glove" /></div>
      <div className="field"><label>Intensity</label><div className="chips">{(['easy', 'normal', 'push'] as const).map((i) => <button key={i} className={`chip sm ${v.intensity === i ? 'on' : ''}`} onClick={() => set('intensity', i)}>{i}</button>)}</div></div>
      <div className="field"><label>Cues for him (one per line)</label><textarea className="input" value={cues} onChange={(e) => setCues(e.target.value)} /></div>
      <div className="field"><label>Success for him</label><input className="input" value={v.success ?? ''} onChange={(e) => set('success', e.target.value)} /></div>
      <div className="field"><label>Mental piece or reset routine</label><input className="input" value={v.mental ?? ''} onChange={(e) => set('mental', e.target.value)} placeholder="Restart the count after a bobble, no big deal" /></div>
      {v.id && <div className="field"><label>Did it help?</label><div className="chips">{(['yes', 'some', 'no'] as const).map((h) => <button key={h} className={`chip sm ${v.helped === h ? 'on' : ''}`} onClick={() => set('helped', v.helped === h ? undefined : h)}>{h}</button>)}</div><input className="input" value={v.helpedNote ?? ''} onChange={(e) => set('helpedNote', e.target.value)} placeholder="Why" /></div>}
    </Sheet>
  );
}
