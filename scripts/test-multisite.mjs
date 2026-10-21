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
async function download(site, path, { entries = [], player = null, link = null, src = '', parent = null } = {}) {
    let message;
    const context = {
        module: { exports: {} }, site, entries: new Map(entries.map((m) => [m.id, m])), ShadowRoot,
        location: { pathname: path.split('?')[0], search: path.includes('?') ? '?' + path.split('?')[1] : '' },
        document: { body: {} }, URL,
        chrome: { runtime: { async sendMessage(value) { message = value; return { ok: true }; } } },
    };
    const video = {
        duration: 10, currentSrc: src, parentElement: parent,
        matches: () => false, querySelectorAll: (selector) => selector === 'video' ? [] : link ? [{ getAttribute: () => link }] : [],
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

// O feed contém o link do vizinho antes do post atual; não deve identificá-lo.
for (const [site, path, neighbor, local, prefix] of [
    ['tiktok', '/@perfil/video/123', '/@vizinho/video/999', '/@perfil/video/123', 'tiktok'],
    ['fb', '/videos/123', '/videos/999', '/videos/123', 'facebook'],
    ['fb', '/reel/123', '/videos/999', '/videos/123', 'facebook'],
    ['fb', '/watch/?v=123', '/videos/999', '/videos/123', 'facebook'],
]) {
    const entries = [
        { id: 'vizinho', keys: ['999'], url: 'https://cdn.exemplo/vizinho.mp4' },
        { id: 'atual', keys: ['123'], url: 'https://cdn.exemplo/atual.mp4' },
    ];
    const feed = {
        parentElement: null, matches: () => false,
        querySelectorAll: (selector) => selector === 'video' ? [{}, {}] : [{ getAttribute: () => neighbor }],
    };
    const post = {
        parentElement: feed, matches: () => false,
        querySelectorAll: (selector) => selector === 'video' ? [{}] : [],
    };
    const result = await download(site, path, { entries, parent: post });
    assert.equal(result.url, 'https://cdn.exemplo/atual.mp4');
    assert.equal(result.filename, `${prefix}_123.mp4`);
    assert.equal(await download(site, '/', { entries, parent: post }), undefined);
    post.querySelectorAll = (selector) => selector === 'video' ? [{}] : [{ getAttribute: () => local }];
    assert.equal((await download(site, '/', { entries, parent: post })).url, 'https://cdn.exemplo/atual.mp4');
}

const state = await build({ entryPoints: ['src/content/state.ts'], bundle: true, write: false, format: 'cjs' });
const video1 = {}, video2 = {}, video3 = {}, video4 = {};
for (const hostname of ['www.instagram.com', 'x.com', 'www.tiktok.com', 'www.facebook.com', 'www.reddit.com']) {
    let scans = 0;
    const queries = [];
    const root = (videos, hosts = []) => ({
        host: { isConnected: true },
        querySelectorAll(selector) {
            queries.push(selector);
            if (selector === '*') scans++;
            return selector === 'video' ? videos : hosts;
        },
    });
    const innerVideos = [video3];
    const inner = root(innerVideos);
    const outer = root([video2], [{ shadowRoot: inner }]);
    const hosts = [{ shadowRoot: outer }];
    const document = root([video1], hosts);
    const context = { module: { exports: {} }, document, location: { hostname }, HTMLVideoElement: class {} };
    runInNewContext(state.outputFiles[0].text, context);
    const { allVideos, refreshPlayerRoots } = context.module.exports;
    assert.deepEqual([...allVideos()], [video1]);
    refreshPlayerRoots();
    const reddit = hostname === 'www.reddit.com';
    assert.equal(scans, reddit ? 3 : 0);
    queries.length = 0;
    for (let frame = 0; frame < 60; frame++)
        assert.deepEqual([...allVideos()], reddit ? [video1, video2, video3] : [video1]);
    assert.deepEqual(queries, Array(60 * (reddit ? 3 : 1)).fill('video'));
    if (reddit) {
        // O cache guarda os roots, não os vídeos: um vídeo novo no root aparece sem refresh.
        innerVideos.push(video4);
        assert.deepEqual([...allVideos()], [video1, video2, video3, video4]);
        assert.equal(scans, 3);
        innerVideos.pop();
        inner.host.isConnected = false;
        assert.deepEqual([...allVideos()], [video1, video2]);
        hosts.length = 0;
        refreshPlayerRoots();
        assert.deepEqual([...allVideos()], [video1]);
        hosts.push({ shadowRoot: root([video3]) });
        assert.deepEqual([...allVideos()], [video1]);
        refreshPlayerRoots();
        assert.deepEqual([...allVideos()], [video1, video3]);
    }
}
console.log('Multi-site: IDs, nomes, permutações Reddit, fallbacks e shadow roots passaram');
