import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePractice, useGeneratorContext, usePlayerMap, fmtDate, fmtTime, useDrills } from '../hooks';
import { db, savePractice, playerName, updatePractice } from '../../db/db';
import { regenerateStation, setStationDrill, setStationProgression, adjustPractice, validatePractice, type Adjustment } from '../../engine/generator';
import { CATEGORIES, CATEGORY_LABEL, EQUIPMENT_LABEL, nowIso, type Category, type Equipment, type Practice, type Station, type Block } from '../../engine/types';
import { StationCard } from '../components/StationCard';
import { Sheet, Confirm, useToast } from '../components/Sheet';

/** The plan: blocks, stations, groups, every player's objective. Change anything; regenerate one station; one-tap adjustments. */
export function PracticePlanPage() {
  const { practiceId = '' } = useParams();
  const practice = usePractice(practiceId);
  const ctx = useGeneratorContext(practice?.teamId);
  const players = usePlayerMap(practice?.teamId);
  const drills = useDrills();
  const nav = useNavigate();
  const toast = useToast();
  const [adjust, setAdjust] = useState(false);
  const [edit, setEdit] = useState<{ block: Block; station: Station } | null>(null);
  const [del, setDel] = useState(false);
  const [why, setWhy] = useState(false);
  const drillMap = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);

  if (!practice || !ctx) return <div className="empty">Loading…</div>;
  const problems = validatePractice(practice);

  const save = async (next: Practice, msg?: string) => {
    await savePractice(next);
    if (msg) toast.show(msg);
  };
  const regen = async (block: Block, station: Station, category?: Category) => save(regenerateStation(practice, block.id, station.id, { ...ctx, seed: Date.now() }, { category }), 'Station changed');
  const applyAdjust = async (a: Adjustment) => {
    await save(adjustPractice(practice, a, { ...ctx, seed: Date.now() }), 'Plan adjusted');
    setAdjust(false);
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => nav('/practices')}>‹ Practices</button>
        <div className="row">
          <button className="btn sm" onClick={() => setAdjust(true)}>Adjust</button>
          {practice.status !== 'done' && <button className="btn primary sm" onClick={() => nav(`/practices/${practice.id}/live`)}>{practice.status === 'live' ? 'Resume' : 'Start practice'}</button>}
          {practice.status === 'done' && <button className="btn sm" onClick={() => nav(`/practices/${practice.id}/recap`)}>Recap</button>}
        </div>
      </div>
      <h1 style={{ marginBottom: 2 }}>{practice.title || fmtDate(practice.date)}</h1>
      <div className="muted small">{fmtDate(practice.date)}{practice.time ? `, ${fmtTime(practice.time)}` : ''} · {practice.inputs.durationMin} min · {practice.inputs.presentIds.length} players · {practice.inputs.coaches} coach{practice.inputs.coaches === 1 ? '' : 'es'}{practice.inputs.indoor ? ' · indoors' : ''}</div>
      {practice.inputs.absentIds.length > 0 && <div className="small muted">Out today: {practice.inputs.absentIds.map((id) => playerName(players.get(id), 'short')).join(', ')}</div>}
      {practice.inputs.noThrowingIds.length > 0 && <div className="small muted">No hard throwing: {practice.inputs.noThrowingIds.map((id) => playerName(players.get(id), 'short')).join(', ')}</div>}
      {problems.length > 0 && <div className="banner warn">Check: {problems.join('; ')}</div>}

      <details className="card small" open={why} onToggle={(e) => setWhy((e.target as HTMLDetailsElement).open)} style={{ marginTop: 8 }}>
        <summary className="muted">Why this plan ({practice.rationale.length} notes)</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{practice.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </details>

      {practice.blocks.map((b) => (
        <div key={b.id} className="section">
          <div className="block-head">
            <h3>{b.title}</h3>
            <span className="muted small">{minuteLabel(b.startMin)} to {minuteLabel(b.startMin + b.minutes)} · {b.minutes} min{!b.wholeTeam ? ` · rotate every ${b.rotationMin}` : ''}</span>
          </div>
          {!b.wholeTeam && (
            <div className="row wrap small" style={{ marginBottom: 6 }}>
              {b.groups.map((g) => <span key={g.id} className="pill">{g.name}: {g.playerIds.map((id) => playerName(players.get(id), 'first')).join(', ')}</span>)}
            </div>
          )}
          <div className="col">
            {b.stations.map((s) => (
              <StationCard
                key={s.id}
                block={b}
                station={s}
                drill={drillMap.get(s.drillId)}
                players={players}
                actions={
                  practice.status !== 'done' && (
                    <>
                      <button className="btn sm" onClick={() => regen(b, s)}>Regenerate this station</button>
                      <button className="btn sm" onClick={() => setEdit({ block: b, station: s })}>Change</button>
                      {s.progression !== 'easier' && <button className="btn sm" onClick={() => save(setStationProgression(practice, b.id, s.id, 'easier', ctx), 'Easier version')}>Easier</button>}
                      {s.progression !== 'base' && <button className="btn sm" onClick={() => save(setStationProgression(practice, b.id, s.id, 'base', ctx), 'Base version')}>Base</button>}
                      {s.progression !== 'harder' && <button className="btn sm" onClick={() => save(setStationProgression(practice, b.id, s.id, 'harder', ctx), 'Harder version')}>Harder</button>}
                    </>
                  )
                }
              />
            ))}
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={() => setDel(true)}>Delete practice</button>
      </div>

      {adjust && <AdjustSheet practice={practice} players={players} onApply={applyAdjust} onClose={() => setAdjust(false)} />}
      {edit && (
        <EditStationSheet
          practice={practice}
          block={edit.block}
          station={edit.station}
          drills={drills}
          onClose={() => setEdit(null)}
          onPick={async (drillId) => {
            const d = drillMap.get(drillId);
            if (!d) return;
            await save(setStationDrill(practice, edit.block.id, edit.station.id, d, ctx), `${d.name} is in`);
            setEdit(null);
          }}
          onRegen={async (category) => { await regen(edit.block, edit.station, category); setEdit(null); }}
          onNote={async (nameOverride, notes) => {
            await save({ ...practice, blocks: practice.blocks.map((b) => (b.id !== edit.block.id ? b : { ...b, stations: b.stations.map((s) => (s.id === edit.station.id ? { ...s, nameOverride: nameOverride || undefined, notes: notes ? `category:${(s.notes?.match(/^category:(\w+)/)?.[1] ?? 'hitting')}\n${notes}` : s.notes } : s)) })) }, 'Saved');
            setEdit(null);
          }}
          onObjective={async (playerId, technical, mental) => {
            await save({ ...practice, blocks: practice.blocks.map((b) => (b.id !== edit.block.id ? b : { ...b, stations: b.stations.map((s) => (s.id === edit.station.id ? { ...s, objectives: s.objectives.map((o) => (o.playerId === playerId ? { ...o, technical, mental: mental || undefined, from: 'coach' as const } : o)) } : s)) })) }, 'Objective saved');
          }}
        />
      )}
      {del && <Confirm title="Delete this practice?" text="The plan and its notes from live mode are removed from this device. Backups keep their copy." danger yesLabel="Delete" onNo={() => setDel(false)} onYes={async () => { await db.practices.delete(practice.id); nav('/practices'); }} />}
      {toast.el}
    </div>
  );
}

function minuteLabel(m: number): string {
  return `${m}'`;
}

function AdjustSheet({ practice, players, onApply, onClose }: { practice: Practice; players: Map<string, import('../../engine/types').Player>; onApply: (a: Adjustment) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'time' | 'people' | 'place'>('time');
  const [equipment, setEquipment] = useState<Set<Equipment>>(new Set(practice.inputs.equipment));
  const present = practice.inputs.presentIds.map((id) => players.get(id)).filter(Boolean) as import('../../engine/types').Player[];
  const absent = [...players.values()].filter((p) => p.status === 'active' && !practice.inputs.presentIds.includes(p.id));
  return (
    <Sheet title="Adjust the plan" onClose={onClose}>
      <p className="muted small">Every change keeps the drills and each player's objective wherever it still fits, and only rebuilds what has to change.</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={`chip ${tab === 'time' ? 'on' : ''}`} onClick={() => setTab('time')}>Time and coaches</button>
        <button className={`chip ${tab === 'people' ? 'on' : ''}`} onClick={() => setTab('people')}>Players</button>
        <button className={`chip ${tab === 'place' ? 'on' : ''}`} onClick={() => setTab('place')}>Weather and gear</button>
      </div>
      {tab === 'time' && (
        <>
          <div className="field"><label>Practice length (now {practice.inputs.durationMin} min)</label>
            <div className="chips">{[30, 45, 60, 75, 90, 120].filter((m) => m !== practice.inputs.durationMin).map((m) => <button key={m} className="chip" onClick={() => onApply({ kind: 'duration', minutes: m })}>{m} min</button>)}</div>
          </div>
          <div className="field"><label>Coaches (now {practice.inputs.coaches})</label>
            <div className="chips">{[1, 2, 3, 4].filter((n) => n !== practice.inputs.coaches).map((n) => <button key={n} className="chip" onClick={() => onApply({ kind: 'coaches', coaches: n })}>{n}</button>)}</div>
          </div>
        </>
      )}
      {tab === 'people' && (
        <>
          <div className="field"><label>Someone left or did not show (tap to remove)</label>
            <div className="chips">{present.map((p) => <button key={p.id} className="chip sm" onClick={() => onApply({ kind: 'remove_player', playerId: p.id })}>{playerName(p, 'short')}</button>)}</div>
          </div>
          {absent.length > 0 && (
            <div className="field"><label>Arrived late (tap to add)</label>
              <div className="chips">{absent.map((p) => <button key={p.id} className="chip sm" onClick={() => onApply({ kind: 'add_player', playerId: p.id })}>{playerName(p, 'short')}</button>)}</div>
            </div>
          )}
          <div className="field"><label>No hard throwing from now on</label>
            <div className="chips">{present.filter((p) => !practice.inputs.noThrowingIds.includes(p.id)).map((p) => <button key={p.id} className="chip sm" onClick={() => onApply({ kind: 'no_throwing', playerId: p.id })}>{playerName(p, 'short')}</button>)}</div>
          </div>
        </>
      )}
      {tab === 'place' && (
        <>
          {!practice.inputs.indoor && <button className="btn block" onClick={() => onApply({ kind: 'indoor' })} style={{ marginBottom: 10 }}>Rain: move indoors</button>}
          <div className="field"><label>Equipment actually here</label>
            <div className="chips">{(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => <button key={e} className={`chip sm ${equipment.has(e) ? 'on' : ''}`} onClick={() => { const n = new Set(equipment); if (n.has(e)) n.delete(e); else n.add(e); setEquipment(n); }}>{EQUIPMENT_LABEL[e]}</button>)}</div>
          </div>
          <button className="btn primary block" onClick={() => onApply({ kind: 'equipment', equipment: [...equipment] })}>Apply equipment</button>
        </>
      )}
    </Sheet>
  );
}

function EditStationSheet({ practice, block, station, drills, onClose, onPick, onRegen, onNote, onObjective }: {
  practice: Practice; block: Block; station: Station; drills: import('../../engine/types').Drill[];
  onClose: () => void; onPick: (drillId: string) => void; onRegen: (category?: Category) => void; onNote: (name: string, notes: string) => void; onObjective: (playerId: string, technical: string, mental: string) => void;
}) {
  const [tab, setTab] = useState<'drill' | 'note' | 'objectives'>('drill');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | ''>('');
  const [name, setName] = useState(station.nameOverride ?? '');
  const [notes, setNotes] = useState(station.notes?.replace(/^category:\w+\n?/, '') ?? '');
  const [editing, setEditing] = useState<string | null>(null);
  const [tech, setTech] = useState('');
  const [mental, setMental] = useState('');
  const players = usePlayerMap(practice.teamId);
  const used = new Set(practice.blocks.flatMap((b) => b.stations.map((s) => s.drillId)));
  const pool = drills.filter((d) => !d.archived && (!cat || d.category === cat) && (!q || d.name.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.blocks.includes(block.kind) ? 1 : 0) - (a.blocks.includes(block.kind) ? 1 : 0) || a.name.localeCompare(b.name));
  return (
    <Sheet title="Change this station" onClose={onClose}>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={`chip ${tab === 'drill' ? 'on' : ''}`} onClick={() => setTab('drill')}>Pick a drill</button>
        <button className={`chip ${tab === 'objectives' ? 'on' : ''}`} onClick={() => setTab('objectives')}>Objectives</button>
        <button className={`chip ${tab === 'note' ? 'on' : ''}`} onClick={() => setTab('note')}>Name and note</button>
      </div>
      {tab === 'drill' && (
        <>
          <div className="row wrap" style={{ marginBottom: 8 }}>
            <button className="btn sm" onClick={() => onRegen()}>Regenerate (any area)</button>
            {cat && <button className="btn sm" onClick={() => onRegen(cat)}>Regenerate in {CATEGORY_LABEL[cat]}</button>}
          </div>
          <input className="input" placeholder="Search drills" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips" style={{ margin: '8px 0' }}>{CATEGORIES.map((c) => <button key={c} className={`chip sm ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>{CATEGORY_LABEL[c]}</button>)}</div>
          <div className="list">
            {pool.slice(0, 40).map((d) => (
              <button key={d.id} className="item tappable" style={{ textAlign: 'left' }} onClick={() => onPick(d.id)}>
                <div className="grow"><div className="title">{d.name}{used.has(d.id) ? <span className="pill" style={{ marginLeft: 6 }}>in this plan</span> : null}</div><div className="sub">{CATEGORY_LABEL[d.category]} · L{d.levelMin}-{d.levelMax} · {d.minutes} min · {d.style}</div></div>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'objectives' && (
        <div className="list">
          {station.objectives.map((o) => (
            <div key={o.playerId} className="item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="title">{playerName(players.get(o.playerId), 'short')}</div>
                {editing === o.playerId ? (
                  <div className="col" style={{ marginTop: 6 }}>
                    <textarea className="input" value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Technical objective" />
                    <input className="input" value={mental} onChange={(e) => setMental(e.target.value)} placeholder="Mental objective (optional)" />
                    <div className="row"><button className="btn sm primary" onClick={() => { onObjective(o.playerId, tech, mental); setEditing(null); }}>Save</button><button className="btn sm" onClick={() => setEditing(null)}>Cancel</button></div>
                  </div>
                ) : (
                  <div className="sub">{o.technical}{o.mental ? ` · Mental: ${o.mental}` : ''}</div>
                )}
              </div>
              {editing !== o.playerId && <button className="btn sm" onClick={() => { setEditing(o.playerId); setTech(o.technical); setMental(o.mental ?? ''); }}>Edit</button>}
            </div>
          ))}
        </div>
      )}
      {tab === 'note' && (
        <>
          <div className="field"><label>Station name (optional)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave blank to use the drill name" /></div>
          <div className="field"><label>Note for this station</label><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Use the short L-screen; Coach Dave runs it" /></div>
          <button className="btn primary block" onClick={() => onNote(name, notes)}>Save</button>
        </>
      )}
    </Sheet>
  );
}
