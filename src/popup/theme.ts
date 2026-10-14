// Tema e cor principal do popup. Carregado no <head> (sem inline) para pintar o primeiro frame já certo;
// o último valor fica espelhado em localStorage porque chrome.storage responde de forma assíncrona.
export const SPEEDIA_DEFAULT_ACCENT = '#bf22ed';
export const SPEEDIA_LOOK_CACHE = 'speediaLook';

export type SpeediaTheme = 'auto' | 'light' | 'dark';
export interface SpeediaLook { theme?: unknown; accent?: unknown }

export function speediaValidAccent(v: unknown): string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : SPEEDIA_DEFAULT_ACCENT;
}
export function speediaValidTheme(v: unknown): SpeediaTheme {
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function speediaLum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function speediaContrast(a: string, b: string): number {
  const [hi, lo] = [speediaLum(a), speediaLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// Texto sobre a cor de destaque: o de maior contraste WCAG.
export function speediaOn(hex: string): string {
  return speediaContrast(hex, '#ffffff') >= speediaContrast(hex, '#111111') ? '#fff' : '#111';
}
export function speediaMix(a: string, b: string, t: number): string {
  return '#' + [1, 3, 5].map((i) => {
    const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  }).join('');
}

export function speediaApplyLook(look: SpeediaLook): void {
  const root = document.documentElement;
  const theme = speediaValidTheme(look.theme);
  const accent = speediaValidAccent(look.accent);
  root.dataset.theme = theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  const css = getComputedStyle(root);
  const [card, control, text] = ['--card', '--control', '--text'].map((v) => css.getPropertyValue(v).trim());
  // --accent-ui: destaque usado como único indicador (switch, segmento); escurece/clareia até 3:1 contra o fundo.
  let ui = accent;
  for (let t = 0.05; t <= 1 && Math.min(speediaContrast(ui, card), speediaContrast(ui, control)) < 3; t += 0.05) {
    ui = speediaMix(accent, text, t);
  }
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set('--accent', accent);
  set('--accent-text', speediaOn(accent));
  set('--accent-ui', ui);
  set('--accent-ui-text', speediaOn(ui));
  set('--focus', speediaContrast(accent, card) >= 3 ? accent : text);
}

export function speediaCacheLook(look: SpeediaLook): void {
  try {
    localStorage.setItem(SPEEDIA_LOOK_CACHE, JSON.stringify(look));
  } catch {}
}

export function speediaCachedLook(): SpeediaLook {
  try {
    return JSON.parse(localStorage.getItem(SPEEDIA_LOOK_CACHE) ?? 'null') || {};
  } catch {
    return {};
  }
}
