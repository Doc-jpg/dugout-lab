import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDrills, useVariants } from '../hooks';
import { createDrill } from '../../db/db';
import { CATEGORIES, CATEGORY_LABEL, BLOCK_LABEL, STYLE_WORD, type Category, type BlockKind, type Drill } from '../../engine/types';
import { DrillEditor } from '../components/DrillEditor';
import { useToast } from '../components/Sheet';

export function DrillsPage() {
  const drills = useDrills();
  const variants = useVariants();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | ''>('');
  const [block, setBlock] = useState<BlockKind | ''>('');
  const [mine, setMine] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => drills
    .filter((d) => (hidden ? d.archived : !d.archived) && (!cat || d.category === cat || d.also?.includes(cat)) && (!block || d.blocks.includes(block)) && (!mine || d.source === 'custom') && (!q || `${d.name} ${d.tags.join(' ')} ${d.objective}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.category.localeCompare(b.category) || a.levelMin - b.levelMin || a.name.localeCompare(b.name)), [drills, cat, block, mine, q]);
  const variantCount = (id: string) => variants.filter((v) => v.drillId === id).length;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Drills</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Custom drill</button>
      </div>
      <input className="input" placeholder="Search by name, tag or goal" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '8px 0' }}>
        <button className={`chip sm ${mine ? 'on' : ''}`} onClick={() => setMine(!mine)}>My drills</button>
        {drills.some((d) => d.archived) && <button className={`chip sm ${hidden ? 'on' : ''}`} onClick={() => setHidden(!hidden)}>Hidden</button>}
        {CATEGORIES.map((c) => <button key={c} className={`chip sm ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>{CATEGORY_LABEL[c]}</button>)}
      </div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {(Object.keys(BLOCK_LABEL) as BlockKind[]).map((b) => <button key={b} className={`chip sm ${block === b ? 'on' : ''}`} onClick={() => setBlock(block === b ? '' : b)}>{BLOCK_LABEL[b]}</button>)}
      </div>
      <div className="muted small" style={{ marginBottom: 6 }}>{list.length} of {drills.filter((d) => !d.archived).length} drills</div>
      <div className="list">
        {list.map((d) => (
          <Link key={d.id} to={`/drills/${d.id}`} className="item tappable">
            <div className="grow">
              <div className="title">{d.name}{d.source === 'custom' ? <span className="pill" style={{ marginLeft: 6 }}>mine</span> : null}{variantCount(d.id) ? <span className="pill" style={{ marginLeft: 6 }}>{variantCount(d.id)} version{variantCount(d.id) > 1 ? 's' : ''}</span> : null}</div>
              <div className="sub">{CATEGORY_LABEL[d.category]} · levels {d.levelMin} to {d.levelMax} · {d.minutes} min · {STYLE_WORD[d.style]}{d.decisionHook ? ' · decision' : ''}{d.mentalHook ? ' · mental hook' : ''}</div>
            </div>
            <span className="chev">›</span>
          </Link>
        ))}
      </div>
      {creating && (
        <DrillEditor
          title="New custom drill"
          onClose={() => setCreating(false)}
          onSave={async (d) => {
            const created = await createDrill({ ...(d as Omit<Drill, 'id' | 'createdAt' | 'updatedAt' | 'source'>), source: 'custom' });
            setCreating(false);
            toast.show('Drill saved');
            nav(`/drills/${created.id}`);
          }}
        />
      )}
      {toast.el}
    </div>
  );
}
