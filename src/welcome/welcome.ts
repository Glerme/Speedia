import { speediaApplyI18n, speediaMsg } from '../shared/i18n';
import { SPEEDIA_ACTIONS, speediaDefaultShortcuts, speediaPretty } from '../shared/shortcuts';

// Monta a tabela com os atalhos atuais (padrões + o que o usuário personalizou).
function renderShortcuts(saved?: Record<string, string>) {
  const shortcuts = { ...speediaDefaultShortcuts(), ...saved };
  const body = document.getElementById('shortcuts-body')!;
  body.replaceChildren();

  for (const action of SPEEDIA_ACTIONS) {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = action.label;
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = action.hint;
    th.append(" ", hint);

    const td = document.createElement('td');
    const pretty = speediaPretty(shortcuts[action.id]);
    if (pretty) {
      const kbd = document.createElement('kbd');
      kbd.textContent = pretty;
      td.append(kbd);
    } else {
      td.className = 'off';
      td.textContent = speediaMsg('welcomeDisabled');
    }

    tr.append(th, td);
    body.append(tr);
  }
}

// Tema/cor de destaque (contrato compartilhado: storage.sync 'theme' e 'accent').
const DEFAULT_ACCENT = '#bf22ed';
const dark = matchMedia('(prefers-color-scheme: dark)');
let theme: unknown = 'auto';
let accent: string = DEFAULT_ACCENT;

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = theme === 'auto' ? (dark.matches ? 'dark' : 'light') : String(theme);
  const l = lum(accent);
  root.style.setProperty('--accent', accent);
  // Contraste WCAG com #fff (L=1) vs #111 (L≈0.0056).
  root.style.setProperty('--accent-fg', 1.05 / (l + 0.05) >= (l + 0.05) / 0.0556 ? '#fff' : '#111');
}

function setAppearance(t: unknown, a: unknown) {
  theme = t === 'light' || t === 'dark' ? t : 'auto';
  accent = typeof a === 'string' && /^#[0-9a-f]{6}$/i.test(a) ? a : DEFAULT_ACCENT;
  applyAppearance();
}

dark.addEventListener('change', applyAppearance);
applyAppearance();
chrome.storage.sync.get(['theme', 'accent'], (res) => {
  if (!chrome.runtime.lastError) setAppearance(res?.theme, res?.accent);
});

speediaApplyI18n();
renderShortcuts({});
chrome.storage.sync.get('shortcuts', (res) => {
  if (!chrome.runtime.lastError) renderShortcuts(res?.shortcuts as Record<string, string> | undefined);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.theme || changes.accent) {
    setAppearance(changes.theme ? changes.theme.newValue : theme, changes.accent ? changes.accent.newValue : accent);
  }
  if (changes.shortcuts) renderShortcuts(changes.shortcuts.newValue as Record<string, string> | undefined);
});

// A edição da loja não tem download de vídeos.
if (globalThis.SPEEDIA_EDITION === 'store') document.getElementById('feat-download')?.remove();
