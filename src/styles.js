export const PALETTE_OPTIONS = Object.freeze([
  { id: 'paper', label: '素白绯印' },
  { id: 'ink', label: '青岚素雅' },
  { id: 'warm', label: '暖砂微光' },
  { id: 'sakura', label: '淡樱初晴' },
  { id: 'glass-dark', label: '深色夜间' },
  { id: 'host', label: '跟随酒馆' },
]);

export const COLOR_MODE_OPTIONS = Object.freeze([
  { id: 'auto', label: '跟随宿主' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
]);

const VALID_PALETTE_IDS = new Set(PALETTE_OPTIONS.map((p) => p.id));
const VALID_COLOR_MODE_IDS = new Set(COLOR_MODE_OPTIONS.map((m) => m.id));

const HOST_INLINE_VAR_KEYS = [
  '--ups-bg',
  '--ups-bg-elevated',
  '--ups-surface',
  '--ups-surface-strong',
  '--ups-surface-hover',
  '--ups-input-bg',
  '--ups-border',
  '--ups-border-strong',
  '--ups-fg',
  '--ups-fg-muted',
  '--ups-accent',
  '--ups-accent-hover',
  '--ups-accent-fg',
  '--ups-accent-soft',
  '--ups-track-off',
  '--ups-track-on',
  '--ups-thumb',
  '--modal-blur',
];

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function parseRgbChannel(token) {
  const s = String(token ?? '').trim();
  const val = parseFloat(s);
  if (!Number.isFinite(val)) return NaN;
  return s.endsWith('%') ? (val / 100) * 255 : val;
}

function clampAlpha(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(0, Math.min(1, num));
}

export function parseColorRgb(colorStr) {
  const raw = String(colorStr ?? '').trim();
  if (!raw || raw === 'transparent') return null;

  const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const fnMatch = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(raw);
  if (!fnMatch) return null;
  const body = fnMatch[1].trim();

  if (body.includes(',')) {
    const parts = body.split(',').map((p) => p.trim());
    if (parts.length < 3 || parts.length > 4) return null;
    const r = parseRgbChannel(parts[0]);
    const g = parseRgbChannel(parts[1]);
    const b = parseRgbChannel(parts[2]);
    let a = 1;
    if (parts[3] !== undefined) {
      a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    }
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b), a: clampAlpha(a) };
  }

  const slashParts = body.split('/').map((p) => p.trim());
  const rgbParts = slashParts[0].split(/\s+/).filter(Boolean);
  if (rgbParts.length !== 3 || slashParts.length > 2) return null;
  const r = parseRgbChannel(rgbParts[0]);
  const g = parseRgbChannel(rgbParts[1]);
  const b = parseRgbChannel(rgbParts[2]);
  let a = 1;
  if (slashParts[1] !== undefined) {
    a = slashParts[1].endsWith('%') ? parseFloat(slashParts[1]) / 100 : parseFloat(slashParts[1]);
  }
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b), a: clampAlpha(a) };
}

export function toOpaqueColor(colorStr, fallbackHex = '#191a1d') {
  const base = parseColorRgb(fallbackHex) || { r: 25, g: 26, b: 29, a: 1 };
  const fg = parseColorRgb(colorStr);
  if (!fg) {
    return `rgb(${base.r}, ${base.g}, ${base.b})`;
  }
  const a = clampAlpha(fg.a);
  if (a >= 0.999) {
    return `rgb(${fg.r}, ${fg.g}, ${fg.b})`;
  }
  const r = clampChannel(fg.r * a + base.r * (1 - a));
  const g = clampChannel(fg.g * a + base.g * (1 - a));
  const b = clampChannel(fg.b * a + base.b * (1 - a));
  return `rgb(${r}, ${g}, ${b})`;
}

export function mixOpaqueColors(colorA, colorB, weightA = 0.5) {
  const a = parseColorRgb(colorA) || { r: 245, g: 245, b: 243, a: 1 };
  const b = parseColorRgb(colorB) || { r: 25, g: 26, b: 29, a: 1 };
  const w = Math.max(0, Math.min(1, Number(weightA) || 0));
  const r = clampChannel(a.r * w + b.r * (1 - w));
  const g = clampChannel(a.g * w + b.g * (1 - w));
  const bl = clampChannel(a.b * w + b.b * (1 - w));
  return `rgb(${r}, ${g}, ${bl})`;
}

function luminanceOf(rgb) {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

export function inferThemeFromTextColor(fgColor, bgColor = '') {
  const bg = parseColorRgb(bgColor);
  if (bg && bg.a >= 0.35) {
    return luminanceOf(bg) >= 150 ? 'light' : 'dark';
  }
  const fg = parseColorRgb(fgColor);
  if (fg) {
    return luminanceOf(fg) < 140 ? 'light' : 'dark';
  }
  return 'dark';
}

export function readHostThemeVars(
  doc = typeof document !== 'undefined' ? document : null,
  win = typeof window !== 'undefined' ? window : null
) {
  const empty = {
    bodyColor: '',
    blurBg: '',
    mainBg: '',
    borderColor: '',
    accentColor: '',
    prefersDark: false,
  };
  if (!doc || !win || typeof win.getComputedStyle !== 'function') {
    return empty;
  }
  const root = doc.documentElement || doc.body;
  if (!root) return empty;
  const rootStyle = win.getComputedStyle(root);
  const bodyStyle = doc.body && doc.body !== root ? win.getComputedStyle(doc.body) : rootStyle;
  const readVar = (name) => {
    const v1 = rootStyle?.getPropertyValue?.(name)?.trim() || '';
    if (v1) return v1;
    return bodyStyle?.getPropertyValue?.(name)?.trim() || '';
  };
  return {
    bodyColor: readVar('--SmartThemeBodyColor') || bodyStyle?.color || '',
    blurBg: readVar('--SmartThemeBlurTintColor') || '',
    mainBg: readVar('--color-bg-main') || bodyStyle?.backgroundColor || '',
    borderColor: readVar('--SmartThemeBorderColor') || readVar('--color-border-main') || '',
    accentColor: readVar('--SmartThemeQuoteColor') || readVar('--SmartThemeEmColor') || '',
    prefersDark: Boolean(win.matchMedia?.('(prefers-color-scheme: dark)')?.matches),
  };
}

export function resolveThemeTokens({ palette = 'paper', colorMode = 'auto', hostVars = {} } = {}) {
  const safePalette = VALID_PALETTE_IDS.has(palette) ? palette : 'paper';
  const safeColorMode = VALID_COLOR_MODE_IDS.has(colorMode) ? colorMode : 'auto';

  let effectiveMode = safeColorMode;
  if (safePalette === 'glass-dark') {
    effectiveMode = 'dark';
  } else if (safeColorMode === 'auto') {
    if (hostVars && (hostVars.bodyColor || hostVars.blurBg || hostVars.mainBg)) {
      effectiveMode = inferThemeFromTextColor(hostVars.bodyColor, hostVars.blurBg || hostVars.mainBg);
    } else {
      effectiveMode = hostVars?.prefersDark ? 'dark' : 'light';
    }
  }

  const vars = { '--modal-blur': '0px' };
  if (safePalette === 'host') {
    const isLight = effectiveMode === 'light';
    const fallbackBg = isLight ? '#f5f4f0' : '#191a1d';
    const fallbackFg = isLight ? '#1f2124' : '#ecece8';
    const baseBg = toOpaqueColor(hostVars?.blurBg || hostVars?.mainBg || fallbackBg, fallbackBg);
    const fg = toOpaqueColor(hostVars?.bodyColor || fallbackFg, fallbackFg);
    const borderBase = hostVars?.borderColor
      ? toOpaqueColor(hostVars.borderColor, baseBg)
      : mixOpaqueColors(fg, baseBg, isLight ? 0.18 : 0.25);
    const accentBase = hostVars?.accentColor
      ? toOpaqueColor(hostVars.accentColor, isLight ? '#9a1e2a' : '#8fa2be')
      : isLight
        ? '#9a1e2a'
        : '#8fa2be';
    const accentRgb = parseColorRgb(accentBase) || { r: 154, g: 30, b: 42, a: 1 };
    const accentFg = luminanceOf(accentRgb) >= 155 ? '#181a1e' : '#ffffff';

    vars['--ups-bg'] = baseBg;
    vars['--ups-bg-elevated'] = mixOpaqueColors(isLight ? '#e5e2da' : '#24272e', baseBg, 0.62);
    vars['--ups-surface'] = mixOpaqueColors(isLight ? '#ffffff' : '#2d3139', baseBg, isLight ? 0.9 : 0.56);
    vars['--ups-surface-strong'] = mixOpaqueColors(fg, baseBg, isLight ? 0.08 : 0.16);
    vars['--ups-surface-hover'] = mixOpaqueColors(fg, baseBg, isLight ? 0.1 : 0.2);
    vars['--ups-input-bg'] = mixOpaqueColors(isLight ? '#f2f1ec' : '#1e2026', baseBg, 0.75);
    vars['--ups-border'] = mixOpaqueColors(borderBase, baseBg, 0.78);
    vars['--ups-border-strong'] = mixOpaqueColors(fg, baseBg, isLight ? 0.26 : 0.36);
    vars['--ups-fg'] = fg;
    vars['--ups-fg-muted'] = mixOpaqueColors(fg, baseBg, 0.66);
    vars['--ups-accent'] = accentBase;
    vars['--ups-accent-hover'] = mixOpaqueColors(fg, accentBase, isLight ? 0.16 : 0.18);
    vars['--ups-accent-fg'] = accentFg;
    vars['--ups-accent-soft'] = mixOpaqueColors(accentBase, baseBg, 0.18);
    vars['--ups-track-off'] = mixOpaqueColors(fg, baseBg, 0.28);
    vars['--ups-track-on'] = accentBase;
    vars['--ups-thumb'] = '#ffffff';
  }

  return {
    palette: safePalette,
    colorMode: safeColorMode,
    mode: effectiveMode,
    vars,
  };
}

export function applyThemeToRoot(el, { palette = 'paper', colorMode = 'auto' } = {}, hostVars = null) {
  if (!el) return null;
  const resolvedHost = hostVars || readHostThemeVars(el.ownerDocument, el.ownerDocument?.defaultView);
  const resolved = resolveThemeTokens({ palette, colorMode, hostVars: resolvedHost });

  if (el.dataset) {
    el.dataset.upsThemePalette = resolved.palette;
    el.dataset.upsColorMode = resolved.mode;
  } else if (typeof el.setAttribute === 'function') {
    el.setAttribute('data-ups-theme-palette', resolved.palette);
    el.setAttribute('data-ups-color-mode', resolved.mode);
  }

  if (el.classList) {
    el.classList.toggle('ups-theme-light', resolved.mode === 'light');
    el.classList.toggle('ups-theme-dark', resolved.mode === 'dark');
  }

  if (el.style && typeof el.style.removeProperty === 'function') {
    for (const key of HOST_INLINE_VAR_KEYS) {
      el.style.removeProperty(key);
    }
    for (const [key, val] of Object.entries(resolved.vars)) {
      el.style.setProperty(key, val);
    }
  }
  return resolved;
}

export const SHADOW_CSS = String.raw`
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: inherit;
  -webkit-font-smoothing: antialiased;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

/* Solid Opaque Palettes with Distinct 4-Tier Module Hierarchy */
.ups-theme-root,
.ups-theme-root.ups-theme-light[data-ups-theme-palette="paper"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #f6f5f2;
  --ups-bg-elevated: #e8e5de;
  --ups-surface: #ffffff;
  --ups-surface-strong: #eae7e0;
  --ups-surface-hover: #f3f1ec;
  --ups-input-bg: #f2f1ec;
  --ups-border: #dfddd6;
  --ups-border-strong: #c4c1b8;
  --ups-fg: #1f2124;
  --ups-fg-muted: #5c6066;
  --ups-accent: #9a1e2a;
  --ups-accent-hover: #7f1722;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #fbeded;
  --ups-ok: #266b48;
  --ups-ok-soft: #e1f0e8;
  --ups-warn: #8c5816;
  --ups-warn-soft: #faeedb;
  --ups-danger: #9e3634;
  --ups-danger-soft: #fae3e3;
  --ups-track-off: #c2bfb7;
  --ups-track-on: #9a1e2a;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 6px rgba(24, 24, 26, 0.05);
  --ups-shadow: 0 16px 42px rgba(18, 22, 28, 0.22);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="paper"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #191b20;
  --ups-bg-elevated: #21242b;
  --ups-surface: #282c34;
  --ups-surface-strong: #333843;
  --ups-surface-hover: #363c48;
  --ups-input-bg: #1e2128;
  --ups-border: #3d4350;
  --ups-border-strong: #565e70;
  --ups-fg: #ecebe7;
  --ups-fg-muted: #a6abb5;
  --ups-accent: #7f99b8;
  --ups-accent-hover: #96afd0;
  --ups-accent-fg: #12151a;
  --ups-accent-soft: #2a3442;
  --ups-ok: #6db38b;
  --ups-ok-soft: #21362a;
  --ups-warn: #d4a459;
  --ups-warn-soft: #3a2f1e;
  --ups-danger: #d67a77;
  --ups-danger-soft: #3d2324;
  --ups-track-off: #4c5260;
  --ups-track-on: #7f99b8;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
  --ups-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="ink"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #e1ebed;
  --ups-bg-elevated: #d4e1e4;
  --ups-surface: #ffffff;
  --ups-surface-strong: #d4e2e6;
  --ups-surface-hover: #edf3f5;
  --ups-input-bg: #f3f7f8;
  --ups-border: #b8ccd1;
  --ups-border-strong: #8faab1;
  --ups-fg: #19262a;
  --ups-fg-muted: #4c6066;
  --ups-accent: #35656f;
  --ups-accent-hover: #285058;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #d9e8eb;
  --ups-ok: #296b52;
  --ups-ok-soft: #dfefe8;
  --ups-warn: #8a5e1f;
  --ups-warn-soft: #f7ecda;
  --ups-danger: #a03e3e;
  --ups-danger-soft: #f8e2e2;
  --ups-track-off: #a8bec4;
  --ups-track-on: #35656f;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 6px rgba(18, 36, 40, 0.07);
  --ups-shadow: 0 16px 40px rgba(18, 34, 38, 0.22);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="ink"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #161f22;
  --ups-bg-elevated: #1d282c;
  --ups-surface: #253338;
  --ups-surface-strong: #2f4046;
  --ups-surface-hover: #34474d;
  --ups-input-bg: #1a2529;
  --ups-border: #3a4e54;
  --ups-border-strong: #526b73;
  --ups-fg: #e6eff1;
  --ups-fg-muted: #9eb3b8;
  --ups-accent: #73a8b2;
  --ups-accent-hover: #8abbc4;
  --ups-accent-fg: #10181b;
  --ups-accent-soft: #23393e;
  --ups-ok: #6db392;
  --ups-ok-soft: #1f352c;
  --ups-warn: #d1a35d;
  --ups-warn-soft: #362d1e;
  --ups-danger: #d47b7b;
  --ups-danger-soft: #3a2325;
  --ups-track-off: #485b61;
  --ups-track-on: #73a8b2;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="warm"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #eae2d6;
  --ups-bg-elevated: #dfd5c6;
  --ups-surface: #fffdf9;
  --ups-surface-strong: #e2d6c5;
  --ups-surface-hover: #f4ede3;
  --ups-input-bg: #f8f3ec;
  --ups-border: #cbbba6;
  --ups-border-strong: #ab9880;
  --ups-fg: #29221b;
  --ups-fg-muted: #66594c;
  --ups-accent: #78573e;
  --ups-accent-hover: #60442f;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #ece0d3;
  --ups-ok: #356c4a;
  --ups-ok-soft: #e2efe6;
  --ups-warn: #8c5916;
  --ups-warn-soft: #f7ecd8;
  --ups-danger: #a14038;
  --ups-danger-soft: #f9e2e0;
  --ups-track-off: #bfaf9b;
  --ups-track-on: #78573e;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 6px rgba(42, 30, 16, 0.07);
  --ups-shadow: 0 16px 40px rgba(40, 28, 16, 0.22);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="warm"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #1e1916;
  --ups-bg-elevated: #27211c;
  --ups-surface: #312923;
  --ups-surface-strong: #3d332c;
  --ups-surface-hover: #453a32;
  --ups-input-bg: #231d19;
  --ups-border: #4d4138;
  --ups-border-strong: #69594d;
  --ups-fg: #f0e8df;
  --ups-fg-muted: #b6a799;
  --ups-accent: #c09574;
  --ups-accent-hover: #d1a98a;
  --ups-accent-fg: #1d1712;
  --ups-accent-soft: #3c3026;
  --ups-ok: #72b389;
  --ups-ok-soft: #233429;
  --ups-warn: #d4a359;
  --ups-warn-soft: #382c1d;
  --ups-danger: #d67c74;
  --ups-danger-soft: #3c2322;
  --ups-track-off: #5c4e43;
  --ups-track-on: #c09574;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="sakura"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #efe5e9;
  --ups-bg-elevated: #e5d8dd;
  --ups-surface: #ffffff;
  --ups-surface-strong: #e6d6dc;
  --ups-surface-hover: #f6eef1;
  --ups-input-bg: #faf4f6;
  --ups-border: #d1bcc4;
  --ups-border-strong: #b495a0;
  --ups-fg: #291f23;
  --ups-fg-muted: #68555c;
  --ups-accent: #8a5164;
  --ups-accent-hover: #714051;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #f0e1e6;
  --ups-ok: #356c52;
  --ups-ok-soft: #e2efe8;
  --ups-warn: #8c5d1f;
  --ups-warn-soft: #f7ecdc;
  --ups-danger: #a43b45;
  --ups-danger-soft: #f9e1e3;
  --ups-track-off: #c3aeb6;
  --ups-track-on: #8a5164;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 6px rgba(45, 22, 32, 0.07);
  --ups-shadow: 0 16px 40px rgba(45, 22, 32, 0.21);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="sakura"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #1f191c;
  --ups-bg-elevated: #282024;
  --ups-surface: #33282e;
  --ups-surface-strong: #40323a;
  --ups-surface-hover: #483941;
  --ups-input-bg: #241c21;
  --ups-border: #503f49;
  --ups-border-strong: #6d5663;
  --ups-fg: #f2e8ec;
  --ups-fg-muted: #b9a4ae;
  --ups-accent: #c58ca0;
  --ups-accent-hover: #d4a1b3;
  --ups-accent-fg: #1d1519;
  --ups-accent-soft: #3d2c34;
  --ups-ok: #72b392;
  --ups-ok-soft: #22342c;
  --ups-warn: #d4a55d;
  --ups-warn-soft: #382e1e;
  --ups-danger: #d97a82;
  --ups-danger-soft: #3e2226;
  --ups-track-off: #5f4b56;
  --ups-track-on: #c58ca0;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
}

/* glass-dark is strictly opaque solid #191a1d */
.ups-theme-root[data-ups-theme-palette="glass-dark"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #191a1d;
  --ups-bg-elevated: #202227;
  --ups-surface: #272a31;
  --ups-surface-strong: #31353e;
  --ups-surface-hover: #363b45;
  --ups-input-bg: #1d1f24;
  --ups-border: #3c414b;
  --ups-border-strong: #535a68;
  --ups-fg: #ecece8;
  --ups-fg-muted: #a3a7b0;
  --ups-accent: #7f97b4;
  --ups-accent-hover: #96adc8;
  --ups-accent-fg: #14161a;
  --ups-accent-soft: #29323d;
  --ups-ok: #6db38b;
  --ups-ok-soft: #203329;
  --ups-warn: #cfa15a;
  --ups-warn-soft: #362c1e;
  --ups-danger: #d47b78;
  --ups-danger-soft: #392224;
  --ups-track-off: #4a4f5a;
  --ups-track-on: #7f97b4;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.26);
  --ups-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="host"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #f5f4f0;
  --ups-bg-elevated: #e7e4dd;
  --ups-surface: #ffffff;
  --ups-surface-strong: #e9e7e0;
  --ups-surface-hover: #f3f1ec;
  --ups-input-bg: #f2f1ec;
  --ups-border: #dfddd6;
  --ups-border-strong: #c4c1b8;
  --ups-fg: #1f2124;
  --ups-fg-muted: #5c6066;
  --ups-accent: #9a1e2a;
  --ups-accent-hover: #7f1722;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #fbeded;
  --ups-ok: #2c6d4c;
  --ups-ok-soft: #e2efe8;
  --ups-warn: #8a5b1e;
  --ups-warn-soft: #f6ecdc;
  --ups-danger: #9e3a38;
  --ups-danger-soft: #f8e3e3;
  --ups-track-off: #c2bfb7;
  --ups-track-on: #9a1e2a;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 6px rgba(18, 22, 28, 0.05);
  --ups-shadow: 0 16px 40px rgba(18, 22, 28, 0.22);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="host"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #191a1d;
  --ups-bg-elevated: #212328;
  --ups-surface: #282b32;
  --ups-surface-strong: #32363f;
  --ups-surface-hover: #373c46;
  --ups-input-bg: #1d1f24;
  --ups-border: #3d424c;
  --ups-border-strong: #555b69;
  --ups-fg: #ecece8;
  --ups-fg-muted: #a4a8b1;
  --ups-accent: #7f97b4;
  --ups-accent-hover: #96adc8;
  --ups-accent-fg: #14161a;
  --ups-accent-soft: #29323d;
  --ups-ok: #6db38b;
  --ups-ok-soft: #203329;
  --ups-warn: #cfa15a;
  --ups-warn-soft: #362c1e;
  --ups-danger: #d47b78;
  --ups-danger-soft: #392224;
  --ups-track-off: #4a4f5a;
  --ups-track-on: #7f97b4;
  --ups-thumb: #ffffff;
  --ups-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.26);
  --ups-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
}

/* Outer transparent non-blocking container (margin:auto on modal prevents negative-top overflow on zoom/shrink!) */
.ups-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: transparent;
  pointer-events: none;
  display: flex;
  overflow: hidden;
  padding: 8px;
}

.ups-backdrop.is-minimized {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

.ups-backdrop.is-minimized * {
  pointer-events: none !important;
}

/* Main studio modal window (supports full 100dvh manual resize, strictly bounded inside viewport) */
.ups-modal {
  position: relative;
  margin: auto;
  pointer-events: auto;
  container-type: inline-size;
  container-name: plugin-win;
  width: min(1080px, calc(100vw - 16px));
  height: min(700px, calc(100vh - 16px), calc(100dvh - 16px));
  min-width: min(320px, calc(100vw - 16px));
  min-height: min(260px, calc(100vh - 16px), calc(100dvh - 16px));
  max-width: calc(100vw - 16px);
  max-height: min(calc(100vh - 16px), calc(100dvh - 16px));
  background-color: var(--ups-bg);
  background-image: linear-gradient(var(--ups-bg), var(--ups-bg));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 13px;
  box-shadow: var(--ups-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ups-modal.is-floating {
  position: fixed;
  margin: 0;
  min-width: min(320px, 100vw);
  min-height: min(240px, 100vh);
  max-width: 100vw;
  max-height: min(100vh, 100dvh);
}

.ups-modal.is-mini {
  border-radius: 13px;
}

.ups-modal.is-dragging,
.ups-modal.is-resizing {
  user-select: none;
}

/* 8-Way Invisible Edge + Corner Resize Hit-Zones (Zero visible corner badge/text) */
.ups-rz {
  position: absolute;
  z-index: 22;
  touch-action: none;
  user-select: none;
  background: transparent;
}

.ups-rz-n {
  top: 0;
  left: 12px;
  right: 12px;
  height: 6px;
  cursor: ns-resize;
}

.ups-rz-s {
  bottom: 0;
  left: 12px;
  right: 12px;
  height: 6px;
  cursor: ns-resize;
}

.ups-rz-e {
  right: 0;
  top: 12px;
  bottom: 12px;
  width: 6px;
  cursor: ew-resize;
}

.ups-rz-w {
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 6px;
  cursor: ew-resize;
}

.ups-rz-nw {
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
}

.ups-rz-ne {
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

.ups-rz-sw {
  bottom: 0;
  left: 0;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

.ups-rz-se {
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
}

/* Prominent Top Toast Banner (Eye-catching feedback for warnings/errors/confirmations) */
@keyframes upsToastIn {
  from {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.ups-toast {
  position: absolute;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 28;
  max-width: min(560px, calc(100% - 28px));
  min-height: 34px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--ups-border-strong);
  border-left: 4px solid var(--ups-accent);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  box-shadow: var(--ups-shadow);
  font-size: 12.5px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  animation: upsToastIn 0.16s ease-out;
}

.ups-toast[data-tone="ok"] {
  border-color: var(--ups-ok);
  border-left-width: 4px;
  background-color: var(--ups-ok-soft);
  color: var(--ups-ok);
}

.ups-toast[data-tone="warn"] {
  border-color: var(--ups-warn);
  border-left-width: 4px;
  background-color: var(--ups-warn-soft);
  color: var(--ups-warn);
}

.ups-toast[data-tone="error"] {
  border-color: var(--ups-danger);
  border-left-width: 4px;
  background-color: var(--ups-danger-soft);
  color: var(--ups-danger);
}

/* Constant Topbar (46px) */
.ups-header {
  flex-shrink: 0;
  height: 46px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background-color: var(--ups-bg-elevated);
  border-bottom: 1px solid var(--ups-border);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ups-header-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-title-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ups-accent);
}

.ups-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ups-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.ups-ctx-chip {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--ups-surface);
  color: var(--ups-accent);
  border: 1px solid var(--ups-border);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.ups-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  cursor: default;
  touch-action: manipulation;
}

.ups-palette-select {
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  font-size: 12px;
  max-width: 108px;
  cursor: pointer;
}

.ups-icon-btn {
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  min-width: 28px;
  padding: 0 7px;
  gap: 4px;
  border-radius: 6px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
}

.ups-icon-btn svg,
.ups-btn svg,
.ups-btn-ghost svg,
.ups-btn-sm svg,
.ups-more-btn svg,
.ups-drag-handle svg {
  flex-shrink: 0;
}

.ups-icon-btn:hover {
  background-color: var(--ups-surface-hover);
  border-color: var(--ups-border-strong);
}

.ups-icon-btn.is-active {
  background-color: var(--ups-accent-soft);
  border-color: var(--ups-accent);
  color: var(--ups-accent);
}

/* Constant Tab Bar (42px) */
.ups-tabs {
  flex-shrink: 0;
  height: 42px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--ups-bg-elevated);
  border-bottom: 1px solid var(--ups-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.ups-tabs::-webkit-scrollbar {
  display: none;
}

.ups-tab {
  height: 30px;
  min-height: 30px;
  max-height: 30px;
  padding: 0 13px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ups-fg-muted);
  font-size: 12.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
}

.ups-tab:hover {
  background-color: var(--ups-surface-hover);
  color: var(--ups-fg);
}

.ups-tab.is-active {
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  border-color: var(--ups-border-strong);
  box-shadow: var(--ups-card-shadow);
  font-weight: 600;
}

/* Scrollable Middle Body — scrollbar-gutter: stable prevents mode-switch width bounce! */
.ups-body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ups-body > * {
  flex-shrink: 0;
}

.ups-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* Constrain single-column panels on wide screens so controls never stretch across 1400px */
.ups-tab-panel[data-ups-tab-panel="presets"] > .ups-card,
.ups-tab-panel[data-ups-tab-panel="taste"] > .ups-card,
.ups-tab-panel[data-ups-tab-panel="settings"] > .ups-card {
  width: 100%;
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
}

/* Clean Studio Two-Pane Workbench */
.ups-workbench {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.ups-pane-left,
.ups-pane-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

@container plugin-win (min-width: 720px) {
  .ups-body.is-studio-tab {
    overflow: hidden;
    scrollbar-gutter: auto;
    padding: 12px 14px;
  }

  .ups-tab-panel[data-ups-tab-panel="studio"] {
    flex: 1 1 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .ups-workbench {
    flex: 1 1 0;
    min-height: 0;
    height: 100%;
    display: grid;
    grid-template-columns: minmax(310px, 42%) minmax(0, 58%);
    gap: 12px;
    overflow: hidden;
  }

  .ups-pane-left,
  .ups-pane-right {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    padding-right: 4px;
  }

  .ups-pane-left[hidden],
  .ups-pane-right[hidden] {
    display: flex !important;
  }

  .ups-draft-card {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }

  .ups-draft-card .ups-draft-editor {
    flex: 1 1 280px;
    min-height: 240px;
  }
}

/* Module Cards with High-Clarity Contrast & Left Accent Header */
.ups-card {
  background-color: var(--ups-surface);
  border: 1px solid var(--ups-border);
  border-radius: 10px;
  box-shadow: var(--ups-card-shadow);
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}

.ups-mod-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--ups-border);
  min-width: 0;
}

.ups-mod-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ups-fg);
  padding-left: 8px;
  border-left: 3px solid var(--ups-accent);
  line-height: 1.25;
}

.ups-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ups-fg);
}

.ups-muted {
  font-size: 12px;
  color: var(--ups-fg-muted);
  line-height: 1.45;
}

/* Extracted Persona Points Checklist (Semantic groups, spacious bounded height) */
.ups-points-box {
  border: 1px solid var(--ups-border);
  border-left: 3px solid var(--ups-accent);
  border-radius: 9px;
  background-color: var(--ups-surface);
  box-shadow: var(--ups-card-shadow);
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ups-points-list {
  max-height: 320px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-input-bg);
}

.ups-point-group {
  border-bottom: 1px solid var(--ups-border);
  display: flex;
  flex-direction: column;
}

.ups-point-group:last-child {
  border-bottom: 0;
}

.ups-point-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 9px;
  background-color: var(--ups-bg-elevated);
  border-bottom: 1px solid var(--ups-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--ups-fg);
}

.ups-point-group-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  min-width: 0;
}

.ups-point-group-items {
  display: flex;
  flex-direction: column;
  background-color: var(--ups-surface);
}

.ups-point-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  padding: 5px 10px 5px 22px;
  border-bottom: 1px solid var(--ups-border);
  font-size: 12px;
  line-height: 1.42;
  cursor: pointer;
}

/* Character Card Adaptation & Non-Destructive Worldbook Entry Checklist */
.ups-char-box {
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ups-wb-panel {
  border-top: 1px dashed var(--ups-border);
  padding-top: 7px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-wb-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-wb-list {
  max-height: 210px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-surface);
}

.ups-wb-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--ups-border);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
}

.ups-wb-item:last-child {
  border-bottom: 0;
}

.ups-wb-item:hover {
  background-color: var(--ups-surface-hover);
}

.ups-wb-item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-wb-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.ups-wb-item-title {
  font-weight: 600;
  color: var(--ups-fg);
  overflow-wrap: anywhere;
}

.ups-wb-item-preview {
  font-size: 11.5px;
  color: var(--ups-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Draft Editor Action Toolbar (Undo / Redo / Copy adjacent to draft editor) */
.ups-draft-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 5px 8px;
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-input-bg);
}

.ups-draft-toolbar-hint {
  font-size: 11.5px;
  color: var(--ups-fg-muted);
}

.ups-point-item:last-child {
  border-bottom: 0;
}

.ups-point-item:hover {
  background-color: var(--ups-surface-hover);
}

.ups-point-cat {
  font-size: 11px;
  color: var(--ups-fg-muted);
  padding-right: 6px;
  border-right: 1px solid var(--ups-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ups-point-item > span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Explicit visible thin scrollbars so users always see scrollable lists */
.ups-body::-webkit-scrollbar,
.ups-pane-left::-webkit-scrollbar,
.ups-pane-right::-webkit-scrollbar,
.ups-points-list::-webkit-scrollbar,
.ups-wb-list::-webkit-scrollbar,
.ups-taste-scroll::-webkit-scrollbar,
.ups-diff-box::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.ups-body::-webkit-scrollbar-thumb,
.ups-pane-left::-webkit-scrollbar-thumb,
.ups-pane-right::-webkit-scrollbar-thumb,
.ups-points-list::-webkit-scrollbar-thumb,
.ups-wb-list::-webkit-scrollbar-thumb,
.ups-taste-scroll::-webkit-scrollbar-thumb,
.ups-diff-box::-webkit-scrollbar-thumb {
  background-color: var(--ups-border-strong);
  border-radius: 999px;
}

/* Collapsible Details & Built-in Lexicon Packs */
.ups-advanced-details {
  border-top: 1px dashed var(--ups-border);
  padding-top: 6px;
}

.ups-advanced-details > summary {
  font-size: 12px;
  color: var(--ups-fg-muted);
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}

.ups-advanced-details[open] > summary {
  margin-bottom: 8px;
  color: var(--ups-fg);
  font-weight: 500;
}

.ups-lexicon-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-lexicon-pack {
  border: 1px solid var(--ups-border);
  border-left: 3px solid var(--ups-accent);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  overflow: hidden;
}

.ups-lexicon-pack.is-off {
  opacity: 0.62;
  border-left-color: var(--ups-border-strong);
}

.ups-lexicon-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  user-select: none;
}

.ups-lexicon-head:hover {
  background-color: var(--ups-surface-hover);
}

.ups-lexicon-body {
  padding: 8px 10px 10px;
  border-top: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-lexicon-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ups-lexicon-tag {
  font-size: 11.5px;
  padding: 2px 7px;
  border-radius: 5px;
  background-color: var(--ups-input-bg);
  border: 1px solid var(--ups-border);
  color: var(--ups-fg);
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Bounded Personal Taste Scroll Container (Never stretches page height!) */
.ups-taste-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ups-taste-scroll {
  max-height: 210px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
}

.ups-taste-scroll .ups-entry-title {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ups-btn-pair {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Newly Added Item Highlight Feedback */
@keyframes upsFlashHighlight {
  0% {
    border-color: var(--ups-accent);
    box-shadow: 0 0 0 3px var(--ups-accent-soft);
    background-color: var(--ups-accent-soft);
  }
  100% {
    border-color: var(--ups-border);
    box-shadow: none;
  }
}

.ups-just-added {
  border-color: var(--ups-accent) !important;
  animation: upsFlashHighlight 1.8s ease-out forwards;
}

/* Constant Unified Bottom Footer + Framed Status Capsule */
@keyframes upsStatusPulse {
  0% {
    box-shadow: 0 0 0 3px var(--ups-accent-soft);
    border-color: var(--ups-accent);
  }
  100% {
    box-shadow: none;
  }
}

.ups-footer {
  flex-shrink: 0;
  min-height: 50px;
  padding: 8px 14px;
  background-color: var(--ups-bg-elevated);
  border-top: 1px solid var(--ups-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ups-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-footer-status {
  display: inline-flex;
  align-items: flex-start;
  gap: 7px;
  min-height: 30px;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-surface);
  font-size: 12px;
  color: var(--ups-fg);
  min-width: 0;
  max-width: 100%;
}

.ups-footer-status.is-flashing {
  animation: upsStatusPulse 0.85s ease-out;
}

.ups-status-dot {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border-radius: 50%;
  background-color: var(--ups-accent);
  flex-shrink: 0;
}

.ups-status-text {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.42;
  max-height: 54px;
  overflow-y: auto;
  min-width: 0;
}

.ups-footer-status[data-tone="ok"] {
  border-color: var(--ups-ok);
  background-color: var(--ups-ok-soft);
  color: var(--ups-ok);
  font-weight: 500;
}

.ups-footer-status[data-tone="ok"] .ups-status-dot {
  background-color: var(--ups-ok);
}

.ups-footer-status[data-tone="warn"] {
  border-color: var(--ups-warn);
  background-color: var(--ups-warn-soft);
  color: var(--ups-warn);
  font-weight: 600;
}

.ups-footer-status[data-tone="warn"] .ups-status-dot {
  background-color: var(--ups-warn);
}

.ups-footer-status[data-tone="error"] {
  border-color: var(--ups-danger);
  background-color: var(--ups-danger-soft);
  color: var(--ups-danger);
  font-weight: 600;
}

.ups-footer-status[data-tone="error"] .ups-status-dot {
  background-color: var(--ups-danger);
}

/* Compact Collapsible Chip Trays & Split Template Pills */
.ups-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.ups-tray {
  padding: 7px 9px;
  border-radius: 7px;
  border: 1px dashed var(--ups-border-strong);
  background-color: var(--ups-input-bg);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.ups-tpl-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  border-radius: 5px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  overflow: hidden;
}

.ups-tpl-pill:hover {
  border-color: var(--ups-accent);
}

.ups-tpl-apply {
  height: 100%;
  padding: 0 7px;
  border: 0;
  background: transparent;
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}

.ups-tpl-apply:hover {
  background-color: var(--ups-surface-hover);
  color: var(--ups-accent);
}

.ups-tpl-del {
  height: 100%;
  width: 20px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--ups-border);
  background: transparent;
  color: var(--ups-fg-muted);
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ups-tpl-del:hover {
  background-color: var(--ups-danger-soft);
  color: var(--ups-danger);
}

.ups-footer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Unified 32px Word-Count Editable Combo */
.ups-word-count-combo {
  display: flex;
  align-items: center;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-input-bg);
  overflow: hidden;
}

.ups-word-count-combo:focus-within {
  outline: 2px solid var(--ups-accent-soft);
  border-color: var(--ups-accent);
  background-color: var(--ups-surface);
}

.ups-word-count-combo > .ups-word-count-input {
  border: 0;
  border-radius: 0;
  background: transparent;
  flex: 1 1 auto;
  min-width: 0;
  height: 30px;
  min-height: 30px;
  max-height: 30px;
  padding: 0 8px;
}

.ups-word-count-combo > .ups-word-count-input:focus {
  outline: none;
  background: transparent;
}

.ups-word-count-menu-btn {
  width: 28px;
  height: 30px;
  min-height: 30px;
  max-height: 30px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--ups-border);
  border-radius: 0;
  background-color: var(--ups-surface);
  color: var(--ups-fg-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.ups-word-count-menu-btn:hover {
  background-color: var(--ups-surface-hover);
  color: var(--ups-fg);
}

/* Categorized Capsule Lexicon, Prominent Sections Bar, Split Worldbook Box & Searchable Combobox */
.ups-char-combobox {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ups-char-combo-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.ups-char-combo-btn:hover {
  background-color: var(--ups-surface-hover);
  border-color: var(--ups-accent);
}

.ups-char-combo-label {
  min-width: 0;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ups-char-combo-menu {
  border: 1px solid var(--ups-border-strong);
  border-radius: 8px;
  background-color: var(--ups-surface);
  box-shadow: var(--ups-card-shadow);
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-char-combo-list {
  max-height: 176px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ups-char-combo-opt {
  min-height: 28px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ups-char-combo-opt:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
}

.ups-char-combo-opt.is-selected {
  background-color: var(--ups-accent-soft);
  color: var(--ups-accent);
  font-weight: 600;
}

.ups-link-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ups-accent);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ups-link-btn:hover {
  color: var(--ups-accent-hover);
}

.ups-lexicon-panel,
.ups-sections-panel {
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.ups-lexicon-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--ups-border);
}

.ups-lexicon-tab {
  height: 25px;
  min-height: 25px;
  max-height: 25px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  color: var(--ups-fg-muted);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  white-space: nowrap;
}

.ups-lexicon-tab:hover {
  background-color: var(--ups-surface-hover);
  color: var(--ups-fg);
}

.ups-lexicon-tab.is-active {
  background-color: var(--ups-accent);
  border-color: var(--ups-accent);
  color: var(--ups-accent-fg);
  font-weight: 600;
}

.ups-lexicon-chip.is-picked {
  background-color: var(--ups-accent-soft);
  border-color: var(--ups-accent);
  color: var(--ups-accent);
}

.ups-lexicon-cat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ups-lexicon-cat-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ups-fg-muted);
}

.ups-lexicon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ups-sections-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-input-bg);
}

.ups-sections-bar-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 180px;
}

.ups-section-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-section-group-box {
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-surface);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ups-section-items-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.ups-sec-group {
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-surface);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ups-sec-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.ups-ratio-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

@container plugin-win (max-width: 560px) {
  .ups-ratio-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ups-ratio-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.ups-companion-section {
  border: 1px dashed var(--ups-border-strong);
  border-radius: 9px;
  background-color: var(--ups-surface);
  padding: 8px 11px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ups-companion-section.has-companions {
  border-style: solid;
  border-color: var(--ups-border-strong);
}

.ups-companion-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--ups-border);
}

.ups-companion-slots {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ups-companion-slot {
  border: 1px solid var(--ups-border);
  border-left: 3px solid var(--ups-accent);
  border-radius: 7px;
  background-color: var(--ups-input-bg);
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-split-box {
  border: 1px solid var(--ups-border);
  border-left: 3px solid var(--ups-accent);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-split-hint {
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  white-space: nowrap;
}

.ups-split-hint:hover {
  border-color: var(--ups-accent);
  background-color: var(--ups-surface-hover);
}

.ups-split-hint.is-active {
  border-color: var(--ups-accent);
  background-color: var(--ups-accent-soft);
  color: var(--ups-accent);
  font-weight: 600;
}

.ups-history-popover {
  position: fixed;
  z-index: 2147483016;
  width: min(360px, calc(100vw - 20px));
  max-height: min(400px, 76dvh);
  overflow-y: auto;
  padding: 10px 12px;
  background-color: var(--ups-surface);
  background-image: linear-gradient(var(--ups-surface), var(--ups-surface));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 10px;
  box-shadow: var(--ups-shadow);
  display: flex;
  flex-direction: column;
  gap: 7px;
  pointer-events: auto;
}

.ups-history-item {
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-input-bg);
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ups-wb-group-title {
  padding: 5px 8px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ups-fg-muted);
  background-color: var(--ups-bg-elevated);
  border-bottom: 1px solid var(--ups-border);
}

/* Rows, Grids & Inputs */
.ups-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.ups-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.ups-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ups-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ups-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ups-fg-muted);
}

.ups-input,
.ups-select,
.ups-textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--ups-border);
  border-radius: 7px;
  background-color: var(--ups-input-bg);
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12.5px;
  padding: 6px 9px;
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.ups-input,
.ups-select {
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 10px;
  line-height: 30px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ups-input[type="search"] {
  appearance: none;
  -webkit-appearance: none;
}

.ups-input.ups-input-sm {
  height: 26px;
  min-height: 26px;
  max-height: 26px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 24px;
  border-radius: 6px;
}

.ups-textarea {
  resize: vertical;
  min-height: 76px;
  line-height: 1.55;
}

.ups-input:focus,
.ups-select:focus,
.ups-textarea:focus {
  outline: 2px solid var(--ups-accent-soft);
  border-color: var(--ups-accent);
  background-color: var(--ups-surface);
}

.ups-segmented {
  display: inline-flex;
  align-items: center;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  gap: 3px;
  padding: 3px;
  border-radius: 7px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-input-bg);
}

.ups-seg-btn {
  height: 24px;
  min-height: 24px;
  max-height: 24px;
  padding: 0 11px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ups-fg-muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
}

.ups-seg-btn.is-active {
  background-color: var(--ups-accent);
  color: var(--ups-accent-fg);
  font-weight: 600;
}

/* Strictly Uniform 32px Standard Buttons */
.ups-btn,
.ups-btn-ghost,
.ups-btn-danger {
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.ups-btn:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
  border-color: var(--ups-accent);
}

.ups-btn-ghost {
  border-color: var(--ups-border);
  background-color: var(--ups-input-bg);
  color: var(--ups-fg-muted);
}

.ups-btn-ghost:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
  border-color: var(--ups-border-strong);
  color: var(--ups-fg);
}

.ups-btn-primary {
  background-color: var(--ups-accent);
  border-color: var(--ups-accent);
  color: var(--ups-accent-fg);
  font-weight: 600;
}

.ups-btn-primary:hover:not(:disabled) {
  background-color: var(--ups-accent-hover);
  border-color: var(--ups-accent-hover);
}

.ups-btn-danger {
  background-color: var(--ups-danger-soft);
  border-color: var(--ups-danger);
  color: var(--ups-danger);
}

.ups-btn-danger:hover:not(:disabled) {
  filter: brightness(0.96);
}

.ups-btn:disabled,
.ups-btn-ghost:disabled,
.ups-btn-danger:disabled,
.ups-btn-sm:disabled {
  opacity: 0.46;
  cursor: not-allowed;
}

/* Uniform 26px Compact Buttons (Chips & Inline Row Actions) */
.ups-btn-sm {
  height: 26px;
  min-height: 26px;
  max-height: 26px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.ups-btn-sm:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
  border-color: var(--ups-border-strong);
}

.ups-btn-sm.is-active,
.ups-btn-sm.is-like {
  background-color: var(--ups-ok-soft);
  border-color: var(--ups-ok);
  color: var(--ups-ok);
}

.ups-btn-sm.is-dislike {
  background-color: var(--ups-warn-soft);
  border-color: var(--ups-warn);
  color: var(--ups-warn);
}

.ups-btn-sm.is-dislike:hover:not(:disabled) {
  background-color: var(--ups-danger-soft);
  border-color: var(--ups-danger);
  color: var(--ups-danger);
}

.ups-fav-btn {
  margin-left: auto;
  color: var(--ups-fg-muted);
}

.ups-fav-btn.is-fav {
  color: var(--ups-warn);
  border-color: var(--ups-warn);
  background-color: var(--ups-warn-soft);
}

.ups-btn-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* Compact Grouped Settings Row (No widescreen space-between chasm!) */
.ups-setting-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 5px 0;
  min-width: 0;
  max-width: 660px;
}

.ups-setting-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 0 1 320px;
}

.ups-setting-control {
  width: 168px;
  flex-shrink: 0;
}

/* Switch */
.ups-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 0;
  padding: 2px;
  background-color: var(--ups-track-off);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.ups-switch.is-on {
  background-color: var(--ups-track-on);
}

.ups-switch-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--ups-thumb);
  transform: translateX(0);
  transition: transform 0.15s ease;
}

.ups-switch.is-on .ups-switch-thumb {
  transform: translateX(16px);
}

/* Multi-Open Smooth Accordion Entry List + Drag-Reorder Even While Expanded */
.ups-acc-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ups-border);
  border-radius: 9px;
  overflow: hidden;
  background-color: var(--ups-input-bg);
}

.ups-entry-card {
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-surface);
  overflow: hidden;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.ups-acc-list > .ups-entry-card {
  border: 0;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--ups-border);
  border-radius: 0;
}

.ups-acc-list > .ups-entry-card.is-expanded {
  border-left-color: var(--ups-accent);
}

.ups-acc-list > .ups-entry-card:last-child {
  border-bottom: 0;
}

.ups-entry-card.is-drag-over-top {
  box-shadow: inset 0 2px 0 0 var(--ups-accent);
}

.ups-entry-card.is-drag-over-bottom {
  box-shadow: inset 0 -2px 0 0 var(--ups-accent);
}

.ups-entry-card.is-dragging-row {
  opacity: 0.58;
}

.ups-entry-card.is-disabled .ups-entry-title {
  opacity: 0.56;
}

.ups-entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  min-width: 0;
  transition: background-color 0.15s ease;
}

.ups-entry-row:hover {
  background-color: var(--ups-surface-hover);
}

.ups-entry-card.is-expanded > .ups-entry-row {
  background-color: var(--ups-bg-elevated);
  border-bottom: 1px solid var(--ups-border);
}

.ups-drag-handle {
  width: 18px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ups-fg-muted);
  cursor: grab;
  flex-shrink: 0;
  border-radius: 4px;
  user-select: none;
  font-size: 13px;
  letter-spacing: -1px;
}

.ups-drag-handle:hover {
  background-color: var(--ups-surface-strong);
  color: var(--ups-fg);
}

.ups-acc-row-main {
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: var(--ups-fg);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ups-acc-chev {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ups-fg-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: rotate(0deg);
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s ease;
}

.ups-entry-card.is-expanded .ups-acc-chev {
  transform: rotate(90deg);
  color: var(--ups-accent);
}

.ups-acc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--ups-track-off);
  transition: background-color 0.15s ease;
}

.ups-acc-dot.is-on {
  background-color: var(--ups-ok);
}

.ups-acc-text-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-entry-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-entry-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ups-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.ups-acc-preview {
  font-size: 11.5px;
  color: var(--ups-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.ups-acc-dirty {
  font-size: 11px;
  font-weight: 600;
  color: var(--ups-warn);
  flex-shrink: 0;
}

.ups-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 5px;
  background-color: var(--ups-surface-strong);
  color: var(--ups-fg-muted);
  border: 1px solid var(--ups-border);
  flex-shrink: 0;
}

.ups-badge-ok {
  background-color: var(--ups-ok-soft);
  border-color: var(--ups-ok);
  color: var(--ups-ok);
}

.ups-badge-warn {
  background-color: var(--ups-warn-soft);
  border-color: var(--ups-warn);
  color: var(--ups-warn);
}

.ups-badge-danger {
  background-color: var(--ups-danger-soft);
  border-color: var(--ups-danger);
  color: var(--ups-danger);
}

/* Container-Responsive Row Controls: Wide = flat inline buttons & NO ··· ; Narrow = ··· */
.ups-row-controls {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.ups-row-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ups-more-btn {
  width: 28px;
  height: 26px;
  min-height: 26px;
  max-height: 26px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}

.ups-more-btn:hover {
  background-color: var(--ups-surface-hover);
  border-color: var(--ups-border-strong);
}

@container plugin-win (max-width: 620px) {
  .ups-row-inline-actions {
    display: none;
  }

  .ups-more-btn {
    display: inline-flex;
  }

  .ups-taste-grid {
    grid-template-columns: 1fr;
  }
}

/* Smooth CSS Grid 0fr -> 1fr Accordion Body (Body-first, metadata collapsed by default!) */
.ups-acc-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease;
}

.ups-entry-card.is-expanded > .ups-acc-collapse {
  grid-template-rows: 1fr;
  opacity: 1;
}

.ups-acc-collapse-inner {
  overflow: hidden;
  min-height: 0;
}

.ups-entry-editor {
  padding: 10px 12px 12px 16px;
  background-color: var(--ups-surface);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ups-acc-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ups-acc-editor-tools {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.ups-acc-textarea {
  min-height: 120px;
  transition: min-height 0.16s ease;
}

.ups-acc-textarea.is-tall {
  min-height: 320px;
  height: 320px;
}

.ups-acc-editor-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.ups-acc-save-status {
  font-size: 12px;
  font-weight: 500;
  color: var(--ups-ok);
  margin-left: auto;
}

.ups-synced-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ups-synced-row {
  border: 1px solid var(--ups-border);
  border-left: 3px solid var(--ups-accent);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-synced-row.is-disabled {
  opacity: 0.66;
  border-left-color: var(--ups-border-strong);
}

.ups-synced-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ups-synced-body {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  font-size: 12px;
  line-height: 1.55;
  color: var(--ups-fg);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.ups-api-save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid var(--ups-border);
}

/* Slim Selection-Driven Preference Bar (1 slim row when idle; expands smoothly on selection!) */
.ups-selection-bar {
  border: 1px dashed var(--ups-border-strong);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.ups-selection-bar.has-selection {
  border-style: solid;
  border-color: var(--ups-accent);
  background-color: var(--ups-accent-soft);
  gap: 6px;
}

.ups-selection-drawer {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.18s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.14s ease;
}

.ups-selection-bar.has-selection .ups-selection-drawer,
.ups-selection-bar.is-pinned-open .ups-selection-drawer {
  grid-template-rows: 1fr;
  opacity: 1;
}

.ups-selection-drawer-inner {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ups-selection-bar.has-selection .ups-selection-drawer-inner,
.ups-selection-bar.is-pinned-open .ups-selection-drawer-inner {
  padding-top: 6px;
  border-top: 1px solid var(--ups-border);
}

.ups-selection-snippet {
  font-size: 12px;
  font-weight: 500;
  color: var(--ups-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-selection-bar.has-selection .ups-selection-snippet {
  color: var(--ups-fg);
  font-weight: 600;
}

.ups-chip-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.ups-chip-label {
  font-size: 11.5px;
  color: var(--ups-fg-muted);
  margin-right: 2px;
  white-space: nowrap;
}

/* Diff, Draft Self-Check Log & Lint */
.ups-diff-box {
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-input-bg);
  padding: 8px;
  max-height: 170px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.ups-diff-line {
  padding: 1px 4px;
  border-radius: 3px;
}

.ups-diff-add {
  background-color: var(--ups-ok-soft);
  color: var(--ups-ok);
}

.ups-diff-del {
  background-color: var(--ups-danger-soft);
  color: var(--ups-danger);
}

.ups-diff-eq {
  color: var(--ups-fg-muted);
}

.ups-issue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 5px 9px;
  border-radius: 6px;
  background-color: var(--ups-warn-soft);
  border: 1px solid var(--ups-warn);
  color: var(--ups-warn);
  font-size: 12px;
}

.ups-issue-item > span {
  min-width: 0;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ups-issue-item > button {
  flex-shrink: 0;
}

.ups-taste-candidates {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
  border: 1px solid var(--ups-accent);
  border-radius: 8px;
  background-color: var(--ups-surface);
}

.ups-check-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12.5px;
  cursor: pointer;
}

/* Anchored Popover & Floating Menu (NO !important width overrides) */
.ups-popover,
.ups-floating-menu {
  position: fixed;
  z-index: 2147483015;
  background-color: var(--ups-surface);
  background-image: linear-gradient(var(--ups-surface), var(--ups-surface));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 10px;
  box-shadow: var(--ups-shadow);
  pointer-events: auto;
}

.ups-popover {
  width: min(320px, calc(100vw - 20px));
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ups-floating-menu {
  min-width: 156px;
  max-width: min(240px, calc(100vw - 16px));
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ups-menu-item {
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ups-menu-item:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
}

.ups-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Non-Blocking Draggable Auxiliary Floating Panel (Never locks underlying scroll!) */
.ups-submodal-mask {
  position: fixed;
  inset: 0;
  z-index: 2147483020;
  background: transparent;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.ups-submodal-card {
  position: relative;
  pointer-events: auto;
  width: min(560px, calc(100vw - 24px));
  max-height: min(560px, 86dvh);
  background-color: var(--ups-surface);
  background-image: linear-gradient(var(--ups-surface), var(--ups-surface));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 12px;
  box-shadow: var(--ups-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ups-submodal-card.is-floating {
  position: fixed;
  margin: 0;
}

.ups-submodal-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--ups-border);
  background-color: var(--ups-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ups-submodal-body {
  padding: 12px 14px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ups-submodal-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--ups-border);
  background-color: var(--ups-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* Minimized Capsule Pill */
.ups-minimized-pill {
  position: fixed;
  z-index: 2147483002;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-surface);
  background-image: linear-gradient(var(--ups-surface), var(--ups-surface));
  color: var(--ups-fg);
  box-shadow: var(--ups-shadow);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  pointer-events: auto;
  max-width: calc(100vw - 24px);
}

.ups-minimized-pill:hover {
  background-color: var(--ups-surface-hover);
}

/* Compact height mode (360x420 & compact viewports) */
.ups-modal.is-compact-h .ups-header {
  height: 40px;
}

.ups-modal.is-compact-h .ups-tabs {
  height: 36px;
}

.ups-modal.is-compact-h .ups-tab {
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  font-size: 11.5px;
}

.ups-modal.is-compact-h .ups-body {
  padding: 8px 10px;
  gap: 8px;
}

.ups-modal.is-compact-h .ups-footer {
  min-height: 40px;
  padding: 5px 10px;
}

.ups-modal.is-compact-h .ups-footer-left {
  display: none;
}

/* Container Queries for 4-State Stability */
@container plugin-win (max-width: 680px) {
  .ups-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .ups-footer-actions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .ups-footer-actions > button {
    flex: 1 1 auto;
    min-width: 0;
  }
}

@container plugin-win (max-width: 560px) {
  .ups-grid-2 {
    grid-template-columns: 1fr;
  }

  .ups-setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .ups-setting-meta {
    flex: 1 1 auto;
    width: 100%;
  }

  .ups-setting-control {
    width: 100%;
  }
}

@container plugin-win (max-width: 420px) {
  .ups-header {
    padding: 0 10px;
    gap: 5px;
  }

  .ups-ctx-chip {
    max-width: 68px;
    font-size: 10.5px;
  }

  .ups-palette-select {
    max-width: 74px;
    font-size: 11px;
    padding: 0 4px;
  }

  .ups-tabs {
    padding: 0 8px;
    gap: 4px;
  }

  .ups-tab {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 6px;
    font-size: 11.5px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ups-body {
    padding: 9px 10px;
  }

  .ups-footer {
    padding: 6px 10px;
  }

  .ups-footer-actions > button {
    height: 28px;
    min-height: 28px;
    max-height: 28px;
    padding: 0 6px;
    font-size: 11.5px;
  }

  .ups-hide-xs {
    display: none;
  }
}

@container plugin-win (max-width: 355px) {
  .ups-ctx-chip {
    display: none;
  }

  .ups-palette-select {
    max-width: 64px;
    height: 26px;
    min-height: 26px;
    max-height: 26px;
  }

  .ups-header .ups-icon-btn {
    min-width: 24px;
    height: 26px;
    min-height: 26px;
    max-height: 26px;
    padding: 0 5px;
    font-size: 11px;
  }

  .ups-header-title {
    font-size: 13px;
  }
}

/* Mobile Fullscreen & Safe Area (excluding floating/mini/menus) */
@media (max-width: 640px) {
  .ups-backdrop {
    padding: 0;
    align-items: stretch;
  }

  .ups-modal:not(.is-floating):not(.is-mini) {
    margin: 0;
    width: 100vw;
    max-width: 100vw;
    min-width: 0;
    height: 100dvh;
    max-height: 100dvh;
    min-height: 0;
    border-radius: 0;
    border: none;
    padding-top: env(safe-area-inset-top, 0px);
  }

  .ups-modal:not(.is-floating):not(.is-mini) .ups-footer {
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  }

  .ups-modal:not(.is-floating):not(.is-mini) .ups-rz {
    display: none;
  }

  .ups-modal:not(.is-floating):not(.is-mini) .ups-header {
    cursor: default;
    touch-action: auto;
  }

  .ups-submodal-footer {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
}

/* Mandatory Gate 10: Mobile & Coarse-Pointer Inputs >= 16px to prevent iOS WKWebView zoom/jitter */
@media (max-width: 680px), (pointer: coarse) {
  .ups-input,
  .ups-textarea,
  .ups-input.ups-input-sm {
    font-size: 16px;
  }

  .ups-input {
    height: 36px;
    min-height: 36px;
    max-height: 36px;
    line-height: 34px;
  }

  .ups-word-count-combo {
    height: 36px;
    min-height: 36px;
    max-height: 36px;
  }

  .ups-word-count-combo > .ups-word-count-input,
  .ups-word-count-menu-btn {
    height: 34px;
    min-height: 34px;
    max-height: 34px;
  }

  .ups-input.ups-input-sm {
    height: 32px;
    min-height: 32px;
    max-height: 32px;
    line-height: 30px;
  }
}
`;

export function buildShadowStyles() {
  return SHADOW_CSS;
}
