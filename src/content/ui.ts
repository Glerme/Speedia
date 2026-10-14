import { SPEEDS, STORE, canPip, settings, state, t } from './state';
import { speediaPretty } from '../shared/shortcuts';
import { setSpeed } from './speed';
// ---------------------------------------------------------------- interface
export const SEEK_H = 18; // altura da faixa de seek (CSS e posicionamento); não crescer: cobre botões nativos do Instagram
const CSS = `
    :host { --accent: #bf22ed; --accent-fg: #fff; --bg: rgba(0,0,0,.1); --bg-strong: rgba(0,0,0,.1); --bg-solid: rgba(18,18,22,.96); --bg-time: rgba(18,18,22,.94);
      --fg: #fff; --line: rgba(255,255,255,.16); --hover: rgba(255,255,255,.14); --press: rgba(255,255,255,.26);
      --bg-open: rgba(0,0,0,.06); --sheen-open: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03) 55%);
      --rim: linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.12) 50%, rgba(255,255,255,.28));
      --text-shadow: 0 1px 2px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.6); --icon-shadow: drop-shadow(0 1px 2px rgba(0,0,0,.85)) drop-shadow(0 0 6px rgba(0,0,0,.6));
      --shadow: 0 8px 32px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.1); --ease: cubic-bezier(.2,.8,.2,1); }
    /* Tema claro: vidro branco fosco, texto escuro, sem sombra pesada. O host recebe data-theme já resolvido (light|dark). */
    :host([data-theme=light]) { --bg: rgba(255,255,255,.72); --bg-strong: rgba(255,255,255,.78); --bg-solid: rgba(250,250,252,.97); --bg-time: rgba(255,255,255,.94);
      --fg: #111; --line: rgba(0,0,0,.14); --hover: rgba(0,0,0,.08); --press: rgba(0,0,0,.16);
      --bg-open: rgba(255,255,255,.66); --sheen-open: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.1) 55%);
      --rim: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.4) 50%, rgba(255,255,255,.7));
      --text-shadow: none; --icon-shadow: none; --shadow: 0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08); }
    /* Os quatro blocos animados escondem com display sem !important, para o display poder entrar na transição. */
    [hidden]:not(.bar):not(.seek):not(.mini) { display: none !important; }
    .bar, .seek, .time, .ctl { transition: opacity .18s var(--ease), background-color .15s, padding .15s, display .18s;
      transition-behavior: allow-discrete; }
    .mini { transition: opacity .18s var(--ease), transform .18s var(--ease), display .18s;
      transition-behavior: allow-discrete; }
    @starting-style { .bar, .mini, .seek { opacity: 0; } }
    button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; cursor: pointer; min-width: 28px; min-height: 28px; padding: 6px 11px; border-radius: 999px;
      font: inherit; color: inherit; white-space: nowrap; transition: background-color .12s, color .12s, transform .12s; }
    button:hover { background: var(--hover); }
    button:active { background: var(--press); transform: scale(.96); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; box-shadow: 0 0 0 4px rgba(255,255,255,.85); }
    /* Botões planos e transparentes; só o ativo (velocidade, Auto PiP) leva a cor de destaque. */
    .cur { border-radius: 999px; text-shadow: var(--text-shadow); }
    button.on { color: var(--accent-fg); background: var(--accent); text-shadow: none; }
    button.on:hover { filter: brightness(1.12); }
    button.on svg { filter: none; }
    button:focus-visible:is(*, .on) { box-shadow: 0 0 0 4px rgba(255,255,255,.85); }
    svg { flex: none; }
    .bar { position: fixed; top: 0; left: 0; display: flex; flex-direction: column; gap: 4px; padding: 5px;
      border-radius: 20px; background: var(--sheen), var(--bg); color: var(--fg); font: 600 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;
      box-shadow: var(--shadow); opacity: .95; user-select: none; }
    .bar:hover, .bar:focus-within { opacity: 1; background: var(--sheen), var(--bg-strong); padding: 8px; }
    .cur { padding: 7px 12px; font-variant-numeric: tabular-nums; }
    .row { display: none; align-items: center; gap: 2px; }
    .bar:hover .row, .bar:focus-within .row { display: flex; }
    .bar:hover .cur, .bar:focus-within .cur { display: none; }
    .row + .row { padding-top: 4px; border-top: 1px solid var(--line); }
    .bar.side { opacity: 1; padding: 8px; background: var(--sheen), var(--bg-strong); }
    .bar.side .cur { display: none; }
    .bar.side .row { display: flex; flex-direction: column; align-items: stretch; }
    .bar.side button { justify-content: center; }
    /* Depois de .bar:hover/.bar.side na cascata: força o fade de saída e solta os cliques já no primeiro frame. */
    :is(.bar, .bar.side, .mini, .seek)[hidden] { display: none; opacity: 0 !important; pointer-events: none !important; }
    .mini { position: fixed; right: 16px; bottom: 16px; border-radius: 14px; overflow: hidden; background: #000;
      box-shadow: var(--shadow), 0 0 0 1px var(--line); cursor: pointer; color: var(--fg);
      font: 600 15px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .mini canvas { display: block; width: 100%; height: 100%; }
    .ctl { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px; padding: 3px; border-radius: 999px;
      background: var(--sheen), var(--bg-strong); opacity: 0; }
    .mini:hover .ctl, .mini:focus-within .ctl { opacity: 1; }
    .prog { position: absolute; left: 0; bottom: 0; height: 4px; width: 0; background: var(--accent); pointer-events: none; }
    .seek { position: fixed; top: 0; left: 0; height: ${SEEK_H}px; display: flex; align-items: flex-end; cursor: pointer;
      touch-action: none; }
    .track { width: 100%; height: 4px; background: rgba(255,255,255,.35); box-shadow: 0 0 6px rgba(0,0,0,.4);
      transition: height .12s var(--ease); }
    .seek:hover .track, .seek.drag .track { height: 8px; }
    .fill { width: 0; height: 100%; background: var(--accent); }
    .time { position: absolute; left: 8px; bottom: 16px; padding: 6px 9px; border-radius: 8px; background: var(--bg-time);
      color: var(--fg); font: 600 13px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
      box-shadow: var(--shadow); opacity: 0; pointer-events: none; }
    .seek:hover .time, .seek.drag .time { opacity: 1; }
    .toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: min(80vw, 420px);
      padding: 10px 16px; border-radius: 12px; background: var(--sheen), var(--bg-strong); color: var(--fg);
      font: 500 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
      pointer-events: none; opacity: 0; visibility: hidden; transform: translateX(-50%) translateY(8px);
      transition: opacity .18s var(--ease), transform .18s var(--ease), visibility .18s; }
    /* Liquid glass claro (bar, ctl, toast): véu escuro mínimo + brilho branco suave em degradê. O brightness(.95) escurece só o que é claro
       no fundo, (a sombra do texto cuida do contraste sobre vídeo branco). */
    :host { --sheen: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.05) 55%, rgba(255,255,255,.04));
      --glass-fx: blur(20px) saturate(1.8) brightness(.95); }
    :host([data-theme=light]) { --sheen: linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,.12) 55%);
      --glass-fx: blur(20px) saturate(1.8) brightness(1.05); }
    .bar, .ctl, .toast { -webkit-backdrop-filter: var(--glass-fx); backdrop-filter: var(--glass-fx);
      box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -10px 16px -12px rgba(255,255,255,.18); }
    .ctl { box-shadow: 0 4px 16px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -6px 10px -8px rgba(255,255,255,.18); }
    /* Borda em degradê (clara em cima, some embaixo): pseudo-elemento com máscara, pois border-image não segue o radius. */
    .bar::before, .ctl::before, .toast::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
      background: var(--rim);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
      mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); pointer-events: none; }
    .bar, .ctl, .toast { text-shadow: var(--text-shadow); }
    .bar svg, .ctl svg { filter: var(--icon-shadow); }
    /* Lente suave só na borda (Chromium): mapa liso, neutro (128,128) no centro, #speedia-glass criado no shadow root.
       Só Chromium aceita url() no backdrop-filter; o Firefox perderia o blur, então a classe .distort é posta por JS apenas no Chromium. */
    :host(.distort) { --glass-fx: url(#speedia-glass) blur(20px) saturate(1.8) brightness(.95); }
    /* Aberta (hover/foco/lateral) mais transparente: menos véu e brightness maior; o contraste vem da sombra do texto. */
    :host { --glass-open: blur(20px) saturate(1.8) brightness(1); }
    :host(.distort) { --glass-open: url(#speedia-glass) blur(20px) saturate(1.8) brightness(1); }
    .bar:hover, .bar:focus-within, .bar.side { --glass-fx: var(--glass-open); --bg-strong: var(--bg-open); --sheen: var(--sheen-open); }
    .toast.show { opacity: 1; visibility: visible; transform: translateX(-50%); }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
      button:active { transform: none; }
      :host, :host(.distort) { --glass-fx: blur(20px) saturate(1.8) brightness(.95); --glass-open: blur(20px) saturate(1.8) brightness(1); }
    }
    @media (prefers-reduced-transparency: reduce) {
      .bar:hover, .bar:focus-within, .bar.side { --bg-strong: var(--bg-solid); --sheen: linear-gradient(transparent, transparent); }
      :host, :host([data-theme]) { --bg: var(--bg-solid); --bg-strong: var(--bg-solid); --sheen: linear-gradient(transparent, transparent); }
      .bar, .toast, .ctl { -webkit-backdrop-filter: none; backdrop-filter: none; }
      .bar::before, .ctl::before, .toast::before { display: none; }
    }
  `;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
    const el = document.createElement(tag);
    for (const k in props) {
        // aria-*/role via atributo: as propriedades refletidas não existem em navegadores mais antigos.
        if (k === 'role')
            el.setAttribute('role', String(props[k]));
        else if (k.startsWith('aria'))
            el.setAttribute('aria-' + k.slice(4).toLowerCase(), String(props[k]));
        else
            el[k] = props[k]!;
    }
    el.append(...children);
    return el;
}
function createUI() {
    const host = h('div', { id: 'speedia-host' });
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    // Distorção do vidro (url() no backdrop-filter) só no Chromium; no Firefox derrubaria o blur.
    if (('userAgentData' in navigator && navigator.userAgentData) && !/Firefox\//.test(navigator.userAgent))
        host.classList.add('distort');
    // Cliques na nossa interface não devem chegar aos handlers do site.
    for (const t of ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart']) {
        host.addEventListener(t, (e) => e.stopPropagation());
    }
    function icon(d: string) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        const attrs = { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor' };
        for (const [k, value] of Object.entries(attrs))
            svg.setAttribute(k, String(value));
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        svg.append(path);
        return svg;
    }
    const ICON_PIP = 'M3 5h18v14H3zM12 12h6v4h-6z';
    const ICON_DOWNLOAD = 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14';
    const ICON_SOUND = 'M4 9v6h4l5 4V5L8 9H4zM16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11';
    const ICON_MUTED = 'M4 9v6h4l5 4V5L8 9H4zM16 9.5l5 5m0-5l-5 5';
    const curLabel = h('div', { className: 'cur' });
    const speedBtns = SPEEDS.map((s) => h('button', { textContent: s + '×', title: t('ovSpeedTitle', s), ariaLabel: t('ovSpeedTitle', s), onclick: () => setSpeed(s) }));
    const pipBtn = h('button', { title: t('ovPipTitle'), ariaLabel: t('ovPipAria') }, icon(ICON_PIP), t('ovPipLabel'));
    const soundIcon = icon(ICON_SOUND);
    const mutedIcon = icon(ICON_MUTED);
    const muteLabel = h('span');
    const muteBtn = h('button', { title: t('ovMuteTitle'), ariaLabel: t('ovMuteTitle') }, soundIcon, mutedIcon, muteLabel);
    const autoBtn = h('button', {
        textContent: t('ovAutoPipLabel'),
        title: t('ovAutoPipTitle'),
        ariaLabel: t('ovAutoPipAria'),
    });
    const dlBtn = STORE ? null : h('button', { title: t('ovDownloadTitle'), ariaLabel: t('ovDownloadTitle') }, icon(ICON_DOWNLOAD), t('ovDownloadLabel'));
    const bar = h('div', { className: 'bar', hidden: true }, curLabel, h('div', { className: 'row' }, ...speedBtns), h('div', { className: 'row' }, ...[muteBtn, pipBtn, autoBtn, dlBtn].filter((node): node is HTMLButtonElement => node !== null)));
    const canvas = h('canvas', { title: t('ovBackToVideo'), role: 'button', tabIndex: 0, ariaLabel: t('ovBackToVideo') });
    const ctx = canvas.getContext('2d');
    const miniPlay = h('button', { textContent: '❚❚', title: t('ovPlayPauseTitle'), ariaLabel: t('ovPlayPauseAria') });
    const miniPip = h('button', { title: t('ovOpenPip'), ariaLabel: t('ovOpenPip') }, icon(ICON_PIP));
    const miniClose = h('button', { textContent: '✕', title: t('ovCloseTitle'), ariaLabel: t('ovCloseAria') });
    const prog = h('div', { className: 'prog' });
    const mini = h('div', { className: 'mini', hidden: true }, canvas, h('div', { className: 'ctl' }, miniPlay, miniPip, miniClose), prog);
    // Barra de progresso (só no Instagram, que não tem uma própria).
    const fill = h('div', { className: 'fill' });
    const timeEl = h('div', { className: 'time' });
    const seek = h('div', { className: 'seek', hidden: true }, h('div', { className: 'track' }, fill), timeEl);
    pipBtn.hidden = miniPip.hidden = !canPip;
    const toastEl = h('div', { className: 'toast', role: 'status', ariaLive: 'polite', ariaAtomic: 'true' });
    // Filtro de distorção do vidro. Fica no shadow root (url(#id) resolve ali, testado no Chrome) e só é usado quando o host tem a classe .distort (Chromium).
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const glassSvg = document.createElementNS(SVG_NS, 'svg');
    glassSvg.setAttribute('width', '0');
    glassSvg.setAttribute('height', '0');
    glassSvg.setAttribute('aria-hidden', 'true');
    glassSvg.style.cssText = 'position:absolute;pointer-events:none;';
    const glassFilter = document.createElementNS(SVG_NS, 'filter');
    const glassAttrs = { id: 'speedia-glass', x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' };
    for (const [k, value] of Object.entries(glassAttrs))
        glassFilter.setAttribute(k, String(value));
    // Mapa de deslocamento liso: R (x) e G (y) variam só nos ~14% da borda, 128 (neutro) no centro; 'screen' soma os canais disjuntos.
    const lensMap = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" preserveAspectRatio="none"><defs>'
        + '<linearGradient id="x"><stop offset="0" stop-color="rgb(255,0,0)"/><stop offset=".14" stop-color="rgb(128,0,0)"/><stop offset=".86" stop-color="rgb(128,0,0)"/><stop offset="1" stop-color="rgb(1,0,0)"/></linearGradient>'
        + '<linearGradient id="y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(0,255,0)"/><stop offset=".14" stop-color="rgb(0,128,0)"/><stop offset=".86" stop-color="rgb(0,128,0)"/><stop offset="1" stop-color="rgb(0,1,0)"/></linearGradient>'
        + '</defs><rect width="100" height="100" fill="#000"/><rect width="100" height="100" fill="url(#x)"/>'
        + '<rect width="100" height="100" fill="url(#y)" style="mix-blend-mode:screen"/></svg>');
    const lensImg = document.createElementNS(SVG_NS, 'feImage');
    const lensAttrs = { href: lensMap, x: 0, y: 0, width: '100%', height: '100%', preserveAspectRatio: 'none', result: 'map' };
    for (const [k, value] of Object.entries(lensAttrs))
        lensImg.setAttribute(k, String(value));
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    const dispAttrs = { in: 'SourceGraphic', in2: 'mapped', scale: 12, xChannelSelector: 'R', yChannelSelector: 'G' };
    for (const [k, value] of Object.entries(dispAttrs))
        disp.setAttribute(k, String(value));
    // Fallback neutro: se a CSP do site bloquear o data: URL do feImage, o mapa vira 128 liso e o backdrop não se move.
    const flood = document.createElementNS(SVG_NS, 'feFlood');
    flood.setAttribute('flood-color', 'rgb(128,128,128)');
    flood.setAttribute('result', 'neutral');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    merge.setAttribute('result', 'mapped');
    for (const n of ['neutral', 'map']) {
        const node = document.createElementNS(SVG_NS, 'feMergeNode');
        node.setAttribute('in', n);
        merge.append(node);
    }
    glassFilter.append(lensImg, flood, merge, disp);
    glassSvg.append(glassFilter);
    root.append(h('style', { textContent: CSS }), glassSvg, bar, seek, mini, toastEl);
    return { host, root, curLabel, speedBtns, pipBtn, soundIcon, mutedIcon, muteLabel, muteBtn, autoBtn, dlBtn, bar, canvas, ctx, miniPlay, miniPip, miniClose, prog, mini, fill, timeEl, seek, toastEl };
}
export let ui: ReturnType<typeof createUI>;
export function initializeUI() {
    ui = createUI();
    ui.seek.onpointerdown = (e) => {
        if (!state.seekVideo)
            return;
        state.dragging = true;
        ui.seek.classList.add('drag');
        ui.seek.setPointerCapture(e.pointerId);
        seekTo(e);
    };
    ui.seek.onpointermove = (e) => state.dragging && seekTo(e);
    ui.seek.onpointerup = ui.seek.onpointercancel = () => {
        state.dragging = false;
        ui.seek.classList.remove('drag');
    };
}
const fmt = (t: number) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
export function seekTick() {
    state.seekRaf = 0;
    if (ui.seek.hidden || !state.seekVideo)
        return;
    const d = state.seekVideo.duration;
    if (isFinite(d) && d > 0) {
        ui.fill.style.width = (state.seekVideo.currentTime / d) * 100 + '%';
        ui.timeEl.textContent = `${fmt(state.seekVideo.currentTime)} / ${fmt(d)}`;
    }
    state.seekRaf = requestAnimationFrame(seekTick);
}
function seekTo(e: PointerEvent) {
    const r = ui.seek.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (state.seekVideo && isFinite(state.seekVideo.duration))
        state.seekVideo.currentTime = f * state.seekVideo.duration;
}
let toastTimer = 0;
export function toast(text: string) {
    ui.toastEl.textContent = text;
    ui.toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toastEl.classList.remove('show'), 3500);
}
let muteKeyText = '';
export const muteText = () => t('ovMuteTitle') + muteKeyText;
// Botão alternável: classe visual + aria-pressed.
export function setPressed(btn: HTMLButtonElement, on: boolean) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
}
export function renderSettings() {
    ui.curLabel.textContent = settings.speed + '×';
    ui.speedBtns.forEach((b, i) => setPressed(b, SPEEDS[i] === settings.speed));
    setPressed(ui.autoBtn, settings.autoPip);
    const muteKey = speediaPretty(settings.shortcuts.mute);
    muteKeyText = muteKey ? ` (${muteKey})` : '';
    ui.muteBtn.title = t('ovMuteTitle') + muteKeyText;
    if (ui.muteLabel.textContent)
        ui.muteBtn.setAttribute('aria-label', muteText() + ': ' + t(ui.muteLabel.textContent === t('ovSoundLabel') ? 'ovMuteStateOn' : 'ovMuteStateOff'));
    else
        ui.muteBtn.setAttribute('aria-label', muteText());
}
// Em tela cheia só o fullscreenElement (e seus filhos) aparece no top layer: leva o host para dentro dele.
const NO_CHILDREN = /^(AREA|BASE|BR|COL|EMBED|HR|IMG|INPUT|LINK|META|SOURCE|TRACK|WBR|VIDEO|AUDIO|CANVAS|IFRAME|OBJECT|SELECT|TEXTAREA|SVG)$/i;
export function syncHost() {
    const fsEl = document.fullscreenElement;
    const want = fsEl instanceof Element && !NO_CHILDREN.test(fsEl.localName) && fsEl !== document.documentElement
        ? fsEl
        : document.documentElement;
    if (ui.host.parentNode !== want)
        want.append(ui.host);
}
