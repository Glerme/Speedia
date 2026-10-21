import { speediaMsg } from '../shared/i18n';
import { speediaDefaultShortcuts } from '../shared/shortcuts';
export const t = speediaMsg as (key: string, ...args: (string | number)[]) => string;
export const STORE = globalThis.SPEEDIA_EDITION === 'store';
export const SPEEDS = [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const site: 'ig' | 'x' | 'tiktok' | 'fb' | 'reddit' =
    location.hostname.endsWith('instagram.com') ? 'ig' :
    location.hostname.endsWith('tiktok.com') ? 'tiktok' :
    location.hostname.endsWith('facebook.com') ? 'fb' :
    location.hostname.endsWith('reddit.com') ? 'reddit' : 'x';
const playerRoots: ShadowRoot[] = [];
// Descobre roots só no tick de observação, nunca no loop de renderização.
export function refreshPlayerRoots() {
    if (site !== 'reddit')
        return;
    playerRoots.length = 0;
    function discover(root: Document | ShadowRoot) {
        for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) {
                if (el.shadowRoot.querySelectorAll('video').length)
                    playerRoots.push(el.shadowRoot);
                discover(el.shadowRoot);
            }
        }
    }
    discover(document);
}
export function allVideos(): HTMLVideoElement[] {
    const videos = [...document.querySelectorAll('video')];
    if (site === 'reddit')
        for (const root of playerRoots)
            if (root.host.isConnected)
                videos.push(...root.querySelectorAll('video'));
    return videos;
}
export const settings = { speed: 1, autoPip: true, tabPip: false, shortcuts: speediaDefaultShortcuts() };
// O Firefox não expõe a API de Picture-in-Picture para páginas nem extensões.
export const canPip = 'requestPictureInPicture' in HTMLVideoElement.prototype;
export type PipMode = 'mini' | 'native';
export const state = {
    active: null as HTMLVideoElement | null, // vídeo ao qual a barra está presa
    pinned: null as HTMLVideoElement | null, // vídeo no mini player ou no PiP nativo
    mode: null as PipMode | null, // 'mini' | 'native'
    drawRaf: 0, lastInput: 0,
    seekVideo: null as HTMLVideoElement | null,
    dragging: false, seekRaf: 0,
    mx: -1, my: -1, scheduled: false,
};
export const armed = new Set<HTMLVideoElement>(); // tocando com som e já vistos na tela
export const autoPaused = new WeakMap<HTMLVideoElement, number>(); // pausados pelo site (não pelo usuário) -> quando
export const suppressed = new WeakSet<HTMLVideoElement>(); // dispensados pelo usuário até voltarem à tela
export const mutedByUs = new Set<HTMLVideoElement>();
export interface CapturedMedia {
    id?: unknown;
    url: string;
    duration?: number | null;
    code?: string | null;
    keys?: string[] | null;
}
export const entries = new Map<unknown, CapturedMedia>();
