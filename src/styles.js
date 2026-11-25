export const PALETTE_OPTIONS = Object.freeze([
  { id: 'paper', label: '纸墨浅白' },
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

export function readHostThemeVars(doc = typeof document !== 'undefined' ? document : null, win = typeof window !== 'undefined' ? window : null) {
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
    const fallbackBg = isLight ? '#f4f4f1' : '#191a1d';
    const fallbackFg = isLight ? '#23262b' : '#ecece8';
    const baseBg = toOpaqueColor(hostVars?.blurBg || hostVars?.mainBg || fallbackBg, fallbackBg);
    const fg = toOpaqueColor(hostVars?.bodyColor || fallbackFg, fallbackFg);
    const borderBase = hostVars?.borderColor
      ? toOpaqueColor(hostVars.borderColor, baseBg)
      : mixOpaqueColors(fg, baseBg, isLight ? 0.16 : 0.22);
    const accentBase = hostVars?.accentColor
      ? toOpaqueColor(hostVars.accentColor, isLight ? '#4f5d75' : '#8fa2be')
      : isLight
        ? '#4f5d75'
        : '#8fa2be';
    const accentRgb = parseColorRgb(accentBase) || { r: 79, g: 93, b: 117, a: 1 };
    const accentFg = luminanceOf(accentRgb) >= 155 ? '#181a1e' : '#ffffff';

    vars['--ups-bg'] = baseBg;
    vars['--ups-bg-elevated'] = mixOpaqueColors(isLight ? '#ffffff' : '#262930', baseBg, isLight ? 0.55 : 0.35);
    vars['--ups-surface'] = mixOpaqueColors(isLight ? '#ffffff' : '#2e3138', baseBg, isLight ? 0.72 : 0.48);
    vars['--ups-surface-strong'] = mixOpaqueColors(fg, baseBg, isLight ? 0.08 : 0.14);
    vars['--ups-surface-hover'] = mixOpaqueColors(fg, baseBg, isLight ? 0.12 : 0.18);
    vars['--ups-border'] = mixOpaqueColors(borderBase, baseBg, 0.72);
    vars['--ups-border-strong'] = mixOpaqueColors(fg, baseBg, isLight ? 0.28 : 0.34);
    vars['--ups-fg'] = fg;
    vars['--ups-fg-muted'] = mixOpaqueColors(fg, baseBg, 0.62);
    vars['--ups-accent'] = accentBase;
    vars['--ups-accent-hover'] = mixOpaqueColors(fg, accentBase, isLight ? 0.14 : 0.18);
    vars['--ups-accent-fg'] = accentFg;
    vars['--ups-accent-soft'] = mixOpaqueColors(accentBase, baseBg, 0.18);
    vars['--ups-track-off'] = mixOpaqueColors(fg, baseBg, 0.24);
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

/* Solid Opaque Palettes (Light & Dark, --modal-blur: 0px) */
.ups-theme-root,
.ups-theme-root.ups-theme-light[data-ups-theme-palette="paper"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #f6f5f1;
  --ups-bg-elevated: #eceae3;
  --ups-surface: #ffffff;
  --ups-surface-strong: #e5e2d8;
  --ups-surface-hover: #eae7df;
  --ups-border: #d5d1c6;
  --ups-border-strong: #b7b2a4;
  --ups-fg: #222428;
  --ups-fg-muted: #5d626b;
  --ups-accent: #44566c;
  --ups-accent-hover: #354559;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #e2e7ee;
  --ups-ok: #2e6f4e;
  --ups-ok-soft: #e4f0e9;
  --ups-warn: #8a5b1e;
  --ups-warn-soft: #f5ecdc;
  --ups-danger: #9e3a38;
  --ups-danger-soft: #f7e4e4;
  --ups-track-off: #c2beb2;
  --ups-track-on: #44566c;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 14px 38px rgba(18, 22, 28, 0.2);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="paper"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #1e2024;
  --ups-bg-elevated: #25282e;
  --ups-surface: #2b2e35;
  --ups-surface-strong: #343841;
  --ups-surface-hover: #383c46;
  --ups-border: #3d424c;
  --ups-border-strong: #535966;
  --ups-fg: #ebeae6;
  --ups-fg-muted: #a6aab3;
  --ups-accent: #7f97b4;
  --ups-accent-hover: #94abc7;
  --ups-accent-fg: #14171c;
  --ups-accent-soft: #2b3440;
  --ups-ok: #6db38b;
  --ups-ok-soft: #22352b;
  --ups-warn: #cfa15a;
  --ups-warn-soft: #382e1f;
  --ups-danger: #d47b78;
  --ups-danger-soft: #3b2425;
  --ups-track-off: #4c515d;
  --ups-track-on: #7f97b4;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="ink"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #eff4f5;
  --ups-bg-elevated: #e3ecee;
  --ups-surface: #fafcfd;
  --ups-surface-strong: #d8e4e7;
  --ups-surface-hover: #e1ebee;
  --ups-border: #c5d5d9;
  --ups-border-strong: #9fb4ba;
  --ups-fg: #1c282c;
  --ups-fg-muted: #506369;
  --ups-accent: #3d6b75;
  --ups-accent-hover: #2f555d;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #dce9ec;
  --ups-ok: #2e6f56;
  --ups-ok-soft: #e0efe9;
  --ups-warn: #8c6224;
  --ups-warn-soft: #f3ebdc;
  --ups-danger: #a14343;
  --ups-danger-soft: #f5e2e2;
  --ups-track-off: #b3c4c9;
  --ups-track-on: #3d6b75;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 14px 38px rgba(18, 34, 38, 0.18);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="ink"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #182124;
  --ups-bg-elevated: #202b2f;
  --ups-surface: #263338;
  --ups-surface-strong: #2f3e44;
  --ups-surface-hover: #35454b;
  --ups-border: #3a4c52;
  --ups-border-strong: #516870;
  --ups-fg: #e5eef0;
  --ups-fg-muted: #9eb2b7;
  --ups-accent: #73a6b0;
  --ups-accent-hover: #89b9c2;
  --ups-accent-fg: #10181b;
  --ups-accent-soft: #24383d;
  --ups-ok: #6db392;
  --ups-ok-soft: #1f352c;
  --ups-warn: #d1a35d;
  --ups-warn-soft: #362d1e;
  --ups-danger: #d47b7b;
  --ups-danger-soft: #3a2325;
  --ups-track-off: #485b61;
  --ups-track-on: #73a6b0;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="warm"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #f6f1ea;
  --ups-bg-elevated: #ede4d8;
  --ups-surface: #fcf9f5;
  --ups-surface-strong: #e4d8c8;
  --ups-surface-hover: #ebe1d4;
  --ups-border: #d7c9b8;
  --ups-border-strong: #b9a690;
  --ups-fg: #2b241d;
  --ups-fg-muted: #6c5f52;
  --ups-accent: #7b5b43;
  --ups-accent-hover: #644935;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #ede2d7;
  --ups-ok: #386e4d;
  --ups-ok-soft: #e4efe7;
  --ups-warn: #8f5c1a;
  --ups-warn-soft: #f5ebd9;
  --ups-danger: #a3433b;
  --ups-danger-soft: #f7e3e1;
  --ups-track-off: #c7b8a6;
  --ups-track-on: #7b5b43;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 14px 38px rgba(40, 28, 16, 0.18);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="warm"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #221d19;
  --ups-bg-elevated: #2b241f;
  --ups-surface: #332b25;
  --ups-surface-strong: #3e342d;
  --ups-surface-hover: #463b33;
  --ups-border: #4d4138;
  --ups-border-strong: #67584c;
  --ups-fg: #f0e8df;
  --ups-fg-muted: #b6a799;
  --ups-accent: #be9473;
  --ups-accent-hover: #cfa889;
  --ups-accent-fg: #1d1712;
  --ups-accent-soft: #3c3026;
  --ups-ok: #72b389;
  --ups-ok-soft: #233429;
  --ups-warn: #d4a359;
  --ups-warn-soft: #382c1d;
  --ups-danger: #d67c74;
  --ups-danger-soft: #3c2322;
  --ups-track-off: #5c4e43;
  --ups-track-on: #be9473;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="sakura"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #f8f2f4;
  --ups-bg-elevated: #f0e6ea;
  --ups-surface: #fefbfc;
  --ups-surface-strong: #e8dae0;
  --ups-surface-hover: #efe3e8;
  --ups-border: #dccad1;
  --ups-border-strong: #bf9fa9;
  --ups-fg: #2b2125;
  --ups-fg-muted: #6c5960;
  --ups-accent: #8e5669;
  --ups-accent-hover: #754455;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #f1e3e8;
  --ups-ok: #386e54;
  --ups-ok-soft: #e3efe9;
  --ups-warn: #8f6023;
  --ups-warn-soft: #f5ecdd;
  --ups-danger: #a63f48;
  --ups-danger-soft: #f8e2e4;
  --ups-track-off: #cbb7bf;
  --ups-track-on: #8e5669;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 14px 38px rgba(45, 22, 32, 0.17);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="sakura"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #231c20;
  --ups-bg-elevated: #2c2328;
  --ups-surface: #34292f;
  --ups-surface-strong: #40323a;
  --ups-surface-hover: #483941;
  --ups-border: #4f3e48;
  --ups-border-strong: #6c5562;
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
  --ups-shadow: 0 18px 42px rgba(0, 0, 0, 0.48);
}

/* glass-dark is strictly opaque solid #191a1d */
.ups-theme-root[data-ups-theme-palette="glass-dark"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #191a1d;
  --ups-bg-elevated: #202226;
  --ups-surface: #26292e;
  --ups-surface-strong: #2f333a;
  --ups-surface-hover: #353a42;
  --ups-border: #3a3f48;
  --ups-border-strong: #505763;
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
  --ups-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
}

.ups-theme-root.ups-theme-light[data-ups-theme-palette="host"] {
  color-scheme: light;
  --modal-blur: 0px;
  --ups-bg: #f5f5f3;
  --ups-bg-elevated: #eaeae6;
  --ups-surface: #ffffff;
  --ups-surface-strong: #e2e2dc;
  --ups-surface-hover: #e7e7e2;
  --ups-border: #d0d0c9;
  --ups-border-strong: #aeaea6;
  --ups-fg: #222428;
  --ups-fg-muted: #5d626b;
  --ups-accent: #44566c;
  --ups-accent-hover: #354559;
  --ups-accent-fg: #ffffff;
  --ups-accent-soft: #e2e7ee;
  --ups-ok: #2e6f4e;
  --ups-ok-soft: #e4f0e9;
  --ups-warn: #8a5b1e;
  --ups-warn-soft: #f5ecdc;
  --ups-danger: #9e3a38;
  --ups-danger-soft: #f7e4e4;
  --ups-track-off: #c2c2ba;
  --ups-track-on: #44566c;
  --ups-thumb: #ffffff;
  --ups-shadow: 0 14px 38px rgba(18, 22, 28, 0.2);
}

.ups-theme-root.ups-theme-dark[data-ups-theme-palette="host"] {
  color-scheme: dark;
  --modal-blur: 0px;
  --ups-bg: #191a1d;
  --ups-bg-elevated: #212328;
  --ups-surface: #272a30;
  --ups-surface-strong: #31353c;
  --ups-surface-hover: #373c44;
  --ups-border: #3c414a;
  --ups-border-strong: #535966;
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
  --ups-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
}

/* Outer transparent non-blocking backdrop */
.ups-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: transparent;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.ups-backdrop.is-minimized {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

.ups-backdrop.is-minimized * {
  pointer-events: none !important;
}

/* Main studio modal window */
.ups-modal {
  position: relative;
  pointer-events: auto;
  container-type: inline-size;
  container-name: plugin-win;
  width: min(820px, calc(100vw - 24px));
  height: min(620px, 88dvh);
  min-width: 320px;
  min-height: 280px;
  background-color: var(--ups-bg);
  background-image: linear-gradient(var(--ups-bg), var(--ups-bg));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 14px;
  box-shadow: var(--ups-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ups-modal.is-floating {
  position: fixed;
  margin: 0;
  max-width: none;
  max-height: none;
}

.ups-modal.is-dragging,
.ups-modal.is-resizing {
  user-select: none;
}

/* Constant Topbar (48px) */
.ups-header {
  flex-shrink: 0;
  height: 48px;
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
  gap: 7px;
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
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: var(--ups-accent-soft);
  color: var(--ups-accent);
  border: 1px solid var(--ups-border);
  max-width: 150px;
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
  min-width: 28px;
  padding: 0 8px;
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

.ups-icon-btn:hover {
  background-color: var(--ups-surface-hover);
}

.ups-icon-btn.is-active {
  background-color: var(--ups-accent-soft);
  border-color: var(--ups-accent);
  color: var(--ups-accent);
}

/* Constant Tab Bar (44px) */
.ups-tabs {
  flex-shrink: 0;
  height: 44px;
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
  padding: 0 12px;
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
  font-weight: 600;
}

/* Scrollable Middle Body */
.ups-body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
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
  gap: 10px;
  min-width: 0;
}

/* Constant Bottom Footer */
.ups-footer {
  flex-shrink: 0;
  min-height: 48px;
  padding: 8px 14px;
  background-color: var(--ups-bg-elevated);
  border-top: 1px solid var(--ups-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ups-modal.is-resizable .ups-footer {
  padding-right: 32px;
}

.ups-footer-status {
  font-size: 12px;
  color: var(--ups-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-footer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Cards, Grids & Controls */
.ups-card {
  background-color: var(--ups-surface);
  border: 1px solid var(--ups-border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ups-card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.ups-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ups-fg);
}

.ups-muted {
  font-size: 12px;
  color: var(--ups-fg-muted);
}

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
  background-color: var(--ups-bg);
  color: var(--ups-fg);
  font-family: inherit;
  font-size: 12.5px;
  padding: 6px 9px;
}

.ups-input,
.ups-select {
  height: 32px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ups-textarea {
  resize: vertical;
  min-height: 76px;
  line-height: 1.5;
}

.ups-input:focus,
.ups-select:focus,
.ups-textarea:focus {
  outline: 2px solid var(--ups-accent-soft);
  border-color: var(--ups-accent);
}

.ups-segmented {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-bg);
}

.ups-seg-btn {
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ups-fg-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
}

.ups-seg-btn.is-active {
  background-color: var(--ups-accent);
  color: var(--ups-accent-fg);
}

/* Buttons (no underline link-buttons anywhere) */
.ups-btn,
.ups-btn-ghost {
  height: 32px;
  padding: 0 11px;
  border-radius: 7px;
  border: 1px solid var(--ups-border);
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
}

.ups-btn:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
}

.ups-btn-ghost {
  height: 28px;
  padding: 0 9px;
  border-radius: 6px;
  background: transparent;
  color: var(--ups-fg-muted);
}

.ups-btn-ghost:hover:not(:disabled) {
  background-color: var(--ups-surface-hover);
  color: var(--ups-fg);
}

.ups-btn-primary {
  background-color: var(--ups-accent);
  border-color: var(--ups-accent);
  color: var(--ups-accent-fg);
}

.ups-btn-primary:hover:not(:disabled) {
  background-color: var(--ups-accent-hover);
}

.ups-btn-danger {
  background-color: var(--ups-danger-soft);
  border-color: var(--ups-border);
  color: var(--ups-danger);
}

.ups-btn:disabled,
.ups-btn-ghost:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.ups-btn-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* Aligned Settings Row */
.ups-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  min-width: 0;
}

.ups-setting-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.ups-setting-control {
  width: 148px;
  flex-shrink: 0;
}

/* Switch */
.ups-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 34px;
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
  transform: translateX(14px);
}

/* Compact Stack Entry Rows */
.ups-entry-card {
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-bg);
  overflow: hidden;
}

.ups-entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  min-width: 0;
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
  font-weight: 500;
  color: var(--ups-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
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
  color: var(--ups-ok);
}

.ups-badge-warn {
  background-color: var(--ups-warn-soft);
  color: var(--ups-warn);
}

.ups-row-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ups-more-btn {
  width: 28px;
  height: 26px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--ups-border);
  background-color: var(--ups-surface);
  color: var(--ups-fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ups-entry-editor {
  border-top: 1px solid var(--ups-border);
  padding: 10px;
  background-color: var(--ups-surface);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Diff & Lint */
.ups-diff-box {
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-bg);
  padding: 8px;
  max-height: 180px;
  overflow-y: auto;
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
  padding: 5px 8px;
  border-radius: 6px;
  background-color: var(--ups-warn-soft);
  color: var(--ups-warn);
  font-size: 12px;
}

.ups-taste-candidates {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--ups-border);
  border-radius: 8px;
  background-color: var(--ups-bg);
}

.ups-check-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12.5px;
  cursor: pointer;
}

/* Anchored Popover & Floating Menu (NO !important width overrides) */
.ups-popover-anchor {
  position: relative;
  display: inline-flex;
}

.ups-popover,
.ups-floating-menu {
  position: fixed;
  z-index: 2147483015;
  background-color: var(--ups-bg);
  background-image: linear-gradient(var(--ups-bg), var(--ups-bg));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 10px;
  box-shadow: var(--ups-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: auto;
}

.ups-popover {
  width: min(300px, calc(100vw - 20px));
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ups-floating-menu {
  min-width: 152px;
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

/* Sub-Modal */
.ups-submodal-mask {
  position: fixed;
  inset: 0;
  z-index: 2147483020;
  background-color: rgba(15, 18, 24, 0.35);
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.ups-submodal-card {
  width: min(560px, calc(100vw - 24px));
  max-height: min(540px, 84dvh);
  background-color: var(--ups-bg);
  background-image: linear-gradient(var(--ups-bg), var(--ups-bg));
  color: var(--ups-fg);
  border: 1px solid var(--ups-border-strong);
  border-radius: 12px;
  box-shadow: var(--ups-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ups-submodal-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--ups-border);
  background-color: var(--ups-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.ups-submodal-body {
  padding: 12px 14px;
  overflow-y: auto;
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

/* SE Resize Handle (24x24px) */
.ups-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 24px;
  z-index: 15;
  cursor: nwse-resize;
  touch-action: none;
  user-select: none;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 5px;
  color: var(--ups-fg-muted);
}

/* Minimized Capsule Pill */
.ups-minimized-pill {
  position: fixed;
  z-index: 2147483002;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--ups-border-strong);
  background-color: var(--ups-bg-elevated);
  background-image: linear-gradient(var(--ups-bg-elevated), var(--ups-bg-elevated));
  color: var(--ups-fg);
  box-shadow: var(--ups-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
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

/* Compact height mode (360x420 & mobile mini-window) */
.ups-modal.is-compact-h .ups-header {
  height: 40px;
}

.ups-modal.is-compact-h .ups-tabs {
  height: 36px;
}

.ups-modal.is-compact-h .ups-tab {
  height: 28px;
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

.ups-modal.is-compact-h.is-resizable .ups-footer {
  padding-right: 28px;
}

.ups-modal.is-compact-h .ups-footer-status {
  display: none;
}

/* Container Queries for 4-State Stability */
@container plugin-win (max-width: 560px) {
  .ups-grid-2 {
    grid-template-columns: 1fr;
  }

  .ups-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .ups-footer-actions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ups-footer-actions > button {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ups-setting-row {
    flex-wrap: wrap;
    gap: 6px;
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
    max-width: 72px;
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

  .ups-modal.is-resizable .ups-footer {
    padding-right: 28px;
  }

  .ups-footer-actions > button {
    height: 28px;
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
    max-width: 62px;
  }

  .ups-header .ups-icon-btn {
    min-width: 24px;
    height: 26px;
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

  .ups-modal:not(.is-floating):not(.is-mini) .ups-resize-handle {
    display: none;
  }

  .ups-modal:not(.is-floating):not(.is-mini) .ups-header {
    cursor: default;
    touch-action: auto;
  }

  .ups-modal.is-mini {
    border-radius: 14px;
    border: 1px solid var(--ups-border-strong);
  }

  .ups-submodal-footer {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
}
`;

export function buildShadowStyles() {
  return SHADOW_CSS;
}
