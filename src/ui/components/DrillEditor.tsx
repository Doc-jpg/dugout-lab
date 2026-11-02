import React, { useState } from 'react';
import { Sheet } from './Sheet';
import {
  CATEGORIES, CATEGORY_LABEL, BLOCK_LABEL, EQUIPMENT_LABEL, SPACE_LABEL, STYLE_WORD, THROWING_LOAD_WORD,
  type Drill, type Category, type BlockKind, type Equipment, type Space, type Level, type ThrowingLoad
} from '../../engine/types';

type DrillDraft = Omit<Drill, 'id' | 'createdAt' | 'updatedAt' | 'source'>;

const EMPTY: DrillDraft = {
  name: '', category: 'hitting', levelMin: 1, levelMax: 5, blocks: ['fundamentals', 'focus'], minutes: 10, playersMin: 2, playersMax: 6, coaches: 1,
  equipment: [], space: 'half', indoorOk: true, objective: '', setup: '', steps: [], cues: [], success: '', easier: '', harder: '',
  throwingLoad: 'none', tags: [], style: 'blocked'
};

/** Create or edit a drill. Every field editable: instructions, objective, equipment, time, spacing, intensity, reps, cues, success. */
export function DrillEditor({ title, initial, onClose, onSave }: { title: string; initial?: Partial<DrillDraft>; onClose: () => void; onSave: (d: DrillDraft) => void }) {
  const [d, setD] = useState<DrillDraft>({ ...EMPTY, ...(initial ?? {}) });
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'));
  const [cues, setCues] = useState((initial?.cues ?? []).join('\n'));
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [links, setLinks] = useState((initial?.links ?? []).map((l) => `${l.label} ${l.url}`).join('\n'));
  const set = (k: keyof DrillDraft, v: any) => setD({ ...d, [k]: v });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const ok = d.name.trim() && d.objective.trim() && lines(steps).length > 0;
  return (
    <Sheet title={title} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok} onClick={() => onSave({ ...d, steps: lines(steps), cues: lines(cues), tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean), links: lines(links).map((l) => { const m = /^(.*?)\s*(https?:\/\/\S+)$/.exec(l); return m ? { label: m[1].trim() || 'Video', url: m[2] } : { label: l, url: l }; }).filter((l) => /^https?:/.test(l.url)) })}>Save</button></>}>
      <div className="field"><label>Name</label><input className="input" value={d.name} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="field"><label>Area</label><div className="chips">{CATEGORIES.map((c) => <button key={c} className={`chip sm ${d.category === c ? 'on' : ''}`} onClick={() => set('category', c)}>{CATEGORY_LABEL[c]}</button>)}</div></div>
      <div className="field"><label>Also works on</label><div className="chips">{CATEGORIES.filter((c) => c !== d.category).map((c) => <button key={c} className={`chip sm ${d.also?.includes(c) ? 'on' : ''}`} onClick={() => set('also', toggle<Category>(d.also ?? [], c))}>{CATEGORY_LABEL[c]}</button>)}</div></div>
      <div className="field"><label>Objective (one sentence)</label><input className="input" value={d.objective} onChange={(e) => set('objective', e.target.value)} /></div>
      <div className="field"><label>Setup</label><input className="input" value={d.setup} onChange={(e) => set('setup', e.target.value)} /></div>
      <div className="field"><label>Steps (one per line)</label><textarea className="input" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} /></div>
      <div className="field"><label>Cues (one per line)</label><textarea className="input" value={cues} onChange={(e) => setCues(e.target.value)} /></div>
      <div className="field"><label>"Got it" looks like</label><input className="input" value={d.success} onChange={(e) => set('success', e.target.value)} /></div>
      <div className="inline-fields">
        <div className="field"><label>Easier</label><input className="input" value={d.easier} onChange={(e) => set('easier', e.target.value)} /></div>
        <div className="field"><label>Harder</label><input className="input" value={d.harder} onChange={(e) => set('harder', e.target.value)} /></div>
      </div>
      <div className="field"><label>Mental hook (optional)</label><input className="input" value={d.mentalHook ?? ''} onChange={(e) => set('mentalHook', e.target.value || undefined)} placeholder="One breath before each rep" /></div>
      <div className="field"><label>Decision it forces (optional)</label><input className="input" value={d.decisionHook ?? ''} onChange={(e) => set('decisionHook', e.target.value || undefined)} placeholder="Which base, before the ball arrives" /></div>
      <div className="field"><label>Fits these parts of practice</label><div className="chips">{(Object.keys(BLOCK_LABEL) as BlockKind[]).map((b) => <button key={b} className={`chip sm ${d.blocks.includes(b) ? 'on' : ''}`} onClick={() => set('blocks', toggle<BlockKind>(d.blocks, b))}>{BLOCK_LABEL[b]}</button>)}</div></div>
      <div className="field"><label>Levels</label><div className="row"><span className="small">from</span><div className="chips">{([1, 2, 3, 4, 5] as Level[]).map((l) => <button key={l} className={`chip sm ${d.levelMin === l ? 'on' : ''}`} onClick={() => set('levelMin', l)}>{l}</button>)}</div><span className="small">to</span><div className="chips">{([1, 2, 3, 4, 5] as Level[]).map((l) => <button key={l} className={`chip sm ${d.levelMax === l ? 'on' : ''}`} onClick={() => set('levelMax', l)}>{l}</button>)}</div></div></div>
      <div className="inline-fields">
        <div className="field"><label>Minutes</label><input className="input" type="number" value={d.minutes} onChange={(e) => set('minutes', parseInt(e.target.value || '0', 10))} /></div>
        <div className="field"><label>Players min</label><input className="input" type="number" value={d.playersMin} onChange={(e) => set('playersMin', parseInt(e.target.value || '1', 10))} /></div>
        <div className="field"><label>max</label><input className="input" type="number" value={d.playersMax} onChange={(e) => set('playersMax', parseInt(e.target.value || '1', 10))} /></div>
      </div>
      <div className="field"><label>Coaches needed</label><div className="chips">{([0, 1, 2] as const).map((n) => <button key={n} className={`chip sm ${d.coaches === n ? 'on' : ''}`} onClick={() => set('coaches', n)}>{n === 0 ? 'Player-led' : n}</button>)}</div></div>
      <div className="field"><label>Equipment</label><div className="chips">{(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => <button key={e} className={`chip sm ${d.equipment.includes(e) ? 'on' : ''}`} onClick={() => set('equipment', toggle<Equipment>(d.equipment, e))}>{EQUIPMENT_LABEL[e]}</button>)}</div></div>
      <div className="field"><label>Space</label><div className="chips">{(['tight', 'half', 'full'] as Space[]).map((s) => <button key={s} className={`chip sm ${d.space === s ? 'on' : ''}`} onClick={() => set('space', s)}>{SPACE_LABEL[s]}</button>)}</div></div>
      <label className="switch row between" style={{ marginBottom: 10 }}><span>Works indoors</span><input type="checkbox" checked={d.indoorOk} onChange={(e) => set('indoorOk', e.target.checked)} /></label>
      <div className="field"><label>Throwing load</label><div className="chips">{(['none', 'light', 'moderate', 'high'] as ThrowingLoad[]).map((t) => <button key={t} className={`chip sm ${d.throwingLoad === t ? 'on' : ''}`} onClick={() => set('throwingLoad', t)}>{THROWING_LOAD_WORD[t]}</button>)}</div></div>
      <div className="field"><label>Practice style</label><div className="chips">{(['blocked', 'variable', 'random', 'decision', 'game'] as Drill['style'][]).map((s) => <button key={s} className={`chip sm ${d.style === s ? 'on' : ''}`} onClick={() => set('style', s)}>{STYLE_WORD[s]}</button>)}</div><div className="muted small">Reps = the same rep over and over. Mixed reps = same skill, changing conditions. Game-speed mix = mixed skills at speed. Make a read = a decision before the action. Competition = score or clock.</div></div>
      <div className="field"><label>Tags (comma separated)</label><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
      <div className="field"><label>Links for home work (one per line: a label then the web address)</label><textarea className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder={'Drop step demo https://www.youtube.com/watch?v=...'} /><div className="muted small">Only links you add yourself go to parents.</div></div>
      <div className="field"><label>Where the idea comes from (optional)</label><input className="input" value={d.attribution ?? ''} onChange={(e) => set('attribution', e.target.value || undefined)} /></div>
    </Sheet>
  );
}
