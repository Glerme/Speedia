interface MediaRecord {
  id: string;
  keys?: string[];
  code?: string | null;
  duration: number | null;
  url: string;
}

interface MediaNode {
  id_str?: string;
  media_url_https?: string;
  video_info?: {
    variants?: { content_type?: string; url?: string; bitrate?: number }[];
    duration_millis?: number;
  };
  video_versions?: { url?: string; width?: number; height?: number }[];
  video_url?: string;
  pk?: string | number;
  id?: string | number;
  video_duration?: number;
  video?: {
    playAddr?: string | { UrlList?: string[] };
    downloadAddr?: string | { UrlList?: string[] };
    bitrateInfo?: { Bitrate?: number; PlayAddr?: { UrlList?: string[] } }[];
    duration?: number;
  };
  browser_native_hd_url?: string;
  browser_native_sd_url?: string;
  playable_url_quality_hd?: string;
  playable_url?: string;
  videoDeliveryLegacyFields?: MediaNode;
  playable_duration_in_ms?: number;
  length_in_second?: number;
}

type SpeediaXhr = XMLHttpRequest & { __speediaUrl?: string };

// Roda no contexto da página (world MAIN). Duas funções:
//  1. ler as respostas de API do site para descobrir a URL .mp4 real de cada vídeo
//     (o <video> em si costuma usar blob:, que não dá para baixar);
//  2. impedir que o site pause o vídeo que está no mini player/PiP.
(() => {
  'use strict';

  const STORE = globalThis.SPEEDIA_EDITION === 'store';
  const FACEBOOK_URL_FIELDS = ['browser_native_hd_url', 'playable_url_quality_hd', 'browser_native_sd_url', 'playable_url'] as const;

  const pathKey = (u: string): string | null => {
    try {
      return new URL(u).pathname.replace(/\.\w+$/, '');
    } catch {
      return null;
    }
  };

  function emit(list: MediaRecord[]): void {
    if (!list.length) return;
    window.dispatchEvent(new CustomEvent('speedia:media', { detail: JSON.stringify(list) }));
  }

  function fromTwitter(o: MediaNode, out: MediaRecord[]): void {
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
      duration: o.video_info!.duration_millis ? o.video_info!.duration_millis / 1000 : null,
      url: best.url!,
    });
  }

  function fromInstagram(o: MediaNode, code: string | null, out: MediaRecord[]): void {
    let url: string | null | undefined = null;
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

  function httpsUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  function fromTikTok(o: MediaNode, out: MediaRecord[]): void {
    if (typeof o.id !== 'string' || !/^\d+$/.test(o.id) || !o.video) return;
    const video = o.video;
    const urls: unknown[] = [];
    if (Array.isArray(video.bitrateInfo)) {
      for (const variant of [...video.bitrateInfo].sort((a, b) => (b?.Bitrate || 0) - (a?.Bitrate || 0))) {
        if (Array.isArray(variant?.PlayAddr?.UrlList)) urls.push(...variant.PlayAddr.UrlList);
      }
    }
    // PlayAddr costuma ser sem marca d'água; downloadAddr fica como alternativa.
    for (const addr of [video.playAddr, video.downloadAddr]) {
      if (typeof addr === 'string') urls.push(addr);
      else if (Array.isArray(addr?.UrlList)) urls.push(...addr.UrlList);
    }
    const url = urls.find(httpsUrl);
    if (!url) return;
    out.push({
      id: 'tt:' + o.id,
      keys: [o.id],
      duration: typeof video.duration === 'number' && Number.isFinite(video.duration) ? video.duration : null,
      url,
    });
  }

  function fromFacebook(o: MediaNode, out: MediaRecord[]): void {
    if ((typeof o.id !== 'string' && typeof o.id !== 'number') || !String(o.id)) return;
    const url = FACEBOOK_URL_FIELDS.flatMap((field) => [o[field], o.videoDeliveryLegacyFields?.[field]]).find(httpsUrl);
    if (!url) return;
    const duration = typeof o.playable_duration_in_ms === 'number'
      ? o.playable_duration_in_ms / 1000 : o.length_in_second;
    out.push({
      id: 'fb:' + o.id,
      keys: [String(o.id)],
      duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
      url,
    });
  }

  function walk(rootNode: unknown): void {
    const out: MediaRecord[] = [];
    const stack: [unknown, string | null][] = [[rootNode, null]];
    while (stack.length) {
      const [value, ctx] = stack.pop()!;
      const node = value as Record<string, unknown> | null;
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        for (const item of node) if (item && typeof item === 'object') stack.push([item, ctx]);
        continue;
      }
      // O shortcode do post vale para os filhos (itens de carrossel não têm o próprio).
      let code = ctx;
      if (typeof node.code === 'string' && /^[\w-]{5,}$/.test(node.code)) code = node.code;
      else if (typeof node.shortcode === 'string') code = node.shortcode;

      if (node.video_info) fromTwitter(node as MediaNode, out);
      if (node.video_versions || node.video_url) fromInstagram(node as MediaNode, code, out);
      if (node.video) fromTikTok(node as MediaNode, out);
      if (node.videoDeliveryLegacyFields || FACEBOOK_URL_FIELDS.some((field) => node[field])) {
        fromFacebook(node as MediaNode, out);
      }

      for (const key in node) {
        const child = node[key];
        if (child && typeof child === 'object') stack.push([child, code]);
      }
    }
    emit(out);
  }

  function scan(text: string | null): void {
    if (typeof text !== 'string' || text.length < 20) return;
    if (!/video_versions|video_info|video_url|playAddr|downloadAddr|bitrateInfo|browser_native_(?:hd|sd)_url|playable_url/.test(text)) return;
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

  const interesting = (url: string | undefined): boolean => /graphql|\/api\//.test(url || '');

  const origFetch = STORE ? null : window.fetch;
  if (origFetch) {
    window.fetch = function (this: Window, ...args: Parameters<typeof fetch>) {
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

  function onXhrLoad(this: SpeediaXhr): void {
    try {
      if (!interesting(this.__speediaUrl)) return;
      if (this.responseType === '' || this.responseType === 'text') scan(this.responseText);
      else if (this.responseType === 'json' && this.response) walk(this.response);
    } catch {}
  }
  if (!STORE) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: SpeediaXhr, method: string, url: string | URL) {
      this.__speediaUrl = String(url);
      this.addEventListener('load', onXhrLoad);
      return Reflect.apply(origOpen, this, arguments);
    };

    // Dados que já vêm embutidos no HTML inicial (Instagram e TikTok).
    document.addEventListener('DOMContentLoaded', () => {
      for (const s of document.querySelectorAll('script[type="application/json"]')) scan(s.textContent);
    });
  }

  // O content script marca o vídeo "preso" enquanto ele está fora da tela; nesse
  // período ignoramos o pause automático que o site dispara ao rolar a página.
  const origPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
    if (this.dataset && this.dataset.speediaPin === '1') return;
    return Reflect.apply(origPause, this, arguments);
  };
})();
