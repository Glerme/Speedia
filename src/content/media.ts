import { STORE, isIG, t, entries, type CapturedMedia } from './state';
import { toast } from './ui';
// ---------------------------------------------------------------- mídia capturada (inject.js)
function isCapturedMedia(value: unknown): value is CapturedMedia {
    if (!value || typeof value !== 'object')
        return false;
    const media = value as Record<string, unknown>;
    return typeof media.url === 'string' && !!media.id
        && (media.duration === undefined || typeof media.duration === 'number')
        && (media.code === undefined || typeof media.code === 'string')
        && (media.keys === undefined || (Array.isArray(media.keys) && media.keys.every((key: unknown) => typeof key === 'string')));
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
function findMedia(v: HTMLVideoElement) {
    const all = [...entries.values()];
    const dur = v.duration;
    const delta = (m: CapturedMedia) => (m.duration && isFinite(dur) ? Math.abs(m.duration - dur) : 1e9);
    let hit: CapturedMedia | null = null;
    if (isIG) {
        const code = igCode(v);
        const same = code ? all.filter((m) => m.code === code) : [];
        // Carrossel: vários vídeos no mesmo post, escolhe pela duração.
        if (same.length)
            hit = same.reduce((a, b) => (delta(b) < delta(a) ? b : a));
    }
    else if (v.poster) {
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
    const name = isIG ? `instagram_${igCode(v) || Date.now()}` : `x_${tweetId(v) || Date.now()}`;
    try {
        const res: unknown = await chrome.runtime.sendMessage({ type: 'download', url: hit.url, filename: name + '.mp4' });
        const response = res && typeof res === 'object' ? res as Record<string, unknown> : {};
        toast(response.ok ? t('toastDownloadStarted') : t('toastDownloadFailed', String(response.error || t('toastUnknownError'))));
    }
    catch {
        toast(t('toastReloaded'));
    }
}
