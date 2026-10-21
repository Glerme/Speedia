import { SPEEDIA_DEFAULT_ACCENT, speediaApplyLook, speediaCacheLook, speediaCachedLook, speediaOn, speediaValidAccent, speediaValidTheme, type SpeediaTheme } from './theme';
import { speediaApplyI18n, speediaMsg } from '../shared/i18n';
import { SPEEDIA_ACTIONS, speediaCombo, speediaDefaultShortcuts, speediaPretty } from '../shared/shortcuts';

type Shortcuts = Record<string, string>;
// Objeto guardado em chrome.storage.sync.
interface Settings { autoPip: boolean; tabPip: boolean; shortcuts: Shortcuts; theme: string; accent: string }

(() => {
  'use strict';

  // Textos da interface vêm de _locales via speediaMsg.
  const T = {
    pressKey: speediaMsg('popupPressKey'),
    none: speediaMsg('popupNone'),
    keyTitle: speediaMsg('popupKeyTitle'),
    keyAria: (label: string, pretty: string) => speediaMsg('popupKeyAria', label, pretty),
    clearTitle: speediaMsg('popupClearTitle'),
    clearAria: (label: string) => speediaMsg('popupClearAria', label),
    recording: (label: string) => speediaMsg('popupRecording', label),
    conflict: (pretty: string, other: string) => speediaMsg('popupConflict', pretty, other),
    saved: speediaMsg('popupSaved'),
    cleared: (label: string) => speediaMsg('popupCleared', label),
    reset: speediaMsg('popupResetDone'),
  };

  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const list = byId('shortcuts');
  const autoPip = byId<HTMLInputElement>('autoPip');
  const tabPip = byId<HTMLInputElement>('tabPip');
  const bar = byId('bar');
  const $reset = byId<HTMLButtonElement>('reset');
  const statusText = byId('statusText');
  const undoBtn = byId<HTMLButtonElement>('undo');
  let shortcuts = speediaDefaultShortcuts();
  let recording: string | null = null; // id da ação esperando uma tecla
  let flashId: string | null = null; // linha a destacar no próximo render
  let undoSnapshot: Shortcuts | null = null;
  let statusTimer = 0;

  speediaApplyI18n();
  byId('version').textContent = 'v' + chrome.runtime.getManifest().version;

  function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Partial<HTMLElementTagNameMap[K]>, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    Object.assign(el, props);
    el.append(...children);
    return el;
  }

  function save() {
    chrome.storage.sync.set({ shortcuts }).catch(() => {});
  }

  function say(text: string, { undo = false } = {}) {
    clearTimeout(statusTimer);
    statusText.textContent = text;
    if (!undo) undoSnapshot = null;
    if (!undo && document.activeElement === undoBtn) $reset.focus();
    undoBtn.hidden = !undo;
    bar.classList.add('on');
    if (!recording) statusTimer = setTimeout(hideStatus, undo ? 8000 : 4000);
  }

  // A região role=status fica sempre no DOM; só o texto muda.
  function hideStatus() {
    clearTimeout(statusTimer);
    if (document.activeElement === undoBtn) $reset.focus();
    statusText.textContent = '';
    undoBtn.hidden = true;
    bar.classList.remove('on');
    undoSnapshot = null;
  }

  function focusKey(id: string) {
    list.querySelectorAll<HTMLElement>('.key')[SPEEDIA_ACTIONS.findIndex((a) => a.id === id)]?.focus();
  }

  // Guarda o estado atual para o botão Desfazer antes de uma mudança destrutiva.
  function snapshot() {
    return { ...shortcuts };
  }

  function render() {
    list.replaceChildren(
      ...SPEEDIA_ACTIONS.map((a) => {
        const combo = shortcuts[a.id];
        const rec = recording === a.id;
        const pretty = speediaPretty(combo) || T.none;
        const key = h('button', {
          type: 'button',
          className: 'key' + (rec ? ' rec' : combo ? '' : ' empty'),
          textContent: rec ? T.pressKey : pretty,
          title: T.keyTitle,
          onclick: () => {
            recording = rec ? null : a.id;
            if (recording) say(T.recording(a.label));
            else hideStatus();
            render();
          },
        });
        key.setAttribute('aria-label', rec ? T.recording(a.label) : T.keyAria(a.label, pretty));
        const clear = h('button', {
          type: 'button',
          className: 'clear',
          textContent: '✕',
          title: T.clearTitle,
          onclick: () => {
            recording = null;
            undoSnapshot = snapshot();
            shortcuts[a.id] = '';
            save();
            say(T.cleared(a.label), { undo: true });
            render();
            focusKey(a.id);
          },
        });
        clear.setAttribute('aria-label', T.clearAria(a.label));
        clear.disabled = !combo;
        const item = h(
          'div',
          { className: 'item' + (flashId === a.id ? ' flash' : '') },
          h('div', { className: 'text' }, a.label, h('div', { className: 'hint', textContent: a.hint })),
          key,
          clear
        );
        return item;
      })
    );
    flashId = null;
    if (recording) list.querySelector<HTMLElement>('.rec')?.focus();
  }

  function cancelRecording(refocus = true) {
    if (!recording) return;
    const id = recording;
    recording = null;
    hideStatus();
    render();
    if (refocus) focusKey(id);
  }

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!recording) return;
      if (e.key === 'Tab') return cancelRecording(); // deixa o foco seguir
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return cancelRecording();
      const combo = speediaCombo(e);
      if (!combo) return; // só modificadores por enquanto
      const target = recording;
      undoSnapshot = snapshot();
      // A mesma tecla não pode disparar duas ações: a anterior perde o atalho.
      let taken: (typeof SPEEDIA_ACTIONS)[number] | undefined;
      for (const id in shortcuts) {
        if (id !== target && shortcuts[id] === combo) {
          shortcuts[id] = '';
          taken = SPEEDIA_ACTIONS.find((a) => a.id === id);
        }
      }
      shortcuts[target] = combo;
      recording = null;
      flashId = target;
      save();
      if (taken) say(T.conflict(speediaPretty(combo), taken.label), { undo: true });
      else say(T.saved);
      render();
      focusKey(target);
    },
    true
  );

  // Clicar fora da lista cancela a gravação (dentro dela, os próprios botões cuidam disso).
  document.addEventListener('mousedown', (e) => {
    if (recording && !(e.target as Element).closest('#shortcuts')) cancelRecording(false);
  });

  undoBtn.onclick = () => {
    if (!undoSnapshot) return;
    shortcuts = undoSnapshot;
    save();
    $reset.focus();
    hideStatus();
    render();
  };

  autoPip.onchange = () => chrome.storage.sync.set({ autoPip: autoPip.checked }).catch(() => {});
  tabPip.onchange = () => chrome.storage.sync.set({ tabPip: tabPip.checked }).catch(() => {});
  // Chrome só libera "Picture-in-picture automático" pelas configurações do site; extensão não altera essa permissão.
  if (!('requestPictureInPicture' in HTMLVideoElement.prototype)) byId('allowSiteItem').style.display = 'none';
  byId('allowSite').onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let url = 'chrome://settings/content/autoPictureInPicture';
    try {
      const { protocol, hostname, origin } = new URL(tab?.url ?? '');
      if (protocol === 'https:' && /(^|\.)(instagram\.com|x\.com|twitter\.com)$/.test(hostname)) {
        url = `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`;
      }
    } catch { /* sem URL (aba especial): página genérica */ }
    chrome.tabs.create({ url }).catch(() => {});
  };
  $reset.onclick = () => {
    recording = null;
    undoSnapshot = snapshot();
    shortcuts = speediaDefaultShortcuts();
    save();
    say(T.reset, { undo: true });
    render();
  };

  const defaults: Pick<Settings, 'autoPip' | 'tabPip' | 'shortcuts'> = { autoPip: true, tabPip: false, shortcuts: {} };
  (chrome.storage.sync.get(defaults) as Promise<typeof defaults>).then((s) => {
    autoPip.checked = s.autoPip;
    tabPip.checked = s.tabPip;
    shortcuts = { ...speediaDefaultShortcuts(), ...s.shortcuts };
    render();
  }).catch(() => render());

  // ---- Aparência: tema + cor principal (chaves 'theme' e 'accent' em storage.sync) ----
  const SWATCHES = [
    ['#3b82f6', 'popupColorBlue'], ['#06b6d4', 'popupColorCyan'], ['#22c55e', 'popupColorGreen'], ['#f59e0b', 'popupColorAmber'],
    ['#f97316', 'popupColorOrange'], ['#f43f5e', 'popupColorRose'], [SPEEDIA_DEFAULT_ACCENT, 'popupColorPurple'], ['#4b5563', 'popupColorGraphite'],
  ];
  const ring = byId<HTMLCanvasElement>('ring');
  const ringCenter = byId('ringCenter');
  const ringDot = byId('ringDot');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const RING = { size: 112, outer: 56, inner: 38 };
  let look: { theme: SpeediaTheme; accent: string } = { theme: speediaValidTheme(speediaCachedLook().theme), accent: speediaValidAccent(speediaCachedLook().accent) };
  let hue = 0;
  let dragging = false;
  let pending: Partial<Pick<Settings, 'theme' | 'accent'>> = {};
  let saveTimer = 0;

  function hslToHex(h: number, s = 75, l = 55) {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
    return '#' + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  function hexToHue(hex: string) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    if (!d) return hue; // cinza não tem matiz: mantém o anterior
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  }

  function applyLook() {
    speediaApplyLook(look);
    speediaCacheLook(look);
    const { accent } = look;
    ringCenter.textContent = accent;
    for (const i of document.querySelectorAll<HTMLInputElement>('input[name=theme]')) i.checked = i.value === look.theme;
    for (const i of document.querySelectorAll<HTMLInputElement>('input[name=accent]')) i.checked = i.value === accent;
    if (hslToHex(hue) !== accent) hue = hexToHue(accent); // evita o arredondamento do hex travar as setas
    ring.setAttribute('aria-valuenow', String(hue));
    ring.setAttribute('aria-valuetext', accent);
    const a = ((hue - 90) * Math.PI) / 180, r = (RING.outer + RING.inner) / 2;
    ringDot.style.left = RING.size / 2 + r * Math.cos(a) + 'px';
    ringDot.style.top = RING.size / 2 + r * Math.sin(a) + 'px';
  }

  // Grava com debounce: arrastar o anel dispara muitas mudanças.
  function saveLook(key: 'theme' | 'accent') {
    pending[key] = look[key];
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const out = pending;
      pending = {};
      chrome.storage.sync.set(out).catch(() => {});
    }, 200);
  }

  // Fechar o popup logo após arrastar não pode perder a última cor.
  addEventListener('pagehide', () => {
    if (!Object.keys(pending).length) return;
    clearTimeout(saveTimer);
    chrome.storage.sync.set(pending).catch(() => {});
    pending = {};
  });

  function setAccent(v: unknown) {
    look.accent = speediaValidAccent(v);
    applyLook();
    saveLook('accent');
  }

  function drawRing() {
    const dpr = window.devicePixelRatio || 1;
    ring.width = ring.height = RING.size * dpr;
    const ctx = ring.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const c = RING.size / 2;
    const g = ctx.createConicGradient(-Math.PI / 2, c, c);
    for (let i = 0; i <= 36; i++) g.addColorStop(i / 36, hslToHex(i * 10));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, RING.outer, 0, Math.PI * 2);
    ctx.arc(c, c, RING.inner, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }

  function pickHue(e: PointerEvent) {
    const r = ring.getBoundingClientRect();
    const a = Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2);
    setAccent(hslToHex(Math.round(((a * 180) / Math.PI + 450) % 360)));
  }
  ring.onpointerdown = (e) => {
    dragging = true;
    ring.setPointerCapture(e.pointerId);
    pickHue(e);
  };
  ring.onpointermove = (e) => dragging && pickHue(e);
  ring.onpointerup = ring.onpointercancel = () => (dragging = false);
  ring.onkeydown = (e) => {
    const step = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 } as Record<string, number | undefined>)[e.key];
    if (!step) return;
    e.preventDefault();
    setAccent(hslToHex((hue + step * (e.shiftKey ? 10 : 1) + 360) % 360));
  };

  const swatches = byId('swatches');
  swatches.append(
    ...SWATCHES.map(([hex, key]) => {
      const input = h('input', { type: 'radio', name: 'accent', value: hex, onchange: () => setAccent(hex) });
      input.setAttribute('aria-label', speediaMsg(key));
      const dot = h('span');
      dot.style.background = hex;
      dot.style.color = speediaOn(hex);
      return h('label', { className: 'sw', title: speediaMsg(key) }, input, dot);
    })
  );
  for (const i of document.querySelectorAll<HTMLInputElement>('input[name=theme]')) {
    i.onchange = () => {
      look.theme = speediaValidTheme(i.value);
      applyLook();
      saveLook('theme');
    };
  }
  byId('accentReset').onclick = () => setAccent(SPEEDIA_DEFAULT_ACCENT);
  dark.onchange = applyLook;
  drawRing();
  applyLook();

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync' || !(ch.theme || ch.accent)) return;
    // Ignora o eco das nossas próprias gravações enquanto há mudança local pendente.
    if (ch.theme && !('theme' in pending)) look.theme = speediaValidTheme(ch.theme.newValue);
    if (ch.accent && !('accent' in pending) && !dragging) look.accent = speediaValidAccent(ch.accent.newValue);
    applyLook();
  });
  chrome.storage.sync.get({ theme: 'auto', accent: SPEEDIA_DEFAULT_ACCENT }).then((s) => {
    look = { theme: speediaValidTheme(s.theme), accent: speediaValidAccent(s.accent) };
    applyLook();
  }).catch(() => {});

  render();
})();
