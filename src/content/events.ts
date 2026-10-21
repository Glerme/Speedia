import { allVideos, state, settings, armed, autoPaused, suppressed, t } from './state';
import { speediaCombo, speediaDefaultShortcuts } from '../shared/shortcuts';
import { ui, toast, renderSettings, syncHost } from './ui';
import { applySpeed, setSpeed, stepSpeed } from './speed';
import { audible, recentInput, dismiss, muteOther, sizeMini, unpin, pin, vis, covered, toggleMute, registerTabPip } from './pip';
import { schedule } from './loop';
export function registerEvents() {
    // ---------------------------------------------------------------- eventos
    for (const t of ['pointerdown', 'click']) {
        window.addEventListener(t, (e) => e.isTrusted && (state.lastInput = performance.now()), true);
    }
    window.addEventListener('mousemove', (e) => {
        state.mx = e.clientX;
        state.my = e.clientY;
        schedule();
    }, { capture: true, passive: true });
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Eventos de mídia não atravessam shadow roots; registra também nesses roots.
    const mediaHandlers: [string, EventListener][] = [];
    const observedRoots = new WeakSet<ShadowRoot>();
    function observePlayers() {
        for (const video of allVideos()) {
            const root = video.getRootNode();
            if (!(root instanceof ShadowRoot) || observedRoots.has(root))
                continue;
            observedRoots.add(root);
            for (const [type, handler] of mediaHandlers)
                root.addEventListener(type, handler, true);
        }
    }
    setInterval(() => { observePlayers(); schedule(); }, 1000);
    const on = (type: string, fn: (video: HTMLVideoElement) => void) => {
        const handler: EventListener = (e) => {
            if (e.target instanceof HTMLVideoElement)
                fn(e.target);
        };
        mediaHandlers.push([type, handler]);
        document.addEventListener(type, handler, true);
    };
    // Outro vídeo ganhou som enquanto há um preso: se foi o usuário, troca; senão, silencia.
    function onOtherAudible(v: HTMLVideoElement) {
        if (!state.pinned || v === state.pinned || v.paused || !audible(v))
            return;
        if (recentInput())
            dismiss();
        else
            muteOther(v);
    }
    on('play', (v) => {
        applySpeed(v);
        autoPaused.delete(v);
        onOtherAudible(v);
        schedule();
    });
    on('pause', (v) => {
        if (recentInput())
            armed.delete(v);
        else
            autoPaused.set(v, performance.now());
        schedule();
    });
    on('volumechange', (v) => {
        if (!audible(v)) {
            armed.delete(v);
            if (v === state.pinned && recentInput())
                dismiss();
        }
        else {
            onOtherAudible(v);
        }
        schedule();
    });
    on('ratechange', applySpeed);
    on('loadedmetadata', (v) => {
        applySpeed(v);
        if (v === state.pinned && state.mode === 'mini')
            sizeMini(v);
        schedule();
    });
    on('ended', (v) => v === state.pinned && !v.loop && unpin());
    on('emptied', (v) => v === state.pinned && unpin());
    on('enterpictureinpicture', (v) => {
        pin(v, 'native');
        schedule();
    });
    on('leavepictureinpicture', (v) => {
        if (v === state.pinned && state.mode === 'native') {
            unpin();
            // Fechou a janela com o vídeo fora da tela: não reabrir como mini player.
            if (vis(v).ratio < 0.6)
                suppressed.add(v);
        }
        schedule();
    });
    observePlayers();
    // Atalhos de teclado (editáveis no popup). Tela cheia: vídeo com som (o preso, senão o da barra, senão o mais visível).
    function fullscreenTarget() {
        const ok = (v: HTMLVideoElement | null) => v && v.isConnected && audible(v);
        if (ok(state.pinned))
            return state.pinned;
        if (ok(state.active))
            return state.active;
        let best = null;
        let bestArea = 0;
        for (const v of allVideos()) {
            if (v.paused || !audible(v))
                continue;
            const { r, area } = vis(v);
            if (area > bestArea && !covered(v, r)) {
                bestArea = area;
                best = v;
            }
        }
        return best;
    }
    let addedControls: HTMLVideoElement | null = null; // vídeo que ganhou controles nativos só durante a tela cheia
    document.addEventListener('fullscreenchange', () => {
        if (addedControls && document.fullscreenElement !== addedControls) {
            addedControls.controls = false;
            addedControls = null;
        }
        syncHost();
        schedule();
    });
    window.addEventListener('keydown', (e) => {
        if (!e.isTrusted || e.repeat)
            return;
        const combo = speediaCombo(e);
        const action = combo && Object.keys(settings.shortcuts).find((id) => settings.shortcuts[id] === combo);
        if (!action)
            return;
        const tgt = e.composedPath()[0];
        if (tgt instanceof Element && ((tgt instanceof HTMLElement && tgt.isContentEditable) || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)))
            return;
        if (action === 'speedUp' || action === 'speedDown' || action === 'speedReset') {
            if (!state.active && !state.pinned)
                return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (action === 'speedReset') {
                setSpeed(1);
                toast(t('toastSpeed', 1));
            }
            else {
                stepSpeed(action === 'speedUp' ? 1 : -1);
            }
            return;
        }
        if (action === 'mute') {
            const target = document.fullscreenElement instanceof HTMLVideoElement ? document.fullscreenElement : state.active || state.pinned;
            if (!target)
                return;
            e.preventDefault();
            e.stopImmediatePropagation();
            state.lastInput = performance.now();
            toggleMute(target);
            return;
        }
        const fs = document.fullscreenElement;
        // Tela cheia do próprio site: não interfere.
        if (fs && !(fs instanceof HTMLVideoElement))
            return;
        const v = fs || fullscreenTarget();
        if (!v)
            return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (fs) {
            document.exitFullscreen().catch(() => { });
            return;
        }
        const hadControls = v.controls;
        v.requestFullscreen().then(() => {
            if (!hadControls) {
                v.controls = true;
                addedControls = v;
            }
        }, (err: unknown) => toast(t('toastFullscreenFail', err instanceof Error ? err.message : String(err))));
    }, true);
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    const withDefaults = (saved: unknown): Record<string, string> => {
        const shortcuts = speediaDefaultShortcuts();
        if (saved && typeof saved === 'object') {
            for (const [key, value] of Object.entries(saved))
                if (typeof value === 'string')
                    shortcuts[key] = value;
        }
        return shortcuts;
    };
    // Tema e cor de destaque: 'auto' segue prefers-color-scheme; texto sobre o accent é #fff ou #111, o de maior contraste WCAG.
    const DEFAULT_ACCENT = '#bf22ed';
    const appearance = { theme: 'auto', accent: DEFAULT_ACCENT };
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    function applyAppearance() {
        const accent = /^#[0-9a-f]{6}$/i.test(appearance.accent) ? appearance.accent : DEFAULT_ACCENT;
        const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(accent.slice(i, i + 2), 16)));
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        ui.host.style.setProperty('--accent', accent);
        ui.host.style.setProperty('--accent-fg', 1.05 / (L + 0.05) >= (L + 0.05) / 0.0556 ? '#fff' : '#111'); // 0.0556 = L(#111) + .05
        ui.host.dataset.theme = appearance.theme === 'light' || (appearance.theme !== 'dark' && !darkQuery.matches) ? 'light' : 'dark';
    }
    darkQuery.addEventListener('change', applyAppearance);
    chrome.storage.sync.get({ autoPip: true, tabPip: false, shortcuts: {}, theme: 'auto', accent: DEFAULT_ACCENT }).then((s) => {
        if (typeof s.theme === 'string')
            appearance.theme = s.theme;
        if (typeof s.accent === 'string')
            appearance.accent = s.accent;
        applyAppearance();
        if (typeof s.autoPip === 'boolean')
            settings.autoPip = s.autoPip;
        if (typeof s.tabPip === 'boolean')
            settings.tabPip = s.tabPip;
        registerTabPip();
        settings.shortcuts = withDefaults(s.shortcuts);
        renderSettings();
    });
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.tabPip) {
            if (typeof changes.tabPip.newValue === 'boolean')
                settings.tabPip = changes.tabPip.newValue;
            registerTabPip();
        }
        if (changes.autoPip) {
            if (typeof changes.autoPip.newValue === 'boolean')
                settings.autoPip = changes.autoPip.newValue;
            if (!settings.autoPip && state.mode === 'mini')
                unpin();
        }
        if (changes.shortcuts)
            settings.shortcuts = withDefaults(changes.shortcuts.newValue);
        if (changes.theme || changes.accent) {
            if (changes.theme && typeof changes.theme.newValue === 'string')
                appearance.theme = changes.theme.newValue;
            if (changes.accent && typeof changes.accent.newValue === 'string')
                appearance.accent = changes.accent.newValue;
            applyAppearance();
        }
        renderSettings();
    });
    applyAppearance();
    renderSettings();
    schedule();
}
