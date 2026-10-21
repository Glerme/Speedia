import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Complementa test-multisite.mjs: lá já ficam IDs, nomes, permutações Reddit,
// fallbacks e shadow roots. Aqui ficam detecção por hostname, allowlist do
// background, regressão de IG/X e presença dos sites novos no manifest.
async function bundle(entry, stubs = {}) {
    const result = await build({
        entryPoints: [entry], bundle: true, write: false, format: 'cjs',
        plugins: Object.keys(stubs).length ? [{ name: 'stubs', setup(build) {
            build.onResolve({ filter: /^\.\// }, ({ path }) => stubs[path] ? { path, namespace: 'stub' } : undefined);
            build.onLoad({ filter: /.*/, namespace: 'stub' }, ({ path }) => ({ contents: stubs[path] }));
        } }] : [],
    });
    return result.outputFiles[0].text;
}

// ---------------------------------------------------------------- detecção de site
const stateCode = await bundle('src/content/state.ts');
const siteOf = (hostname) => {
    const context = { module: { exports: {} }, location: { hostname }, HTMLVideoElement: class {} };
    runInNewContext(stateCode, context);
    return context.module.exports.site;
};
for (const [hostname, expected] of [
    ['instagram.com', 'ig'], ['www.instagram.com', 'ig'],
    ['x.com', 'x'], ['www.x.com', 'x'], ['twitter.com', 'x'], ['mobile.twitter.com', 'x'],
    ['tiktok.com', 'tiktok'], ['www.tiktok.com', 'tiktok'],
    ['facebook.com', 'fb'], ['web.facebook.com', 'fb'], ['www.facebook.com', 'fb'],
    ['reddit.com', 'reddit'], ['old.reddit.com', 'reddit'],
    ['reddit.com.evil.com', 'x'],
])
    assert.equal(siteOf(hostname), expected, hostname);

// ---------------------------------------------------------------- allowlist do background
const backgroundCode = await bundle('src/background/index.ts');
let listener;
let downloads = [];
const chrome = {
    downloads: { download(options, callback) { downloads.push(options); callback(); } },
    runtime: {
        onMessage: { addListener(value) { listener = value; } },
        onInstalled: { addListener() {} },
        lastError: undefined,
        getURL: (path) => path,
    },
    i18n: { getMessage: (key) => key },
    tabs: { create() {} },
};
runInNewContext(backgroundCode, { module: { exports: {} }, chrome, URL });
assert.equal(typeof listener, 'function');

function sendDownload(url, filename = 'video.mp4') {
    let response;
    listener({ type: 'download', url, filename }, {}, (value) => { response = value; });
    return response;
}
for (const url of [
    'https://v16-webapp.tiktokcdn.com/video.mp4',
    'https://p16-sign.tiktokcdn-us.com/video.mp4',
    'https://v19.tiktokv.com/video.mp4',
    'https://v.redd.it/abc123/video.mp4',
    'https://scontent.cdninstagram.com/video.mp4',
    'https://video.fbcdn.net/video.mp4',
    'https://video.twimg.com/video.mp4',
]) {
    downloads = [];
    assert.deepEqual({ ...sendDownload(url) }, { ok: true }, url);
    assert.equal(downloads.length, 1, url);
    assert.equal(downloads[0].url, new URL(url).href);
}

for (const url of [
    'http://v16-webapp.tiktokcdn.com/video.mp4',
    'https://eviltiktokcdn.com/video.mp4',
    'https://tiktokcdn.com.evil.com/video.mp4',
    'https://tiktokcdn-us.com.evil.com/video.mp4',
    'https://notredd.it/video.mp4',
    'https://example.com/video.mp4',
]) {
    downloads = [];
    assert.deepEqual({ ...sendDownload(url) }, { ok: false, error: 'errOriginNotAllowed' }, url);
    assert.equal(downloads.length, 0, url);
}
downloads = [];
assert.deepEqual({ ...sendDownload('não é uma url') }, { ok: false, error: 'errInvalidUrl' });
assert.equal(downloads.length, 0);

// ---------------------------------------------------------------- IG e X sem mudança
const mediaCode = await bundle('src/content/media.ts', {
    './state': 'export const {site, entries} = globalThis; export const STORE = false, t = x => x;',
    './ui': 'export const toast = () => {};',
});
async function download({ site, video, media = [], pathname = '/' }) {
    let message;
    const context = {
        module: { exports: {} }, site, URL, ShadowRoot: class {},
        entries: new Map(media.map((item) => [item.id, item])),
        location: { hostname: '', pathname, search: '' },
        document: { body: {} },
        chrome: { runtime: { async sendMessage(value) { message = value; return { ok: true }; } } },
    };
    runInNewContext(mediaCode, context);
    await context.module.exports.download(video);
    return message;
}
const articleWith = (href) => ({ querySelector: (selector) => selector.includes(href.includes('/status/') ? '/status/' : '/p/') ? { getAttribute: () => href } : null });
const igVideo = (href, duration = 10) => ({
    duration, poster: '', currentSrc: '', parentElement: null,
    closest: () => articleWith(href), querySelectorAll: () => [], getRootNode: () => ({}),
});
const igCarousel = [
    { id: 'curto', code: 'ABCdef123', duration: 9, url: 'https://cdninstagram.example/a.mp4' },
    { id: 'longo', code: 'ABCdef123', duration: 20, url: 'https://cdninstagram.example/b.mp4' },
    { id: 'outro', code: 'ZZZ', duration: 10, url: 'https://cdninstagram.example/c.mp4' },
];
for (const href of ['/p/ABCdef123/', '/reel/ABCdef123/']) {
    const result = await download({ site: 'ig', video: igVideo(href), media: igCarousel });
    assert.equal(result.url, 'https://cdninstagram.example/a.mp4', href);
    assert.equal(result.filename, 'instagram_ABCdef123.mp4', href);
}

const xVideo = {
    duration: 5, currentSrc: '', parentElement: null,
    poster: 'https://pbs.twimg.com/ext_tw_video_thumb/1234567890/pu/img/abc.jpg',
    closest: () => articleWith('/usuario/status/9876543210'),
    querySelectorAll: () => [], getRootNode: () => ({}),
};
const xResult = await download({
    site: 'x', video: xVideo,
    media: [{ id: 'x:1', keys: ['1234567890'], duration: 5, url: 'https://video.twimg.com/video.mp4' }],
});
assert.equal(xResult.url, 'https://video.twimg.com/video.mp4');
assert.equal(xResult.filename, 'x_9876543210.mp4');

// ---------------------------------------------------------------- manifest cobre os 3 sites
const manifest = JSON.parse(await readFile(new URL('../static/manifest.json', import.meta.url), 'utf8'));
const matches = manifest.content_scripts.flatMap((script) => script.matches);
for (const host of ['tiktok.com', 'facebook.com', 'reddit.com'])
    assert.ok(matches.some((match) => match.includes(`*.${host}/*`)), host);

console.log('Media multi-site: hostnames, allowlist, IG/X e manifest passaram');
