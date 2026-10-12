// Roda no contexto da página (world MAIN). Duas funções:
//  1. ler as respostas de API do site para descobrir a URL .mp4 real de cada vídeo
//     (o <video> em si costuma usar blob:, que não dá para baixar);
//  2. impedir que o site pause o vídeo que está no mini player/PiP.
(() => {
  'use strict';

  const pathKey = (u) => {
    try {
      return new URL(u).pathname.replace(/\.\w+$/, '');
    } catch {
      return null;
    }
  };

  function emit(list) {
    if (!list.length) return;
    window.dispatchEvent(new CustomEvent('speedia:media', { detail: JSON.stringify(list) }));
  }

  function fromTwitter(o, out) {
    const variants = o.video_info?.variants;
    if (!Array.isArray(variants)) return;
    const best = variants
      .filter((v) => v.content_type === 'video/mp4' && v.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    if (!best) return;
    const keys = [];
    if (o.id_str) keys.push(String(o.id_str));
    const k = o.media_url_https && pathKey(o.media_url_https);
    if (k) keys.push(k);
    out.push({
      id: 'x:' + (o.id_str || best.url),
      keys,
      duration: o.video_info.duration_millis ? o.video_info.duration_millis / 1000 : null,
      url: best.url,
    });
  }

  function fromInstagram(o, code, out) {
    let url = null;
    if (Array.isArray(o.video_versions) && o.video_versions.length) {
      const best = o.video_versions
        .filter((v) => v && v.url)
        .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0];
      url = best?.url;
    } else if (typeof o.video_url === 'string') {
      url = o.video_url;
    }
    if (!url) return;
    out.push({
      id: 'ig:' + (o.pk ?? o.id ?? url),
      code: code || null,
      duration: typeof o.video_duration === 'number' ? o.video_duration : null,
      url,
    });
  }

  function walk(rootNode) {
    const out = [];
    const stack = [[rootNode, null]];
    while (stack.length) {
      const [node, ctx] = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        for (const item of node) if (item && typeof item === 'object') stack.push([item, ctx]);
        continue;
      }
      // O shortcode do post vale para os filhos (itens de carrossel não têm o próprio).
      let code = ctx;
      if (typeof node.code === 'string' && /^[\w-]{5,}$/.test(node.code)) code = node.code;
      else if (typeof node.shortcode === 'string') code = node.shortcode;

      if (node.video_info) fromTwitter(node, out);
      if (node.video_versions || node.video_url) fromInstagram(node, code, out);

      for (const key in node) {
        const child = node[key];
        if (child && typeof child === 'object') stack.push([child, code]);
      }
    }
    emit(out);
  }

  function scan(text) {
    if (typeof text !== 'string' || text.length < 20) return;
    if (!text.includes('video_versions') && !text.includes('video_info') && !text.includes('video_url')) return;
    if (text.startsWith('for (;;);')) text = text.slice(9);
    try {
      walk(JSON.parse(text));
    } catch {
      // Algumas respostas vêm como vários JSONs, um por linha.
      for (const line of text.split('\n')) {
        try {
          walk(JSON.parse(line));
        } catch {}
      }
    }
  }

  const interesting = (url) => /graphql|\/api\//.test(url || '');

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      p.then(
        (res) => {
          try {
            if (!interesting(res.url)) return;
            res.clone().text().then(scan, () => {});
          } catch {}
        },
        () => {}
      );
      return p;
    };
  }

  function onXhrLoad() {
    try {
      if (!interesting(this.__speediaUrl)) return;
      if (this.responseType === '' || this.responseType === 'text') scan(this.responseText);
      else if (this.responseType === 'json' && this.response) walk(this.response);
    } catch {}
  }
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__speediaUrl = String(url);
    this.addEventListener('load', onXhrLoad);
    return origOpen.apply(this, arguments);
  };

  // Dados que já vêm embutidos no HTML inicial (Instagram).
  document.addEventListener('DOMContentLoaded', () => {
    for (const s of document.querySelectorAll('script[type="application/json"]')) scan(s.textContent);
  });

  // O content script marca o vídeo "preso" enquanto ele está fora da tela; nesse
  // período ignoramos o pause automático que o site dispara ao rolar a página.
  const origPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () {
    if (this.dataset && this.dataset.speediaPin === '1') return;
    return origPause.apply(this, arguments);
  };
})();
