import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

// Run the real PiP module with only its UI/state dependencies stubbed.
const result = await build({
    entryPoints: ['src/content/pip.ts'], bundle: true, write: false, format: 'cjs',
    plugins: [{ name: 'stubs', setup(build) {
        build.onResolve({ filter: /^\.\/(state|ui|media)$/ }, ({ path }) => ({ path, namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, ({ path }) => ({ contents: path === './state'
            ? 'export const { state, settings } = globalThis; export const allVideos = () => document.querySelectorAll("video"); export const site = "x", armed = new Set(), autoPaused = new WeakMap(), suppressed = new WeakSet(), mutedByUs = new Set(), t = x => x;'
            : path === './ui' ? 'export const ui = {}; export function toast() {} export function renderSettings() {}'
                : 'export function download() {}' }));
    } }],
});
const state = { pinned: null, active: null };
const settings = { tabPip: false };
let handler, chosen, exitCalls = 0, videos = [], top = [];
class Video {
    isConnected = true;
    paused = false;
    muted = false;
    volume = 1;
    constructor(size = 100) { this.size = size; }
    getBoundingClientRect() { return { left: 0, top: 0, right: this.size, bottom: this.size, width: this.size, height: this.size }; }
    removeAttribute() {}
    async requestPictureInPicture() { chosen = this; }
}
const context = {
    module: { exports: {} }, state, settings, HTMLVideoElement: Video, innerWidth: 1000, innerHeight: 1000,
    navigator: { mediaSession: { setActionHandler(action, value) {
        assert.equal(action, 'enterpictureinpicture'); handler = value;
    } } },
    document: {
        querySelectorAll: () => videos, elementsFromPoint: () => top, pictureInPictureElement: null,
        async exitPictureInPicture() { exitCalls++; },
    },
};
runInNewContext(result.outputFiles[0].text, context);
const { registerTabPip } = context.module.exports;
registerTabPip();
assert.equal(handler, null);
settings.tabPip = true;
registerTabPip();
assert.equal(typeof handler, 'function');
const pinned = new Video(), active = new Video(), small = new Video(100), large = new Video(200);
state.pinned = pinned;
state.active = active;
pinned.paused = true;
pinned.muted = true;
handler();
assert.equal(chosen, pinned);
pinned.isConnected = false;
handler();
assert.equal(chosen, active);
active.paused = true;
videos = [small, large];
handler();
assert.equal(chosen, large);
top = [small];
handler();
assert.equal(chosen, small);
top = [];
large.muted = true;
handler();
assert.equal(chosen, small);
context.document.pictureInPictureElement = small;
chosen = null;
handler();
assert.equal(chosen, null);
assert.equal(exitCalls, 0);
small.paused = true;
handler();
assert.equal(chosen, null);
settings.tabPip = false;
registerTabPip();
assert.equal(handler, null);
context.navigator.mediaSession.setActionHandler = () => { throw new Error('unsupported action'); };
assert.doesNotThrow(registerTabPip);
delete context.navigator.mediaSession;
assert.doesNotThrow(registerTabPip);
console.log('tab-PiP registration, selection, no-toggle and unsupported API checks passed');
