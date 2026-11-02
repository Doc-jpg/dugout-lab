import React, { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { updateTeam } from '../../db/db';
import { paletteFromPixels, suggestPair, rgbToHex, hexToRgb, usableAsAccent, inkFor, type PaletteColor } from '../../engine/brand';
import type { Team, Brand, CoachContact } from '../../engine/types';

const MAX_LOGO_PX = 320;

/** Resize an uploaded image to a small PNG data URL so it fits in the database and on a phone. */
async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_LOGO_PX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/png');
    if (out.length > 200000) out = c.toDataURL('image/jpeg', 0.85);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Program name, tagline, logo, colors (eyedropper and auto palette), coaches, footer. */
export function BrandSheet({ team, onClose, onSaved }: { team: Team; onClose: () => void; onSaved: () => void }) {
  const [b, setB] = useState<Brand>({ coaches: [], ...(team.brand ?? {}) });
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [pick, setPick] = useState<'primary' | 'accent'>('primary');
  const [hover, setHover] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const set = (k: keyof Brand, v: any) => setB({ ...b, [k]: v });

  // Draw the logo on the eyedropper canvas and pull a palette from it.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !b.logo) return;
    const img = new Image();
    img.onload = () => {
      const w = Math.min(300, img.width);
      const h = Math.round((img.height * w) / img.width);
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const data = ctx.getImageData(0, 0, w, h).data;
        setPalette(paletteFromPixels(data, 6));
      } catch {
        setPalette([]);
      }
    };
    img.src = b.logo;
  }, [b.logo]);

  const sampleAt = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, commit: boolean) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const pt = 'touches' in e ? e.touches[0] ?? (e as any).changedTouches?.[0] : e;
    if (!pt) return;
    const x = Math.floor(((pt.clientX - rect.left) / rect.width) * c.width);
    const y = Math.floor(((pt.clientY - rect.top) / rect.height) * c.height);
    const d = c.getContext('2d')!.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
    if (d[3] < 128) return;
    const hex = rgbToHex(d[0], d[1], d[2]);
    setHover(hex);
    if (commit) set(pick, hex);
  };

  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const logo = await fileToLogo(f);
        setB({ ...b, logo });
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? 'Could not read that image');
      }
    };
    input.click();
  };
  const autoPick = () => {
    const pair = suggestPair(palette);
    setB({ ...b, primary: pair.primary ?? b.primary, accent: pair.accent ?? b.accent });
  };
  const coaches = b.coaches ?? [];
  const setCoach = (i: number, k: keyof CoachContact, v: string) => set('coaches', coaches.map((c, j) => (j === i ? { ...c, [k]: v || undefined } : c)));
  const primaryUsable = b.primary && hexToRgb(b.primary) ? usableAsAccent(b.primary) : undefined;

  return (
    <Sheet title="Branding" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={async () => { await updateTeam(team.id, { brand: { ...b, coaches: coaches.filter((c) => c.name?.trim()) } }); onSaved(); }}>Save</button></>}>
      <p className="muted small">What the program looks like in the app and on everything parents see. Per team, so one phone can hold several programs.</p>
      <div className="field"><label>Program name</label><input className="input" value={b.programName ?? ''} onChange={(e) => set('programName', e.target.value)} placeholder={team.name} /></div>
      <div className="field"><label>Tagline (optional)</label><input className="input" value={b.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="Every kid gets better here" /></div>

      <div className="field"><label>Logo</label>
        <div className="row wrap" style={{ alignItems: 'center' }}>
          {b.logo && <img src={b.logo} alt="Logo" style={{ height: 56, width: 56, objectFit: 'contain', background: '#fff', borderRadius: 8, border: '1px solid var(--line)' }} />}
          <button className="btn sm" onClick={upload}>{b.logo ? 'Replace logo' : 'Upload logo'}</button>
          {b.logo && <button className="btn sm ghost" onClick={() => { setB({ ...b, logo: undefined }); setPalette([]); }}>Remove</button>}
        </div>
        {err && <div className="small" style={{ color: 'var(--danger)' }}>{err}</div>}
        <div className="muted small">PNG or JPEG. Resized to {MAX_LOGO_PX} px and stored on this phone.</div>
      </div>

      {b.logo && (
        <div className="field"><label>Eyedropper: tap the logo to pick the {pick} color</label>
          <div className="chips" style={{ marginBottom: 6 }}>
            <button className={`chip sm ${pick === 'primary' ? 'on' : ''}`} onClick={() => setPick('primary')}>Picking primary</button>
            <button className={`chip sm ${pick === 'accent' ? 'on' : ''}`} onClick={() => setPick('accent')}>Picking accent</button>
            {palette.length > 1 && <button className="chip sm" onClick={autoPick}>Auto-pick from logo</button>}
          </div>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', maxWidth: 300, background: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px', borderRadius: 8, border: '1px solid var(--line)', touchAction: 'none', cursor: 'crosshair' }}
            onMouseMove={(e) => sampleAt(e, false)}
            onClick={(e) => sampleAt(e, true)}
            onTouchStart={(e) => sampleAt(e, false)}
            onTouchMove={(e) => sampleAt(e, false)}
            onTouchEnd={(e) => sampleAt(e, true)}
          />
          {hover && <div className="small" style={{ marginTop: 4 }}><span style={{ display: 'inline-block', width: 14, height: 14, background: hover, borderRadius: 3, verticalAlign: 'middle', border: '1px solid var(--line)' }} /> {hover}</div>}
          {palette.length > 0 && (
            <div className="row wrap" style={{ marginTop: 6 }}>
              {palette.map((c) => <button key={c.hex} className="btn sm" style={{ background: c.hex, color: inkFor(c.hex), borderColor: c.hex }} onClick={() => set(pick, c.hex)} title={`${Math.round(c.share * 100)}% of the logo`}>{c.hex}</button>)}
            </div>
          )}
        </div>
      )}

      <div className="inline-fields">
        <div className="field"><label>Primary</label><div className="row"><input className="input" style={{ width: 110 }} value={b.primary ?? ''} onChange={(e) => set('primary', e.target.value)} placeholder="#1d4e89" /><input type="color" value={b.primary && hexToRgb(b.primary) ? b.primary : '#1d4e89'} onChange={(e) => set('primary', e.target.value)} aria-label="Primary color" /></div></div>
        <div className="field"><label>Accent</label><div className="row"><input className="input" style={{ width: 110 }} value={b.accent ?? ''} onChange={(e) => set('accent', e.target.value)} placeholder="#f0963c" /><input type="color" value={b.accent && hexToRgb(b.accent) ? b.accent : '#f0963c'} onChange={(e) => set('accent', e.target.value)} aria-label="Accent color" /></div></div>
      </div>
      {primaryUsable && (
        <div className="small" style={{ marginBottom: 10 }}>
          Preview: <span style={{ background: primaryUsable, color: inkFor(primaryUsable), padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>Start practice</span>
          {b.accent && hexToRgb(b.accent) && <span style={{ marginLeft: 8, borderLeft: `4px solid ${b.accent}`, paddingLeft: 6 }}>accent</span>}
          {primaryUsable !== b.primary?.toLowerCase() && <div className="muted small">Buttons use a darker shade of your primary so the text stays readable.</div>}
        </div>
      )}

      <div className="field"><label>Coaches (shown on parent pages)</label>
        {coaches.map((c, i) => (
          <div key={i} className="card" style={{ padding: 8, marginBottom: 6 }}>
            <div className="inline-fields">
              <div className="field" style={{ marginBottom: 6 }}><label>Name</label><input className="input" value={c.name} onChange={(e) => setCoach(i, 'name', e.target.value)} /></div>
              <div className="field" style={{ marginBottom: 6 }}><label>Role</label><input className="input" value={c.role ?? ''} onChange={(e) => setCoach(i, 'role', e.target.value)} placeholder="Head coach" /></div>
            </div>
            <div className="inline-fields">
              <div className="field" style={{ marginBottom: 6 }}><label>Mobile</label><input className="input" type="tel" value={c.phone ?? ''} onChange={(e) => setCoach(i, 'phone', e.target.value)} /></div>
              <div className="field" style={{ marginBottom: 6 }}><label>Email</label><input className="input" type="email" value={c.email ?? ''} onChange={(e) => setCoach(i, 'email', e.target.value)} /></div>
            </div>
            <button className="btn sm ghost" onClick={() => set('coaches', coaches.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button className="btn sm" onClick={() => set('coaches', [...coaches, { name: '' }])}>+ Coach</button>
      </div>
      <div className="field"><label>Footer line on parent pages (optional)</label><input className="input" value={b.footer ?? ''} onChange={(e) => set('footer', e.target.value)} placeholder="performancebaseball.example.com" /></div>
    </Sheet>
  );
}
