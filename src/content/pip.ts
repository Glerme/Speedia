import { state, settings, isIG, armed, autoPaused, suppressed, mutedByUs, t, type PipMode } from './state';
import { ui, toast, renderSettings } from './ui';
import { download } from './media';
// ---------------------------------------------------------------- mini player / PiP
export const audible = (v: HTMLVideoElement) => !v.muted && v.volume > 0;
export const recentInput = () => performance.now() - state.lastInput < 600;
// Reels e stories trocam de vídeo ao rolar; ali o mini player só atrapalharia.
export const autoAllowed = () => !(isIG && /^\/(reels?|stories)\//.test(location.pathname));
export function vis(v: HTMLVideoElement) {
    const r = v.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const hgt = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    const area = Math.max(0, w) * Math.max(0, hgt);
    const full = Math.min(r.width * r.height, innerWidth * innerHeight);
    return { r, area, ratio: full ? area / full : 0 };
}
// Vídeo encoberto por outro: o Instagram mantém o feed montado atrás do visualizador de Reels.
export function covered(v: HTMLVideoElement, r: DOMRect) {
    const x = (Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2;
    const y = (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2;
    const top = document.elementsFromPoint(x, y).find((el) => el instanceof HTMLVideoElement);
    return !!top && top !== v;
}
export function sizeMini(v: HTMLVideoElement) {
    const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    const maxH = innerHeight * 0.42;
    let w = 340;
    let hgt = w / ar;
    if (hgt > maxH) {
        hgt = maxH;
        w = hgt * ar;
    }
    ui.mini.style.width = Math.round(w) + 'px';
    ui.mini.style.height = Math.round(hgt) + 'px';
    ui.canvas.width = Math.round(w * devicePixelRatio);
    ui.canvas.height = Math.round(hgt * devicePixelRatio);
}
export function draw() {
    if (!state.pinned || state.mode !== 'mini')
        return;
    const v = state.pinned;
    if (v.readyState >= 2) {
        try {
            ui.ctx?.drawImage(v, 0, 0, ui.canvas.width, ui.canvas.height);
        }
        catch { }
    }
    ui.prog.style.width = (v.duration ? (v.currentTime / v.duration) * 100 : 0) + '%';
    ui.miniPlay.textContent = v.paused ? '▶' : '❚❚';
    state.drawRaf = requestAnimationFrame(draw);
}
export function muteOther(v: HTMLVideoElement) {
    v.muted = true;
    mutedByUs.add(v);
}
export function pin(v: HTMLVideoElement, m: PipMode) {
    if (state.pinned && state.pinned !== v)
        unpin();
    state.pinned = v;
    state.mode = m;
    for (const o of document.querySelectorAll('video')) {
        if (o !== v && !o.paused && audible(o))
            muteOther(o);
    }
    cancelAnimationFrame(state.drawRaf);
    if (m === 'mini') {
        sizeMini(v);
        ui.mini.hidden = false;
        if (v.paused)
            v.play().catch(() => { });
        draw();
    }
    else {
        ui.mini.hidden = true;
    }
}
export function unpin() {
    if (!state.pinned)
        return;
    delete state.pinned.dataset.speediaPin;
    state.pinned = null;
    state.mode = null;
    ui.mini.hidden = true;
    cancelAnimationFrame(state.drawRaf);
    for (const o of mutedByUs)
        if (o.isConnected && o.muted)
            o.muted = false;
    mutedByUs.clear();
}
// Fecha de vez: para o vídeo e não reabre até ele voltar à tela.
export function dismiss() {
    const v = state.pinned;
    if (!v)
        return;
    const wasNative = state.mode === 'native';
    unpin();
    suppressed.add(v);
    armed.delete(v);
    v.pause();
    if (wasNative && document.pictureInPictureElement === v)
        document.exitPictureInPicture().catch(() => { });
}
export async function togglePip(v: HTMLVideoElement) {
    try {
        if (document.pictureInPictureElement === v) {
            await document.exitPictureInPicture();
            return;
        }
        v.removeAttribute('disablepictureinpicture');
        await v.requestPictureInPicture();
    }
    catch (e) {
        toast(t('toastPipFail', e instanceof Error ? e.message : String(e)));
    }
}
export function registerTabPip() {
    try {
        // A ação de auto-PiP do Chrome ainda não consta no lib.dom do TypeScript.
        navigator.mediaSession.setActionHandler('enterpictureinpicture' as MediaSessionAction, settings.tabPip ? () => {
            try {
                let target = state.pinned?.isConnected ? state.pinned : null;
                if (!target && state.active?.isConnected && !state.active.paused && audible(state.active))
                    target = state.active;
                if (!target) {
                    let bestArea = 0;
                    for (const v of document.querySelectorAll('video')) {
                        if (v.paused || !audible(v))
                            continue;
                        const { r, area } = vis(v);
                        if (area > bestArea && !covered(v, r)) {
                            bestArea = area;
                            target = v;
                        }
                    }
                }
                if (target && document.pictureInPictureElement !== target)
                    void togglePip(target);
            }
            catch { }
        } : null);
    }
    catch { }
}
export function toggleMute(v: HTMLVideoElement) {
    const unmute = !audible(v);
    v.muted = !unmute;
    if (unmute && v.volume === 0)
        v.volume = 1;
}
export function bindPlayerControls() {
    ui.pipBtn.onclick = () => state.active && togglePip(state.active);
    ui.muteBtn.onclick = () => state.active && toggleMute(state.active);
    if (ui.dlBtn)
        ui.dlBtn.onclick = () => state.active && download(state.active);
    ui.autoBtn.onclick = () => {
        settings.autoPip = !settings.autoPip;
        chrome.storage.sync.set({ autoPip: settings.autoPip }).catch(() => { });
        renderSettings();
        if (!settings.autoPip && state.mode === 'mini')
            unpin();
    };
    const backToVideo = () => state.pinned?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    ui.canvas.onclick = backToVideo;
    ui.canvas.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            backToVideo();
        }
    };
    ui.miniPlay.onclick = () => state.pinned && (state.pinned.paused ? state.pinned.play().catch(() => { }) : state.pinned.pause());
    ui.miniPip.onclick = () => state.pinned && togglePip(state.pinned);
    ui.miniClose.onclick = dismiss;
}
