(() => {
  'use strict';

  const SPEEDS = [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const isIG = location.hostname.endsWith('instagram.com');
  const settings = { speed: 1, autoPip: true };
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
      toast('Não achei o arquivo deste vídeo. Recarregue a página e dê play nele antes de baixar.');
      return;
    }
    const name = isIG ? `instagram_${igCode(v) || Date.now()}` : `x_${tweetId(v) || Date.now()}`;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'download', url: hit.url, filename: name + '.mp4' });
      toast(res?.ok ? 'Download iniciado' : 'Falha no download: ' + (res?.error || 'erro desconhecido'));
    } catch {
      toast('A extensão foi recarregada. Atualize a página.');
    }
  }

  // ---------------------------------------------------------------- interface

  const CSS = `
    [hidden] { display: none !important; }
    button { all: unset; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; padding: 8px 11px;
      border-radius: 999px; font: inherit; color: inherit; white-space: nowrap; }
    button:hover { background: rgba(255,255,255,.2); }
    button.on { background: #fff; color: #111; }
    .bar { position: fixed; top: 0; left: 0; display: flex; flex-direction: column; gap: 4px; padding: 5px;
      border-radius: 22px; background: rgba(15,15,15,.6); color: #fff; font: 600 14px/1 system-ui, sans-serif;
      opacity: .8; transition: opacity .15s; user-select: none; }
    .bar:hover { opacity: 1; background: rgba(15,15,15,.92); padding: 8px; }
    .cur { padding: 7px 12px; }
    .row { display: none; align-items: center; gap: 2px; }
    .bar:hover .row { display: flex; }
    .bar:hover .cur { display: none; }
    .row + .row { padding-top: 4px; border-top: 1px solid rgba(255,255,255,.18); }
    .bar.side { opacity: 1; padding: 8px; background: rgba(38,38,38,.92); }
    .bar.side .cur { display: none; }
    .bar.side .row { display: flex; flex-direction: column; align-items: stretch; }
    .bar.side button { justify-content: center; }
    .mini { position: fixed; right: 16px; bottom: 16px; border-radius: 12px; overflow: hidden; background: #000;
      box-shadow: 0 8px 30px rgba(0,0,0,.5); cursor: pointer; color: #fff; font: 600 15px/1 system-ui, sans-serif; }
    .mini canvas { display: block; width: 100%; height: 100%; }
    .ctl { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px; padding: 3px; border-radius: 999px;
      background: rgba(15,15,15,.75); opacity: 0; transition: opacity .15s; }
    .mini:hover .ctl { opacity: 1; }
    .prog { position: absolute; left: 0; bottom: 0; height: 4px; width: 0; background: #fff; pointer-events: none; }
    .seek { position: fixed; top: 0; left: 0; height: 18px; display: flex; align-items: flex-end; cursor: pointer;
      touch-action: none; }
    .track { width: 100%; height: 4px; background: rgba(255,255,255,.35); transition: height .1s; }
    .seek:hover .track, .seek.drag .track { height: 8px; }
    .fill { width: 0; height: 100%; background: #fff; }
    .time { position: absolute; left: 8px; bottom: 14px; padding: 5px 8px; border-radius: 8px;
      background: rgba(15,15,15,.8); color: #fff; font: 600 13px/1 system-ui, sans-serif; opacity: 0;
      pointer-events: none; transition: opacity .15s; }
    .seek:hover .time, .seek.drag .time { opacity: 1; }
    .toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: 80vw; padding: 10px 16px;
      border-radius: 10px; background: rgba(15,15,15,.92); color: #fff; font: 500 13px/1.4 system-ui, sans-serif; }
  `;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    el.append(...children);
    return el;
  }

  const host = h('div', { id: 'speedia-host' });
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
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
  const speedBtns = SPEEDS.map((s) => h('button', { textContent: s + '×', onclick: () => setSpeed(s) }));
  const pipBtn = h('button', { title: 'Picture-in-Picture (janela flutuante)' }, icon(ICON_PIP), 'PiP');
  const soundIcon = icon(ICON_SOUND);
  const mutedIcon = icon(ICON_MUTED);
  const muteLabel = h('span');
  const muteBtn = h('button', { title: 'Ativar/desativar o som' }, soundIcon, mutedIcon, muteLabel);
  const autoBtn = h('button', {
    textContent: 'Auto PiP',
    title: 'Mini player automático ao rolar a página com o vídeo com som',
  });
  const dlBtn = h('button', { title: 'Baixar vídeo' }, icon(ICON_DOWNLOAD), 'Baixar');
  const bar = h(
    'div',
    { className: 'bar', hidden: true },
    curLabel,
    h('div', { className: 'row' }, ...speedBtns),
    h('div', { className: 'row' }, muteBtn, pipBtn, autoBtn, dlBtn)
  );

  const canvas = h('canvas', { title: 'Voltar ao vídeo' });
  const ctx = canvas.getContext('2d');
  const miniPlay = h('button', { textContent: '❚❚', title: 'Pausar/continuar' });
  const miniPip = h('button', { title: 'Abrir em janela PiP' }, icon(ICON_PIP));
  const miniClose = h('button', { textContent: '✕', title: 'Fechar' });
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

  const toastEl = h('div', { className: 'toast', hidden: true });
  root.append(h('style', { textContent: CSS }), bar, seek, mini, toastEl);

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
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 3500);
  }

  function renderSettings() {
    curLabel.textContent = settings.speed + '×';
    speedBtns.forEach((b, i) => b.classList.toggle('on', SPEEDS[i] === settings.speed));
    autoBtn.classList.toggle('on', settings.autoPip);
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
      toast('Não foi possível abrir o PiP: ' + e.message);
    }
  }

  pipBtn.onclick = () => active && togglePip(active);
  muteBtn.onclick = () => {
    if (!active) return;
    const unmute = !audible(active);
    active.muted = !unmute;
    if (unmute && active.volume === 0) active.volume = 1;
  };
  dlBtn.onclick = () => active && download(active);
  autoBtn.onclick = () => {
    settings.autoPip = !settings.autoPip;
    chrome.storage.sync.set({ autoPip: settings.autoPip }).catch(() => {});
    renderSettings();
    if (!settings.autoPip && mode === 'mini') unpin();
  };
  canvas.onclick = () => pinned?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

  function update() {
    scheduled = false;
    if (!host.isConnected) document.documentElement.append(host);

    let best = null;
    let bestRect = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const { r, area, ratio } = vis(v);
      if (r.width < 120 || r.height < 80) continue;
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
      const inFeed = isIG && !!best.closest('article');
      bar.hidden = false;
      // No Reels a barra fica em coluna fora do vídeo, à esquerda, se houver espaço.
      bar.classList.toggle('side', isIG && !inFeed && /^\/reels?\//.test(location.pathname));
      let x = bestRect.left - 12 - bar.offsetWidth;
      let y = Math.max(bestRect.top, 8);
      if (bar.classList.contains('side') && x < 8) bar.classList.remove('side');
      if (!bar.classList.contains('side')) {
        x = Math.max(bestRect.left, 0) + 8;
        // No feed do Instagram o topo do vídeo é coberto pelo avatar e nome do perfil.
        y = Math.max(bestRect.top + (inFeed ? 60 : 8), 8);
      }
      bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      pipBtn.classList.toggle('on', document.pictureInPictureElement === best);
      const sound = audible(best);
      soundIcon.toggleAttribute('hidden', !sound);
      mutedIcon.toggleAttribute('hidden', sound);
      muteLabel.textContent = sound ? 'Som' : 'Mudo';
    } else {
      bar.hidden = true;
    }

    // Durante o arraste a barra fica presa ao vídeo em que o arraste começou.
    if (isIG && !dragging) {
      if (onScreen && isFinite(best.duration) && best.duration > 0) {
        seekVideo = best;
        const y = Math.min(bestRect.bottom, innerHeight) - 18;
        seek.style.transform = `translate(${Math.round(bestRect.left)}px, ${Math.round(y)}px)`;
        seek.style.width = Math.round(bestRect.width) + 'px';
        seek.hidden = false;
        if (!seekRaf) seekRaf = requestAnimationFrame(seekTick);
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

    if (!pinned && settings.autoPip && autoAllowed()) {
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

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.sync.get({ autoPip: true }).then((s) => {
    settings.autoPip = s.autoPip;
    renderSettings();
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoPip) {
      settings.autoPip = changes.autoPip.newValue;
      renderSettings();
    }
  });

  renderSettings();
  schedule();
})();
