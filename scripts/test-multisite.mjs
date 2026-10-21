import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

// Exercita o download real com mídia e DOM mínimos, sem rede nem navegador.
const media = await build({
    entryPoints: ['src/content/media.ts'], bundle: true, write: false, format: 'cjs',
    plugins: [{ name: 'dependencias', setup(build) {
        build.onResolve({ filter: /^\.\/(state|ui)$/ }, ({ path }) => ({ path, namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, ({ path }) => ({ contents: path === './state'
            ? 'export const {site, entries} = globalThis; export const STORE = false, t = x => x;'
            : 'export const toast = () => {};' }));
    } }],
});
class ShadowRoot { constructor(host) { this.host = host; } }
async function download(site, path, { entries = [], player = null, link = null, src = '' } = {}) {
    let message;
    const context = {
        module: { exports: {} }, site, entries: new Map(entries.map((m) => [m.id, m])), ShadowRoot,
        location: { pathname: path.split('?')[0], search: path.includes('?') ? '?' + path.split('?')[1] : '' },
        document: { body: {} }, URL,
        chrome: { runtime: { async sendMessage(value) { message = value; return { ok: true }; } } },
    };
    const video = {
        duration: 10, currentSrc: src, parentElement: null,
        matches: () => false, querySelectorAll: () => link ? [{ getAttribute: () => link }] : [],
        closest: () => null, getRootNode: () => player ? new ShadowRoot(player) : {},
    };
    runInNewContext(media.outputFiles[0].text, context);
    await context.module.exports.download(video);
    return message;
}
for (const [site, path, prefix] of [['tiktok', '/@perfil/video/123', 'tiktok'], ['fb', '/videos/123', 'facebook'], ['fb', '/reel/123', 'facebook'], ['fb', '/watch/?v=123', 'facebook']]) {
    const result = await download(site, path, { entries: [{ id: 'registro', keys: ['123'], url: 'https://cdn.exemplo/video.mp4' }] });
    assert.equal(result.filename, `${prefix}_123.mp4`);
    assert.equal(result.url, 'https://cdn.exemplo/video.mp4');
}
const player = {
    closest() { return this; },
    getAttribute(name) { return name === 'post-id' ? 't3_abc' : JSON.stringify({ playbackMp4s: { permutations: [
        { resolution: 360, source: { url: 'https://v.redd.it/baixo.mp4' } },
        { resolution: 1080, source: { url: 'https://v.redd.it/alto.mp4' } },
        { resolution: 2160, hasAudio: false, source: { url: 'https://v.redd.it/sem-audio.mp4' } },
    ] } }); },
};
assert.equal((await download('reddit', '/', { player })).url, 'https://v.redd.it/alto.mp4');
assert.equal((await download('reddit', '/', { player })).filename, 'reddit_abc.mp4');
assert.equal((await download('tiktok', '/', { src: 'https://cdn.exemplo/direto.mp4' })).url, 'https://cdn.exemplo/direto.mp4');
assert.equal((await download('fb', '/', { entries: [{ id: 'duracao', duration: 10, url: 'https://cdn.exemplo/duracao.mp4' }] })).url, 'https://cdn.exemplo/duracao.mp4');

const state = await build({ entryPoints: ['src/content/state.ts'], bundle: true, write: false, format: 'cjs' });
const video1 = {}, video2 = {}, video3 = {};
const root = (videos, hosts = []) => ({ querySelectorAll: (selector) => selector === 'video' ? videos : hosts });
const document = root([video1], [{ shadowRoot: root([video2], [{ shadowRoot: root([video3]) }]) }]);
const context = { module: { exports: {} }, document, location: { hostname: 'www.reddit.com' }, HTMLVideoElement: class {} };
runInNewContext(state.outputFiles[0].text, context);
assert.equal(context.module.exports.site, 'reddit');
assert.deepEqual([...context.module.exports.allVideos()], [video1, video2, video3]);
console.log('Multi-site: IDs, nomes, permutações Reddit, fallbacks e shadow roots passaram');
