/**
 * Branding helpers: colors from a logo, contrast, and the CSS the app applies for a team.
 * Pure functions over pixel data so they can be tested without a browser.
 */
import { DEFAULT_SETTINGS, type Brand, type Team, type Settings } from './types';
import { HOUSE_LOGO, HOUSE_WORDMARK, HOUSE_WORDMARK_RATIO } from '../data/house-logo';

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

/**
 * The house brand: the look every team gets until it sets its own. This copy of the app is the
 * Warriors' (Deren, 2026-11-23: "just as a default ... we're gonna try this for a full season before
 * we ever consider it going outside of just my hands"). To hand the app to another program, change
 * this one object, or empty it to go back to a plain app.
 *
 * The logo is the program's W mark. The code is public, so this publishes it there; Deren was asked
 * and said yes (2026-11-23).
 */
export const HOUSE_BRAND: Brand = {
  programName: 'Warriors Baseball',
  logo: HOUSE_LOGO,
  tagline: 'Stewards Sports Guthrie | Baseball Development',
  footer: 'Warriors \u2022 Stewards Sports Guthrie',
  primary: '#0D2241',
  accent: '#286AA5'
};

/** A team has its own look once it has set a name, a color or a logo for itself. */
export function hasOwnBrand(team?: Team): boolean {
  const b = team?.brand;
  return Boolean(b && (b.programName?.trim() || b.primary || b.logo));
}

/**
 * The brand to show for a team. A team with its own look keeps exactly what it set (the demo team
 * stays the Dirtbags). A team with none gets the house brand, plus any coaches it has listed.
 */
export function brandFor(team?: Team): Brand {
  if (hasOwnBrand(team)) return team!.brand!;
  if (!HOUSE_BRAND.programName && !HOUSE_BRAND.primary) return team?.brand ?? {};
  return { ...HOUSE_BRAND, ...(team?.brand?.tagline ? { tagline: team.brand.tagline } : {}), ...(team?.brand?.footer ? { footer: team.brand.footer } : {}), coaches: team?.brand?.coaches ?? [] };
}

/**
 * The wide wordmark for the top of a printed report, when there is one. Only the house brand has
 * one. A team that typed the house name itself (Deren entering "Warriors Baseball" by hand) still
 * gets it; any other team gets none and its report leads with its logo and name instead.
 */
export function wordmarkFor(team?: Team): { src: string; ratio: number } | undefined {
  if (!team || !HOUSE_BRAND.programName) return undefined;
  const own = team.brand?.programName?.trim().toLowerCase();
  if (hasOwnBrand(team) && own !== HOUSE_BRAND.programName.toLowerCase()) return undefined;
  return { src: HOUSE_WORDMARK, ratio: HOUSE_WORDMARK_RATIO };
}

/** Mix a color toward white: 0 is the color, 1 is white. For table stripes and soft panels. */
export function tint(hex: string, toWhite: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#f3f6fa';
  const [r, g, bl] = rgb.map((v) => Math.round(v + (255 - v) * toWhite));
  return rgbToHex(r, g, bl);
}

/** The name shown in the app and on parent pages. */
export function programName(team?: Team, settings?: Settings): string {
  if (team) return brandFor(team).programName?.trim() || team.name || settings?.appName || 'Dugout Lab';
  // Before there is any team: a name somebody typed for the app wins, then the house name, so the
  // first screen does not show the house logo under a different name.
  const typed = settings?.appName && settings.appName !== DEFAULT_SETTINGS.appName ? settings.appName : undefined;
  return typed || HOUSE_BRAND.programName?.trim() || settings?.appName || 'Dugout Lab';
}

/** The app's own dark-mode page color. A brand color has to stay readable on it. */
export const DARK_BG = '#0e1626';

/** Mix a color toward white until it reads against a background (links, the active tab, button edges). */
export function lightenToContrast(hex: string, bg: string, min = 4.5): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb;
  for (let i = 0; i < 20 && contrastRatio(rgbToHex(r, g, b), bg) < min; i++) {
    r += (255 - r) * 0.1; g += (255 - g) * 0.1; b += (255 - b) * 0.1;
  }
  return rgbToHex(r, g, b);
}

/**
 * CSS custom properties for the current team. Empty when the team has no brand colors.
 * In dark mode a dark primary (navy, black, maroon) would vanish into the page, so the app uses the
 * brand's lighter color instead, lightened as far as it needs to be read.
 */
export function brandCss(brand?: Brand, dark = false): Record<string, string> {
  const out: Record<string, string> = {};
  if (brand?.primary && hexToRgb(brand.primary)) {
    let accent = usableAsAccent(brand.primary);
    if (dark && contrastRatio(accent, DARK_BG) < 4.5) {
      const second = brand.accent && hexToRgb(brand.accent) ? brand.accent : undefined;
      const base = second && contrastRatio(second, DARK_BG) > contrastRatio(accent, DARK_BG) ? second : accent;
      accent = lightenToContrast(base, DARK_BG, 4.5);
    }
    out['--accent'] = accent;
    out['--accent-ink'] = inkFor(accent);
  }
  if (brand?.accent && hexToRgb(brand.accent)) out['--brand-accent'] = brand.accent;
  return out;
}
