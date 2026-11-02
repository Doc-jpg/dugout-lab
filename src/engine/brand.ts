/**
 * Branding helpers: colors from a logo, contrast, and the CSS the app applies for a team.
 * Pure functions over pixel data so they can be tested without a browser.
 */
import type { Brand, Team, Settings } from './types';

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or near-black text, whichever reads on this background. */
export function inkFor(bg: string): string {
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#111111') ? '#ffffff' : '#111111';
}

/** Darken or lighten a color so it works as a button background (enough contrast with white or black text). */
export function usableAsAccent(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#1d4e89';
  let [r, g, b] = rgb;
  let tries = 0;
  while (contrastRatio(rgbToHex(r, g, b), '#ffffff') < 3 && contrastRatio(rgbToHex(r, g, b), '#111111') < 4.5 && tries < 12) {
    // Too washed out: darken
    r *= 0.85; g *= 0.85; b *= 0.85;
    tries += 1;
  }
  return rgbToHex(r, g, b);
}

export interface PaletteColor {
  hex: string;
  share: number;
}

/**
 * Dominant colors from RGBA pixel data. Skips transparent, near-white and near-gray pixels,
 * groups the rest into coarse buckets and returns the biggest, most saturated first on ties.
 */
export function paletteFromPixels(data: Uint8ClampedArray | number[], max = 6): PaletteColor[] {
  const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (mx > 235 && sat < 0.12) continue; // white-ish background
    if (sat < 0.15 && mx > 60 && mx < 200) continue; // grays
    total += 1;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const cur = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1; cur.r += r; cur.g += g; cur.b += b;
    counts.set(key, cur);
  }
  if (!total) return [];
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((c) => ({ hex: rgbToHex(c.r / c.n, c.g / c.n, c.b / c.n), share: c.n / total }))
    .filter((c) => c.share >= 0.02);
}

/** Two colors from a palette: the most used as primary, the most different remaining one as accent. */
export function suggestPair(palette: PaletteColor[]): { primary?: string; accent?: string } {
  if (!palette.length) return {};
  const primary = palette[0].hex;
  const p = hexToRgb(primary)!;
  let best: PaletteColor | undefined;
  let bestD = 0;
  for (const c of palette.slice(1)) {
    const q = hexToRgb(c.hex)!;
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (d > bestD) { bestD = d; best = c; }
  }
  return { primary, accent: best?.hex };
}

/** The name shown in the app and on parent pages. */
export function programName(team?: Team, settings?: Settings): string {
  return team?.brand?.programName?.trim() || team?.name || settings?.appName || 'Dugout Lab';
}

/** CSS custom properties for the current team. Empty when the team has no brand colors. */
export function brandCss(brand?: Brand): Record<string, string> {
  const out: Record<string, string> = {};
  if (brand?.primary && hexToRgb(brand.primary)) {
    const accent = usableAsAccent(brand.primary);
    out['--accent'] = accent;
    out['--accent-ink'] = inkFor(accent);
  }
  if (brand?.accent && hexToRgb(brand.accent)) out['--brand-accent'] = brand.accent;
  return out;
}
