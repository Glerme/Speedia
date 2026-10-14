import { state, isIG, settings, armed, autoPaused, suppressed, t } from './state';
import { ui, SEEK_H, setPressed, muteText, seekTick, syncHost } from './ui';
import { audible, vis, covered, autoAllowed, pin, unpin } from './pip';
// ---------------------------------------------------------------- laço de atualização
export function schedule() {
    if (state.scheduled)
        return;
    state.scheduled = true;
    requestAnimationFrame(update);
}
// Oclusão por barras fixas do site (cabeçalho do X, nav do Instagram). Estilos cacheados por frame.
let styleCache = new Map<Element, boolean>();
let sideW = 0;
function isFixedish(el: Element) {
    let p = styleCache.get(el);
    if (p === undefined) {
        const pos = getComputedStyle(el).position;
        p = pos === 'fixed' || pos === 'sticky';
        styleCache.set(el, p);
    }
    return p;
}
// Sem hit-test do vídeo: só vale cabeçalho/rodapé parcial, não fundo fixo nem tela cheia atrás do vídeo.
function plausibleOccluder(n: Element, v: HTMLVideoElement) {
    const ob = n.getBoundingClientRect();
    const vr = v.getBoundingClientRect();
    if (ob.width >= innerWidth * 0.98 && ob.height >= innerHeight * 0.98)
        return false;
    return ob.top > vr.top || (ob.top <= vr.top && ob.bottom < vr.bottom);
}
// Oclusor = ancestral fixed/sticky, fora do vídeo e do player, que cobre o ponto antes de o vídeo aparecer.
function occluderAt(v: HTMLVideoElement, x: number, y: number): Element | null {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight)
        return null;
    const list = document.elementsFromPoint(x, y);
    const idx = list.indexOf(v);
    // Vídeo fora do hit-test (pointer-events: none etc.): compara geometricamente com qualquer fixed/sticky no ponto.
    const end = idx < 0 ? list.length : idx;
    const player = v.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]') || v.parentElement;
    for (let i = 0; i < end; i++) {
        const el = list[i];
        if (el === ui.host || el.contains(v) || (player && player.contains(el)))
            continue;
        for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
            if (isFixedish(n)) {
                if (n.contains(v))
                    break;
                if (idx < 0 && !plausibleOccluder(n, v))
                    break;
                return n;
            }
        }
    }
    return null;
}
// Desce y abaixo de cabeçalhos fixos (máx. 3 empilhados); Infinity se coberto por barra inferior.
function clearTop(v: HTMLVideoElement, x: number, y: number) {
    for (let i = 0; i < 3; i++) {
        const occ = occluderAt(v, x + 4, y + 4);
        if (!occ)
            break;
        const ob = occ.getBoundingClientRect();
        if (ob.top > innerHeight / 2)
            return Infinity;
        if (ob.bottom + 8 <= y)
            break;
        y = ob.bottom + 8;
    }
    return y;
}
function update() {
    state.scheduled = false;
    styleCache = new Map();
    if (!ui.host.isConnected && !ui.host.parentNode)
        document.documentElement.append(ui.host);
    syncHost();
    const fs = ui.host.parentNode !== document.documentElement;
    // Ancestral com transform/filter vira o bloco de contenção do fixed: compensa a origem.
    const hr = fs ? ui.host.getBoundingClientRect() : null;
    const ox = hr ? hr.left : 0;
    const oy = hr ? hr.top : 0;
    if (fs && state.mode === 'mini')
        unpin();
    let best = null;
    let bestRect = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
        const { r, area, ratio } = vis(v);
        if (r.width < 120 || r.height < 80)
            continue;
        if (area && covered(v, r))
            continue;
        if (ratio >= 0.6) {
            suppressed.delete(v);
            if (!v.paused && audible(v))
                armed.add(v);
        }
        if (!area)
            continue;
        // Prioriza o vídeo sob o mouse, depois o que está tocando, depois o maior.
        let score = area;
        if (!v.paused)
            score *= 3;
        if (state.mx >= r.left && state.mx <= r.right && state.my >= r.top && state.my <= r.bottom)
            score *= 10;
        if (score > bestScore) {
            bestScore = score;
            best = v;
            bestRect = r;
        }
    }
    state.active = best;
    const onScreen = best !== null && bestRect !== null && bestRect.bottom > 48 && bestRect.top < innerHeight - 48;
    if (onScreen && best && bestRect) {
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
            ui.bar.hidden = true;
        }
        else {
            ui.bar.hidden = false;
            // No Reels a barra fica em coluna fora do vídeo, à esquerda, se houver espaço.
            ui.bar.classList.toggle('side', useSide);
            if (useSide) {
                sideW = ui.bar.offsetWidth;
                x = bestRect.left - 12 - sideW;
                y = Math.max(bestRect.top, 8);
                if (x < 8) {
                    // Só na primeira medição: nos frames seguintes sideW já decide antes de exibir.
                    ui.bar.classList.remove('side');
                    x = Math.max(bestRect.left, 0) + 8;
                    y = clearTop(best, x, Math.max(bestRect.top + 8, 8));
                    if (y > bestRect.bottom - 48)
                        ui.bar.hidden = true;
                }
            }
            if (fs) {
                x = 8;
                y = 8;
            }
            if (!ui.bar.hidden)
                ui.bar.style.transform = `translate(${Math.round(x - ox)}px, ${Math.round(y - oy)}px)`;
        }
        setPressed(ui.pipBtn, document.pictureInPictureElement === best);
        const sound = audible(best);
        ui.soundIcon.toggleAttribute('hidden', !sound);
        ui.mutedIcon.toggleAttribute('hidden', sound);
        ui.muteLabel.textContent = sound ? t('ovSoundLabel') : t('ovMutedLabel');
        ui.muteBtn.setAttribute('aria-label', muteText() + (': ' + t(sound ? 'ovMuteStateOn' : 'ovMuteStateOff')));
    }
    else {
        ui.bar.hidden = true;
    }
    // Durante o arraste a barra fica presa ao vídeo em que o arraste começou.
    if (isIG && !state.dragging) {
        if (onScreen && best && bestRect && isFinite(best.duration) && best.duration > 0) {
            state.seekVideo = best;
            let y = Math.min(bestRect.bottom, innerHeight) - SEEK_H;
            // Sobe até o topo de barras fixas inferiores; some se sobrar pouco vídeo.
            if (!fs) {
                const sx = Math.min(Math.max(bestRect.left, 0) + 8, innerWidth - 1);
                for (let i = 0; i < 2; i++) {
                    const occ = occluderAt(best, sx, y + SEEK_H / 2);
                    if (!occ)
                        break;
                    const nt = occ.getBoundingClientRect().top - SEEK_H;
                    if (nt >= y)
                        break;
                    y = nt;
                }
            }
            if (y < Math.max(bestRect.top, 0) + 48) {
                ui.seek.hidden = true;
                state.seekVideo = null;
            }
            else {
                ui.seek.style.transform = `translate(${Math.round(bestRect.left - ox)}px, ${Math.round(y - oy)}px)`;
                ui.seek.style.width = Math.round(bestRect.width) + 'px';
                ui.seek.hidden = false;
                if (!state.seekRaf)
                    state.seekRaf = requestAnimationFrame(seekTick);
            }
        }
        else {
            ui.seek.hidden = true;
            state.seekVideo = null;
        }
    }
    if (state.pinned) {
        if (!state.pinned.isConnected) {
            unpin();
        }
        else {
            const { ratio } = vis(state.pinned);
            if (state.mode === 'mini' && ratio >= 0.6)
                unpin();
            else if (ratio < 0.6)
                state.pinned.dataset.speediaPin = '1';
            else
                delete state.pinned.dataset.speediaPin;
        }
    }
    if (!fs && !state.pinned && settings.autoPip && autoAllowed()) {
        for (const v of armed) {
            if (!v.isConnected) {
                armed.delete(v);
                continue;
            }
            if (suppressed.has(v) || !audible(v))
                continue;
            // O site costuma pausar o vídeo um pouco antes de ele sair da tela.
            const sitePaused = performance.now() - (autoPaused.get(v) || -1e9) < 3000;
            if (v.paused && !sitePaused)
                continue;
            const { r, ratio } = vis(v);
            if (r.width && ratio < 0.35) {
                pin(v, 'mini');
                v.dataset.speediaPin = '1';
                break;
            }
        }
    }
}
