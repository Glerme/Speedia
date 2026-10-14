(() => {
  'use strict';

  const t = speediaMsg;
  const SPEEDS = [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const isIG = location.hostname.endsWith('instagram.com');
  const settings = { speed: 1, autoPip: true, shortcuts: speediaDefaultShortcuts() };
  // O Firefox não expõe a API de Picture-in-Picture para páginas nem extensões.
  const canPip = 'requestPictureInPicture' in HTMLVideoElement.prototype;

  // ---------------------------------------------------------------- mídia capturada (inject.js)

  const entries = new Map();
  window.addEventListener('speedia:media', (e) => {
    let list;
    try {
      list = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (!Array.isArray(list)) return;
    for (const m of list) {
      if (!m || typeof m.url !== 'string' || !m.id) continue;
      entries.delete(m.id);
      entries.set(m.id, m);
    }
    while (entries.size > 3000) entries.delete(entries.keys().next().value);
  });

  function igCode(v) {
    const link = v.closest('article')?.querySelector('a[href*="/p/"], a[href*="/reel/"]');
    const re = /\/(?:p|reel|reels)\/([\w-]+)/;
    return (link?.getAttribute('href') || '').match(re)?.[1] || location.pathname.match(re)?.[1] || null;
  }

  function tweetId(v) {
    const link = v.closest('article')?.querySelector('a[href*="/status/"]');
    const re = /\/status\/(\d+)/;
    return (link?.getAttribute('href') || '').match(re)?.[1] || location.pathname.match(re)?.[1] || null;
  }

  function findMedia(v) {
    const all = [...entries.values()];
    const dur = v.duration;
    const delta = (m) => (m.duration && isFinite(dur) ? Math.abs(m.duration - dur) : 1e9);
    let hit = null;

    if (isIG) {
      const code = igCode(v);
      const same = code ? all.filter((m) => m.code === code) : [];
      // Carrossel: vários vídeos no mesmo post, escolhe pela duração.
      if (same.length) hit = same.reduce((a, b) => (delta(b) < delta(a) ? b : a));
    } else if (v.poster) {
      const keys = [];
      try {
        keys.push(new URL(v.poster).pathname.replace(/\.\w+$/, ''));
      } catch {}
      const id = v.poster.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//)?.[1];
      if (id) keys.push(id);
      hit = all.find((m) => m.keys?.some((k) => keys.includes(k))) || null;
    }

    if (!hit) {
      const near = all.filter((m) => delta(m) < 0.12);
      if (near.length === 1) hit = near[0];
    }
    if (hit) return hit;

    const src = v.currentSrc || v.src || '';
    if (/^https:/.test(src) && !src.includes('.m3u8')) return { url: src };
    return null;
  }

  async function download(v) {
    const hit = findMedia(v);
    if (!hit) {
      toast(t('toastNoMedia'));
      return;
    }
    const name = isIG ? `instagram_${igCode(v) || Date.now()}` : `x_${tweetId(v) || Date.now()}`;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'download', url: hit.url, filename: name + '.mp4' });
      toast(res?.ok ? t('toastDownloadStarted') : t('toastDownloadFailed', res?.error || t('toastUnknownError')));
    } catch {
      toast(t('toastReloaded'));
    }
  }

  // ---------------------------------------------------------------- interface

  const SEEK_H = 18; // altura da faixa de seek (CSS e posicionamento); não crescer: cobre botões nativos do Instagram

  const CSS = `
    :host { --accent: #bf22ed; --accent-fg: #fff; --bg: rgba(0,0,0,.1); --bg-strong: rgba(0,0,0,.1); --bg-solid: rgba(18,18,22,.96); --bg-time: rgba(18,18,22,.94);
      --fg: #fff; --line: rgba(255,255,255,.16); --hover: rgba(255,255,255,.2); --press: rgba(255,255,255,.32);
      --shadow: 0 8px 32px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.1); --ease: cubic-bezier(.2,.8,.2,1); }
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
    /* Legibilidade local: véu escuro leve só atrás do conteúdo (botões e .cur); o vidro em volta continua claro. */
    :host { --chip: radial-gradient(ellipse at center, rgba(0,0,0,.48), rgba(0,0,0,.42)); --chip-cur: transparent; }
    .cur { border-radius: 999px; }
    :host .toast { background: var(--chip), var(--sheen), var(--bg-strong); }
    button:not(.on) { background: var(--chip); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
    /* Sem véu atrás do .cur (pedido do usuário): a legibilidade vem só da sombra do texto. */
    .cur { background: var(--chip-cur); text-shadow: 0 1px 2px rgba(0,0,0,.7), 0 0 8px rgba(0,0,0,.5); }
    button:not(.on):hover { background: linear-gradient(var(--hover), var(--hover)), var(--chip); }
    button:not(.on):active { background: linear-gradient(var(--press), var(--press)), var(--chip); }
    /* Velocidade ativa: gota de vidro roxa (accent translúcido + brilho interno). */
    button.on { color: var(--accent-fg); background: linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,0) 55%), linear-gradient(color-mix(in srgb, var(--accent) 62%, transparent), color-mix(in srgb, var(--accent) 62%, transparent)), var(--chip);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -3px 6px -2px rgba(255,255,255,.25), 0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent); }
    button.on:hover { filter: brightness(1.12); }
    /* Depois das regras de box-shadow acima: o halo de foco precisa vencer. */
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
       no fundo, (o véu local do .cur e dos botões, --chip, cuida do contraste sobre vídeo branco). */
    :host { --sheen: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.05) 55%, rgba(255,255,255,.04));
      --glass-fx: blur(20px) saturate(1.8) brightness(.95); }
    .bar, .ctl, .toast { -webkit-backdrop-filter: var(--glass-fx); backdrop-filter: var(--glass-fx);
      box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -10px 16px -12px rgba(255,255,255,.18); }
    .ctl { box-shadow: 0 4px 16px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -6px 10px -8px rgba(255,255,255,.18); }
    /* Borda em degradê (clara em cima, some embaixo): pseudo-elemento com máscara, pois border-image não segue o radius. */
    .bar::before, .ctl::before, .toast::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
      background: linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.12) 50%, rgba(255,255,255,.28));
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
      mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); pointer-events: none; }
    .bar, .ctl, .toast { text-shadow: 0 1px 2px rgba(0,0,0,.6), 0 0 8px rgba(0,0,0,.35); }
    .bar svg, .ctl svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)) drop-shadow(0 0 6px rgba(0,0,0,.35)); }
    /* Lente suave só na borda (Chromium): mapa liso, neutro (128,128) no centro, #speedia-glass criado no shadow root.
       Só Chromium aceita url() no backdrop-filter; o Firefox perderia o blur, então a classe .distort é posta por JS apenas no Chromium. */
    :host(.distort) { --glass-fx: url(#speedia-glass) blur(20px) saturate(1.8) brightness(.95); }
    /* Aberta (hover/foco/lateral) mais transparente: menos véu e brightness maior; o contraste vem do véu local (o .cur não tem véu, só sombra no texto; --chip nos botões, ~3:1; a gota roxa leva o --chip por baixo). */
    :host { --glass-open: blur(20px) saturate(1.8) brightness(1); }
    :host(.distort) { --glass-open: url(#speedia-glass) blur(20px) saturate(1.8) brightness(1); }
    .bar:hover, .bar:focus-within, .bar.side { --glass-fx: var(--glass-open); --bg-strong: rgba(0,0,0,.06); --sheen: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03) 55%); }
    .toast.show { opacity: 1; visibility: visible; transform: translateX(-50%); }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
      button:active { transform: none; }
      :host, :host(.distort) { --glass-fx: blur(20px) saturate(1.8) brightness(.95); --glass-open: blur(20px) saturate(1.8) brightness(1); }
    }
    @media (prefers-reduced-transparency: reduce) {
      .bar:hover, .bar:focus-within, .bar.side { --bg-strong: var(--bg-solid); --sheen: linear-gradient(transparent, transparent); }
      :host { --bg: var(--bg-solid); --bg-strong: var(--bg-solid); --sheen: linear-gradient(transparent, transparent); }
      .bar, .toast, .ctl { -webkit-backdrop-filter: none; backdrop-filter: none; }
      .bar::before, .ctl::before, .toast::before { display: none; }
    }
  `;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const k in props) {
      // aria-*/role via atributo: as propriedades refletidas não existem em navegadores mais antigos.
      if (k === 'role') el.setAttribute('role', props[k]);
      else if (k.startsWith('aria')) el.setAttribute('aria-' + k.slice(4).toLowerCase(), props[k]);
      else el[k] = props[k];
    }
    el.append(...children);
    return el;
  }

  const host = h('div', { id: 'speedia-host' });
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  // Distorção do vidro (url() no backdrop-filter) só no Chromium; no Firefox derrubaria o blur.
  if (navigator.userAgentData && !/Firefox\//.test(navigator.userAgent)) host.classList.add('distort');
  // Cliques na nossa interface não devem chegar aos handlers do site.
  for (const t of ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart']) {
    host.addEventListener(t, (e) => e.stopPropagation());
  }

  function icon(d) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const attrs = { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor' };
    for (const k in attrs) svg.setAttribute(k, attrs[k]);
    svg.setAttribute('stroke-width', 2);
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
  const dlBtn = h('button', { title: t('ovDownloadTitle'), ariaLabel: t('ovDownloadTitle') }, icon(ICON_DOWNLOAD), t('ovDownloadLabel'));
  const bar = h(
    'div',
    { className: 'bar', hidden: true },
    curLabel,
    h('div', { className: 'row' }, ...speedBtns),
    h('div', { className: 'row' }, muteBtn, pipBtn, autoBtn, dlBtn)
  );

  const canvas = h('canvas', { title: t('ovBackToVideo'), role: 'button', tabIndex: 0, ariaLabel: t('ovBackToVideo') });
  const ctx = canvas.getContext('2d');
  const miniPlay = h('button', { textContent: '❚❚', title: t('ovPlayPauseTitle'), ariaLabel: t('ovPlayPauseAria') });
  const miniPip = h('button', { title: t('ovOpenPip'), ariaLabel: t('ovOpenPip') }, icon(ICON_PIP));
  const miniClose = h('button', { textContent: '✕', title: t('ovCloseTitle'), ariaLabel: t('ovCloseAria') });
  const prog = h('div', { className: 'prog' });
  const mini = h(
    'div',
    { className: 'mini', hidden: true },
    canvas,
    h('div', { className: 'ctl' }, miniPlay, miniPip, miniClose),
    prog
  );

  // Barra de progresso (só no Instagram, que não tem uma própria).
  const fill = h('div', { className: 'fill' });
  const timeEl = h('div', { className: 'time' });
  const seek = h('div', { className: 'seek', hidden: true }, h('div', { className: 'track' }, fill), timeEl);

  pipBtn.hidden = miniPip.hidden = !canPip;

  const toastEl = h('div', { className: 'toast', role: 'status', ariaLive: 'polite', ariaAtomic: 'true' });
  // Filtro de distorção do vidro. Fica no shadow root (url(#id) resolve ali, testado no Chrome) e só é usado quando o host tem a classe .distort (Chromium).
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const glassSvg = document.createElementNS(SVG_NS, 'svg');
  glassSvg.setAttribute('width', 0);
  glassSvg.setAttribute('height', 0);
  glassSvg.setAttribute('aria-hidden', 'true');
  glassSvg.style.cssText = 'position:absolute;pointer-events:none;';
  const glassFilter = document.createElementNS(SVG_NS, 'filter');
  const glassAttrs = { id: 'speedia-glass', x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' };
  for (const k in glassAttrs) glassFilter.setAttribute(k, glassAttrs[k]);
  // Mapa de deslocamento liso: R (x) e G (y) variam só nos ~14% da borda, 128 (neutro) no centro; 'screen' soma os canais disjuntos.
  const lensMap = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" preserveAspectRatio="none"><defs>'
    + '<linearGradient id="x"><stop offset="0" stop-color="rgb(255,0,0)"/><stop offset=".14" stop-color="rgb(128,0,0)"/><stop offset=".86" stop-color="rgb(128,0,0)"/><stop offset="1" stop-color="rgb(1,0,0)"/></linearGradient>'
    + '<linearGradient id="y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(0,255,0)"/><stop offset=".14" stop-color="rgb(0,128,0)"/><stop offset=".86" stop-color="rgb(0,128,0)"/><stop offset="1" stop-color="rgb(0,1,0)"/></linearGradient>'
    + '</defs><rect width="100" height="100" fill="#000"/><rect width="100" height="100" fill="url(#x)"/>'
    + '<rect width="100" height="100" fill="url(#y)" style="mix-blend-mode:screen"/></svg>');
  const lensImg = document.createElementNS(SVG_NS, 'feImage');
  const lensAttrs = { href: lensMap, x: 0, y: 0, width: '100%', height: '100%', preserveAspectRatio: 'none', result: 'map' };
  for (const k in lensAttrs) lensImg.setAttribute(k, lensAttrs[k]);
  const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
  const dispAttrs = { in: 'SourceGraphic', in2: 'mapped', scale: 12, xChannelSelector: 'R', yChannelSelector: 'G' };
  for (const k in dispAttrs) disp.setAttribute(k, dispAttrs[k]);
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

  let seekVideo = null;
  let dragging = false;
  let seekRaf = 0;

  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  function seekTick() {
    seekRaf = 0;
    if (seek.hidden || !seekVideo) return;
    const d = seekVideo.duration;
    if (isFinite(d) && d > 0) {
      fill.style.width = (seekVideo.currentTime / d) * 100 + '%';
      timeEl.textContent = `${fmt(seekVideo.currentTime)} / ${fmt(d)}`;
    }
    seekRaf = requestAnimationFrame(seekTick);
  }

  function seekTo(e) {
    const r = seek.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (seekVideo && isFinite(seekVideo.duration)) seekVideo.currentTime = f * seekVideo.duration;
  }

  seek.onpointerdown = (e) => {
    if (!seekVideo) return;
    dragging = true;
    seek.classList.add('drag');
    seek.setPointerCapture(e.pointerId);
    seekTo(e);
  };
  seek.onpointermove = (e) => dragging && seekTo(e);
  seek.onpointerup = seek.onpointercancel = () => {
    dragging = false;
    seek.classList.remove('drag');
  };

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }

  let muteKeyText = '';
  const muteText = () => t('ovMuteTitle') + muteKeyText;

  // Botão alternável: classe visual + aria-pressed.
  function setPressed(btn, on) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  function renderSettings() {
    curLabel.textContent = settings.speed + '×';
    speedBtns.forEach((b, i) => setPressed(b, SPEEDS[i] === settings.speed));
    setPressed(autoBtn, settings.autoPip);
    const muteKey = speediaPretty(settings.shortcuts.mute);
    muteKeyText = muteKey ? ` (${muteKey})` : '';
    muteBtn.title = t('ovMuteTitle') + muteKeyText;
    if (muteLabel.textContent) muteBtn.setAttribute('aria-label', muteText() + ': ' + t(muteLabel.textContent === t('ovSoundLabel') ? 'ovMuteStateOn' : 'ovMuteStateOff'));
    else muteBtn.setAttribute('aria-label', muteText());
  }

  // ---------------------------------------------------------------- velocidade

  function applySpeed(v) {
    // Transmissões ao vivo não têm duração finita; acelerar só causaria travamento.
    if (v.readyState > 0 && !isFinite(v.duration)) return;
    if (v.playbackRate !== settings.speed) v.playbackRate = settings.speed;
  }

  // A velocidade não é salva: toda página começa em 1× e a escolha vale até recarregar.
  function setSpeed(s) {
    settings.speed = s;
    renderSettings();
    document.querySelectorAll('video').forEach(applySpeed);
  }

  // Sobe ou desce uma fase na lista de velocidades, parando nas pontas.
  function stepSpeed(dir) {
    const i = SPEEDS.indexOf(settings.speed);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + dir))];
    if (next !== settings.speed) setSpeed(next);
    toast(t('toastSpeed', next));
  }

  // ---------------------------------------------------------------- mini player / PiP

  let active = null; // vídeo ao qual a barra está presa
  let pinned = null; // vídeo no mini player ou no PiP nativo
  let mode = null; // 'mini' | 'native'
  let drawRaf = 0;
  let lastInput = 0;
  const armed = new Set(); // tocando com som e já vistos na tela
  const autoPaused = new WeakMap(); // pausados pelo site (não pelo usuário) -> quando
  const suppressed = new WeakSet(); // dispensados pelo usuário até voltarem à tela
  const mutedByUs = new Set();

  const audible = (v) => !v.muted && v.volume > 0;
  const recentInput = () => performance.now() - lastInput < 600;
  // Reels e stories trocam de vídeo ao rolar; ali o mini player só atrapalharia.
  const autoAllowed = () => !(isIG && /^\/(reels?|stories)\//.test(location.pathname));

  function vis(v) {
    const r = v.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const hgt = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    const area = Math.max(0, w) * Math.max(0, hgt);
    const full = Math.min(r.width * r.height, innerWidth * innerHeight);
    return { r, area, ratio: full ? area / full : 0 };
  }

  // Vídeo encoberto por outro: o Instagram mantém o feed montado atrás do visualizador de Reels.
  function covered(v, r) {
    const x = (Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2;
    const y = (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2;
    const top = document.elementsFromPoint(x, y).find((el) => el instanceof HTMLVideoElement);
    return !!top && top !== v;
  }

  function sizeMini(v) {
    const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    const maxH = innerHeight * 0.42;
    let w = 340;
    let hgt = w / ar;
    if (hgt > maxH) {
      hgt = maxH;
      w = hgt * ar;
    }
    mini.style.width = Math.round(w) + 'px';
    mini.style.height = Math.round(hgt) + 'px';
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(hgt * devicePixelRatio);
  }

  function draw() {
    if (!pinned || mode !== 'mini') return;
    const v = pinned;
    if (v.readyState >= 2) {
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      } catch {}
    }
    prog.style.width = (v.duration ? (v.currentTime / v.duration) * 100 : 0) + '%';
    miniPlay.textContent = v.paused ? '▶' : '❚❚';
    drawRaf = requestAnimationFrame(draw);
  }

  function muteOther(v) {
    v.muted = true;
    mutedByUs.add(v);
  }

  function pin(v, m) {
    if (pinned && pinned !== v) unpin();
    pinned = v;
    mode = m;
    for (const o of document.querySelectorAll('video')) {
      if (o !== v && !o.paused && audible(o)) muteOther(o);
    }
    cancelAnimationFrame(drawRaf);
    if (m === 'mini') {
      sizeMini(v);
      mini.hidden = false;
      if (v.paused) v.play().catch(() => {});
      draw();
    } else {
      mini.hidden = true;
    }
  }

  function unpin() {
    if (!pinned) return;
    delete pinned.dataset.speediaPin;
    pinned = null;
    mode = null;
    mini.hidden = true;
    cancelAnimationFrame(drawRaf);
    for (const o of mutedByUs) if (o.isConnected && o.muted) o.muted = false;
    mutedByUs.clear();
  }

  // Fecha de vez: para o vídeo e não reabre até ele voltar à tela.
  function dismiss() {
    const v = pinned;
    if (!v) return;
    const wasNative = mode === 'native';
    unpin();
    suppressed.add(v);
    armed.delete(v);
    v.pause();
    if (wasNative && document.pictureInPictureElement === v) document.exitPictureInPicture().catch(() => {});
  }

  async function togglePip(v) {
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
        return;
      }
      v.removeAttribute('disablepictureinpicture');
      await v.requestPictureInPicture();
    } catch (e) {
      toast(t('toastPipFail', e.message));
    }
  }

  pipBtn.onclick = () => active && togglePip(active);
  function toggleMute(v) {
    const unmute = !audible(v);
    v.muted = !unmute;
    if (unmute && v.volume === 0) v.volume = 1;
  }

  muteBtn.onclick = () => active && toggleMute(active);
  dlBtn.onclick = () => active && download(active);
  autoBtn.onclick = () => {
    settings.autoPip = !settings.autoPip;
    chrome.storage.sync.set({ autoPip: settings.autoPip }).catch(() => {});
    renderSettings();
    if (!settings.autoPip && mode === 'mini') unpin();
  };
  const backToVideo = () => pinned?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  canvas.onclick = backToVideo;
  canvas.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      backToVideo();
    }
  };
  miniPlay.onclick = () => pinned && (pinned.paused ? pinned.play().catch(() => {}) : pinned.pause());
  miniPip.onclick = () => pinned && togglePip(pinned);
  miniClose.onclick = dismiss;

  // ---------------------------------------------------------------- laço de atualização

  let mx = -1;
  let my = -1;
  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  // Oclusão por barras fixas do site (cabeçalho do X, nav do Instagram). Estilos cacheados por frame.
  let styleCache = new Map();
  let sideW = 0;
  function isFixedish(el) {
    let p = styleCache.get(el);
    if (p === undefined) {
      const pos = getComputedStyle(el).position;
      p = pos === 'fixed' || pos === 'sticky';
      styleCache.set(el, p);
    }
    return p;
  }

  // Sem hit-test do vídeo: só vale cabeçalho/rodapé parcial, não fundo fixo nem tela cheia atrás do vídeo.
  function plausibleOccluder(n, v) {
    const ob = n.getBoundingClientRect();
    const vr = v.getBoundingClientRect();
    if (ob.width >= innerWidth * 0.98 && ob.height >= innerHeight * 0.98) return false;
    return ob.top > vr.top || (ob.top <= vr.top && ob.bottom < vr.bottom);
  }

  // Oclusor = ancestral fixed/sticky, fora do vídeo e do player, que cobre o ponto antes de o vídeo aparecer.
  function occluderAt(v, x, y) {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;
    const list = document.elementsFromPoint(x, y);
    const idx = list.indexOf(v);
    // Vídeo fora do hit-test (pointer-events: none etc.): compara geometricamente com qualquer fixed/sticky no ponto.
    const end = idx < 0 ? list.length : idx;
    const player = v.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]') || v.parentElement;
    for (let i = 0; i < end; i++) {
      const el = list[i];
      if (el === host || el.contains(v) || (player && player.contains(el))) continue;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        if (isFixedish(n)) {
          if (n.contains(v)) break;
          if (idx < 0 && !plausibleOccluder(n, v)) break;
          return n;
        }
      }
    }
    return null;
  }

  // Desce y abaixo de cabeçalhos fixos (máx. 3 empilhados); Infinity se coberto por barra inferior.
  function clearTop(v, x, y) {
    for (let i = 0; i < 3; i++) {
      const occ = occluderAt(v, x + 4, y + 4);
      if (!occ) break;
      const ob = occ.getBoundingClientRect();
      if (ob.top > innerHeight / 2) return Infinity;
      if (ob.bottom + 8 <= y) break;
      y = ob.bottom + 8;
    }
    return y;
  }

  function update() {
    scheduled = false;
    styleCache = new Map();
    if (!host.isConnected && !host.parentNode) document.documentElement.append(host);
    syncHost();
    const fs = host.parentNode !== document.documentElement;
    // Ancestral com transform/filter vira o bloco de contenção do fixed: compensa a origem.
    const hr = fs ? host.getBoundingClientRect() : null;
    const ox = hr ? hr.left : 0;
    const oy = hr ? hr.top : 0;
    if (fs && mode === 'mini') unpin();

    let best = null;
    let bestRect = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const { r, area, ratio } = vis(v);
      if (r.width < 120 || r.height < 80) continue;
      if (area && covered(v, r)) continue;
      if (ratio >= 0.6) {
        suppressed.delete(v);
        if (!v.paused && audible(v)) armed.add(v);
      }
      if (!area) continue;
      // Prioriza o vídeo sob o mouse, depois o que está tocando, depois o maior.
      let score = area;
      if (!v.paused) score *= 3;
      if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) score *= 10;
      if (score > bestScore) {
        bestScore = score;
        best = v;
        bestRect = r;
      }
    }

    active = best;
    const onScreen = best && bestRect.bottom > 48 && bestRect.top < innerHeight - 48;
    if (onScreen) {
      const inFeed = !fs && isIG && !!best.closest('article');
      const wantSide = !fs && isIG && !inFeed && /^\/reels?\//.test(location.pathname);
      let x = Math.max(bestRect.left, 0) + 8;
      // No feed do Instagram o topo do vídeo é coberto pelo avatar e nome do perfil.
      let y = Math.max(bestRect.top + (inFeed ? 60 : 8), 8);
      let hideBar = false;
      // sideW: largura medida com a barra em .side; permite decidir side/fallback sem exibi-la antes.
      let useSide = wantSide && !(sideW && bestRect.left - 12 - sideW < 8);
      // Decide a oclusão antes de mostrar a barra: ler offsetWidth de uma barra recém-exibida
      // força o estilo e dispara a transição de saída, deixando um fantasma em (0,0).
      if (!fs && !useSide) {
        y = clearTop(best, x, wantSide ? Math.max(bestRect.top + 8, 8) : y);
        hideBar = y > bestRect.bottom - 48;
      }
      if (hideBar) {
        bar.hidden = true;
      } else {
        bar.hidden = false;
        // No Reels a barra fica em coluna fora do vídeo, à esquerda, se houver espaço.
        bar.classList.toggle('side', useSide);
        if (useSide) {
          sideW = bar.offsetWidth;
          x = bestRect.left - 12 - sideW;
          y = Math.max(bestRect.top, 8);
          if (x < 8) {
            // Só na primeira medição: nos frames seguintes sideW já decide antes de exibir.
            bar.classList.remove('side');
            x = Math.max(bestRect.left, 0) + 8;
            y = clearTop(best, x, Math.max(bestRect.top + 8, 8));
            if (y > bestRect.bottom - 48) bar.hidden = true;
          }
        }
        if (fs) {
          x = 8;
          y = 8;
        }
        if (!bar.hidden) bar.style.transform = `translate(${Math.round(x - ox)}px, ${Math.round(y - oy)}px)`;
      }
      setPressed(pipBtn, document.pictureInPictureElement === best);
      const sound = audible(best);
      soundIcon.toggleAttribute('hidden', !sound);
      mutedIcon.toggleAttribute('hidden', sound);
      muteLabel.textContent = sound ? t('ovSoundLabel') : t('ovMutedLabel');
      muteBtn.setAttribute('aria-label', muteText() + (': ' + t(sound ? 'ovMuteStateOn' : 'ovMuteStateOff')));
    } else {
      bar.hidden = true;
    }

    // Durante o arraste a barra fica presa ao vídeo em que o arraste começou.
    if (isIG && !dragging) {
      if (onScreen && isFinite(best.duration) && best.duration > 0) {
        seekVideo = best;
        let y = Math.min(bestRect.bottom, innerHeight) - SEEK_H;
        // Sobe até o topo de barras fixas inferiores; some se sobrar pouco vídeo.
        if (!fs) {
          const sx = Math.min(Math.max(bestRect.left, 0) + 8, innerWidth - 1);
          for (let i = 0; i < 2; i++) {
            const occ = occluderAt(best, sx, y + SEEK_H / 2);
            if (!occ) break;
            const nt = occ.getBoundingClientRect().top - SEEK_H;
            if (nt >= y) break;
            y = nt;
          }
        }
        if (y < Math.max(bestRect.top, 0) + 48) {
          seek.hidden = true;
          seekVideo = null;
        } else {
          seek.style.transform = `translate(${Math.round(bestRect.left - ox)}px, ${Math.round(y - oy)}px)`;
          seek.style.width = Math.round(bestRect.width) + 'px';
          seek.hidden = false;
          if (!seekRaf) seekRaf = requestAnimationFrame(seekTick);
        }
      } else {
        seek.hidden = true;
        seekVideo = null;
      }
    }

    if (pinned) {
      if (!pinned.isConnected) {
        unpin();
      } else {
        const { ratio } = vis(pinned);
        if (mode === 'mini' && ratio >= 0.6) unpin();
        else if (ratio < 0.6) pinned.dataset.speediaPin = '1';
        else delete pinned.dataset.speediaPin;
      }
    }

    if (!fs && !pinned && settings.autoPip && autoAllowed()) {
      for (const v of armed) {
        if (!v.isConnected) {
          armed.delete(v);
          continue;
        }
        if (suppressed.has(v) || !audible(v)) continue;
        // O site costuma pausar o vídeo um pouco antes de ele sair da tela.
        const sitePaused = performance.now() - (autoPaused.get(v) || -1e9) < 3000;
        if (v.paused && !sitePaused) continue;
        const { r, ratio } = vis(v);
        if (r.width && ratio < 0.35) {
          pin(v, 'mini');
          pinned.dataset.speediaPin = '1';
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- eventos

  for (const t of ['pointerdown', 'click']) {
    window.addEventListener(t, (e) => e.isTrusted && (lastInput = performance.now()), true);
  }
  window.addEventListener(
    'mousemove',
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      schedule();
    },
    { capture: true, passive: true }
  );
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  setInterval(schedule, 1000);

  const isVideo = (e) => e.target instanceof HTMLVideoElement;
  const on = (type, fn) => document.addEventListener(type, (e) => isVideo(e) && fn(e.target), true);

  // Outro vídeo ganhou som enquanto há um preso: se foi o usuário, troca; senão, silencia.
  function onOtherAudible(v) {
    if (!pinned || v === pinned || v.paused || !audible(v)) return;
    if (recentInput()) dismiss();
    else muteOther(v);
  }

  on('play', (v) => {
    applySpeed(v);
    autoPaused.delete(v);
    onOtherAudible(v);
    schedule();
  });
  on('pause', (v) => {
    if (recentInput()) armed.delete(v);
    else autoPaused.set(v, performance.now());
    schedule();
  });
  on('volumechange', (v) => {
    if (!audible(v)) {
      armed.delete(v);
      if (v === pinned && recentInput()) dismiss();
    } else {
      onOtherAudible(v);
    }
    schedule();
  });
  on('ratechange', applySpeed);
  on('loadedmetadata', (v) => {
    applySpeed(v);
    if (v === pinned && mode === 'mini') sizeMini(v);
    schedule();
  });
  on('ended', (v) => v === pinned && !v.loop && unpin());
  on('emptied', (v) => v === pinned && unpin());
  on('enterpictureinpicture', (v) => {
    pin(v, 'native');
    schedule();
  });
  on('leavepictureinpicture', (v) => {
    if (v === pinned && mode === 'native') {
      unpin();
      // Fechou a janela com o vídeo fora da tela: não reabrir como mini player.
      if (vis(v).ratio < 0.6) suppressed.add(v);
    }
    schedule();
  });

  // Atalhos de teclado (editáveis no popup). Tela cheia: vídeo com som (o preso, senão o da barra, senão o mais visível).
  function fullscreenTarget() {
    const ok = (v) => v && v.isConnected && audible(v);
    if (ok(pinned)) return pinned;
    if (ok(active)) return active;
    let best = null;
    let bestArea = 0;
    for (const v of document.querySelectorAll('video')) {
      if (v.paused || !audible(v)) continue;
      const { r, area } = vis(v);
      if (area > bestArea && !covered(v, r)) {
        bestArea = area;
        best = v;
      }
    }
    return best;
  }

  // Em tela cheia só o fullscreenElement (e seus filhos) aparece no top layer: leva o host para dentro dele.
  const NO_CHILDREN = /^(AREA|BASE|BR|COL|EMBED|HR|IMG|INPUT|LINK|META|SOURCE|TRACK|WBR|VIDEO|AUDIO|CANVAS|IFRAME|OBJECT|SELECT|TEXTAREA|SVG)$/i;
  function syncHost() {
    const fsEl = document.fullscreenElement;
    const want =
      fsEl instanceof Element && !NO_CHILDREN.test(fsEl.localName) && fsEl !== document.documentElement
        ? fsEl
        : document.documentElement;
    if (host.parentNode !== want) want.append(host);
  }

  let addedControls = null; // vídeo que ganhou controles nativos só durante a tela cheia
  document.addEventListener('fullscreenchange', () => {
    if (addedControls && document.fullscreenElement !== addedControls) {
      addedControls.controls = false;
      addedControls = null;
    }
    syncHost();
    schedule();
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.isTrusted || e.repeat) return;
      const combo = speediaCombo(e);
      const action = combo && Object.keys(settings.shortcuts).find((id) => settings.shortcuts[id] === combo);
      if (!action) return;
      const tgt = e.composedPath()[0];
      if (tgt instanceof Element && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
      if (action === 'speedUp' || action === 'speedDown' || action === 'speedReset') {
        if (!active && !pinned) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (action === 'speedReset') {
          setSpeed(1);
          toast(t('toastSpeed', 1));
        } else {
          stepSpeed(action === 'speedUp' ? 1 : -1);
        }
        return;
      }
      if (action === 'mute') {
        const target = document.fullscreenElement instanceof HTMLVideoElement ? document.fullscreenElement : active || pinned;
        if (!target) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        lastInput = performance.now();
        toggleMute(target);
        return;
      }
      const fs = document.fullscreenElement;
      // Tela cheia do próprio site: não interfere.
      if (fs && !(fs instanceof HTMLVideoElement)) return;
      const v = fs || fullscreenTarget();
      if (!v) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (fs) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      const hadControls = v.controls;
      v.requestFullscreen().then(
        () => {
          if (!hadControls) {
            v.controls = true;
            addedControls = v;
          }
        },
        (err) => toast(t('toastFullscreenFail', err.message))
      );
    },
    true
  );

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

  const withDefaults = (saved) => ({ ...speediaDefaultShortcuts(), ...saved });
  chrome.storage.sync.get({ autoPip: true, shortcuts: {} }).then((s) => {
    settings.autoPip = s.autoPip;
    settings.shortcuts = withDefaults(s.shortcuts);
    renderSettings();
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoPip) {
      settings.autoPip = changes.autoPip.newValue;
      if (!settings.autoPip && mode === 'mini') unpin();
    }
    if (changes.shortcuts) settings.shortcuts = withDefaults(changes.shortcuts.newValue);
    renderSettings();
  });

  renderSettings();
  schedule();
})();
