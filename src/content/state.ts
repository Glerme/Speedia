import { speediaMsg } from '../shared/i18n';
import { speediaDefaultShortcuts } from '../shared/shortcuts';
export const t = speediaMsg as (key: string, ...args: (string | number)[]) => string;
export const STORE = globalThis.SPEEDIA_EDITION === 'store';
export const SPEEDS = [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const isIG = location.hostname.endsWith('instagram.com');
export const settings = { speed: 1, autoPip: true, shortcuts: speediaDefaultShortcuts() };
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
    duration?: number;
    code?: string;
    keys?: string[];
}
export const entries = new Map<unknown, CapturedMedia>();
