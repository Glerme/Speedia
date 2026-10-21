import { STORE, site, t, entries, type CapturedMedia } from './state';
import { toast } from './ui';
// ---------------------------------------------------------------- mídia capturada (inject.js)
function isCapturedMedia(value: unknown): value is CapturedMedia {
    if (!value || typeof value !== 'object')
        return false;
    const media = value as Record<string, unknown>;
    return typeof media.url === 'string' && !!media.id
        && (media.duration == null || typeof media.duration === 'number')
        && (media.code == null || typeof media.code === 'string')
        && (media.keys == null || (Array.isArray(media.keys) && media.keys.every((key: unknown) => typeof key === 'string')));
}
export function registerMedia() {
    if (!STORE)
        window.addEventListener('speedia:media', (e) => {
            let list: unknown;
            try {
                list = JSON.parse(String((e as CustomEvent<unknown>).detail));
            }
            catch {
                return;
            }
            if (!Array.isArray(list))
                return;
            const mediaList: unknown[] = list;
            for (const m of mediaList) {
                if (!isCapturedMedia(m))
                    continue;
                entries.delete(m.id);
                entries.set(m.id, m);
            }
            while (entries.size > 3000)
                entries.delete(entries.keys().next().value);
        });
}
function igCode(v: HTMLVideoElement) {
    const link = v.closest('article')?.querySelector('a[href*="/p/"], a[href*="/reel/"]');
    const re = /\/(?:p|reel|reels)\/([\w-]+)/;
    return (link?.getAttribute('href') || '').match(re)?.[1] || location.pathname.match(re)?.[1] || null;
}
function tweetId(v: HTMLVideoElement) {
    const link = v.closest('article')?.querySelector('a[href*="/status/"]');
    const re = /\/status\/(\d+)/;
    return (link?.getAttribute('href') || '').match(re)?.[1] || location.pathname.match(re)?.[1] || null;
}
function videoId(v: HTMLVideoElement) {
    const re = site === 'tiktok' ? /\/video\/(\d+)/ : /(?:\/videos\/|\/reel\/|[?&]v=)(\d+)/;
    // Sobe até o contêiner mais próximo que identifica o vídeo.
    for (let el: Element | null = v; el; el = el.parentElement) {
        const links = el.matches('a[href]') ? [el] : el.querySelectorAll('a[href]');
        for (const link of links) {
            const id = (link.getAttribute('href') || '').match(re)?.[1];
            if (id)
                return id;
        }
        if (el === document.body)
            break;
    }
    return (location.pathname + location.search).match(re)?.[1] || null;
}
function redditPlayer(v: HTMLVideoElement) {
    for (let el: Element | null = v; el;) {
        const player = el.closest('shreddit-player');
        if (player)
            return player;
        const root = el.getRootNode();
        el = root instanceof ShadowRoot ? root.host : null;
    }
    return null;
}
function redditMedia(v: HTMLVideoElement): CapturedMedia | null {
    try {
        const data = JSON.parse(redditPlayer(v)?.getAttribute('packaged-media-json') || 'null');
        const permutations = data?.playbackMp4s?.permutations;
        if (!Array.isArray(permutations))
            return null;
        let best: CapturedMedia | null = null;
        let bestSize = -1;
        for (const permutation of permutations) {
            const source = permutation?.source;
            const url = source?.url;
            // As permutações mp4 empacotadas incluem áudio; rejeita as explicitamente sem áudio.
            if (typeof url !== 'string' || !/^https:\/\//.test(url) || !/\.mp4(?:[?#]|$)/i.test(url)
                || permutation.hasAudio === false || source.hasAudio === false)
                continue;
            const size = Number(permutation.dimensions?.height || source.dimensions?.height || permutation.resolution?.height || permutation.resolution || 0);
            if (Number.isFinite(size) && size > bestSize) {
                bestSize = size;
                best = { url };
            }
        }
        return best;
    }
    catch {
        return null;
    }
}
function findMedia(v: HTMLVideoElement) {
    const all = [...entries.values()];
    const dur = v.duration;
    const delta = (m: CapturedMedia) => (m.duration && isFinite(dur) ? Math.abs(m.duration - dur) : 1e9);
    let hit: CapturedMedia | null = null;
    if (site === 'ig') {
        const code = igCode(v);
        const same = code ? all.filter((m) => m.code === code) : [];
        // Carrossel: vários vídeos no mesmo post, escolhe pela duração.
        if (same.length)
            hit = same.reduce((a, b) => (delta(b) < delta(a) ? b : a));
    }
    else if (site === 'x' && v.poster) {
        const keys: string[] = [];
        try {
            keys.push(new URL(v.poster).pathname.replace(/\.\w+$/, ''));
        }
        catch { }
        const id = v.poster.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//)?.[1];
        if (id)
            keys.push(id);
        hit = all.find((m) => m.keys?.some((k) => keys.includes(k))) || null;
    }
    if (site === 'tiktok' || site === 'fb') {
        const id = videoId(v);
        hit = id ? all.find((m) => m.keys?.includes(id)) || null : null;
    }
    if (site === 'reddit')
        hit = redditMedia(v);
    if (!hit) {
        const near = all.filter((m) => delta(m) < 0.12);
        if (near.length === 1)
            hit = near[0];
    }
    if (hit)
        return hit;
    const src = v.currentSrc || v.src || '';
    if (/^https:/.test(src) && !src.includes('.m3u8'))
        return { url: src };
    return null;
}
export async function download(v: HTMLVideoElement) {
    const hit = findMedia(v);
    if (!hit) {
        toast(t('toastNoMedia'));
        return;
    }
    const prefix = { ig: 'instagram', x: 'x', tiktok: 'tiktok', fb: 'facebook', reddit: 'reddit' }[site];
    const id = site === 'ig' ? igCode(v) : site === 'x' ? tweetId(v) : site === 'reddit'
        ? redditPlayer(v)?.getAttribute('post-id')?.replace(/^t3_/, '') : videoId(v);
    const name = `${prefix}_${id || Date.now()}`;
    try {
        const res: unknown = await chrome.runtime.sendMessage({ type: 'download', url: hit.url, filename: name + '.mp4' });
        const response = res && typeof res === 'object' ? res as Record<string, unknown> : {};
        toast(response.ok ? t('toastDownloadStarted') : t('toastDownloadFailed', String(response.error || t('toastUnknownError'))));
    }
    catch {
        toast(t('toastReloaded'));
    }
}
