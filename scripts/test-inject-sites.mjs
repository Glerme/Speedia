import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

// Roda o inject.ts real (world MAIN) contra respostas JSON de TikTok, Facebook,
// Instagram e X, capturando os eventos speedia:media.
const result = await build({ entryPoints: ['src/inject/index.ts'], bundle: true, write: false, format: 'cjs' });
const bundle = result.outputFiles[0].text;
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(edition = 'full') {
    const records = [];
    let pending = null;
    let paused = 0;
    const domReady = [];
    const scripts = [];

    const originalFetch = async () => pending;
    const window = {
        fetch: originalFetch,
        addEventListener() {},
        dispatchEvent(event) {
            for (const record of JSON.parse(event.detail)) records.push(record);
        },
    };
    class CustomEvent {
        constructor(type, init) { this.type = type; this.detail = init?.detail; }
    }
    class XMLHttpRequestStub {
        constructor() { this.listeners = {}; this.responseType = ''; }
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    }
    const originalOpen = XMLHttpRequestStub.prototype.open = function () {};
    class HTMLMediaElementStub {
        constructor() { this.dataset = {}; }
        pause() { paused++; }
    }

    const context = {
        module: { exports: {} },
        window,
        CustomEvent,
        XMLHttpRequest: XMLHttpRequestStub,
        HTMLMediaElement: HTMLMediaElementStub,
        URL,
        SPEEDIA_EDITION: edition,
        document: {
            addEventListener(type, fn) { if (type === 'DOMContentLoaded') domReady.push(fn); },
            querySelectorAll: () => scripts,
        },
    };
    runInNewContext(bundle, context);

    const send = async (url, body) => {
        pending = { url, clone: () => ({ text: async () => body }) };
        await window.fetch(url);
        await tick();
    };

    const sendXhr = async (url, body, responseType = '') => {
        const request = new XMLHttpRequestStub();
        request.open('GET', url);
        request.responseType = responseType;
        if (responseType === 'json') request.response = body;
        else request.responseText = body;
        for (const fn of request.listeners.load || []) fn.call(request);
        await tick();
    };

    return {
        edition, window, records, scripts, send, sendXhr,
        originalFetch, originalOpen,
        XHR: XMLHttpRequestStub,
        HTMLMediaElement: HTMLMediaElementStub,
        fireDomReady() { for (const fn of domReady) fn(); },
    };
}

function take(site, records) {
    return records.filter((record) => record.id.startsWith(site + ':'));
}

// ---------------------------------------------------------------- TikTok
{
    const site = setup();
    assert.notEqual(site.window.fetch, site.originalFetch, 'fetch deve ser interceptado na edição full');
    assert.notEqual(site.XHR.prototype.open, site.originalOpen, 'XHR deve ser interceptado na edição full');

    const id = '7234567890123456789';
    await site.send('https://www.tiktok.com/api/item/detail/?itemId=' + id, JSON.stringify({
        itemList: [{
            id,
            video: {
                duration: 15,
                playAddr: 'https://v16.tiktokcdn.com/play.mp4',
                downloadAddr: 'https://v16.tiktokcdn.com/download.mp4',
                bitrateInfo: [
                    { Bitrate: 500000, PlayAddr: { UrlList: ['https://v16.tiktokcdn.com/low.mp4'] } },
                    { Bitrate: 2500000, PlayAddr: { UrlList: ['https://v16.tiktokcdn.com/high.mp4'] } },
                ],
            },
        }],
    }));
    assert.deepEqual(take('tt', site.records), [{
        id: 'tt:' + id, keys: [id], duration: 15, url: 'https://v16.tiktokcdn.com/high.mp4',
    }], 'TikTok /api/ deve escolher o maior bitrate');

    const embeddedId = '7111222333444555666';
    site.scripts.push({
        textContent: JSON.stringify({
            __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: {
                id: embeddedId,
                video: { duration: 31, downloadAddr: { UrlList: ['https://v16.tiktokcdn.com/embedded.mp4'] } },
            } } } },
        }),
    });
    site.fireDomReady();
    assert.deepEqual(take('tt', site.records).at(-1), {
        id: 'tt:' + embeddedId, keys: [embeddedId], duration: 31, url: 'https://v16.tiktokcdn.com/embedded.mp4',
    }, 'TikTok __UNIVERSAL_DATA_FOR_REHYDRATION__ deve gerar registro');
    assert.equal(take('tt', site.records).length, 2);
    console.log('TikTok /api/ e JSON embutido: ok');
}

// ---------------------------------------------------------------- Facebook
{
    const site = setup();
    const id = '1234567890';
    await site.send('https://www.facebook.com/api/graphql/', 'for (;;);' + JSON.stringify({
        id,
        browser_native_hd_url: 'https://video.xx.fbcdn.net/hd.mp4',
        browser_native_sd_url: 'https://video.xx.fbcdn.net/sd.mp4',
        playable_duration_in_ms: 12500,
    }));
    assert.deepEqual(take('fb', site.records), [{
        id: 'fb:' + id, keys: [id], duration: 12.5, url: 'https://video.xx.fbcdn.net/hd.mp4',
    }], 'Facebook com prefixo for (;;); deve preferir HD');

    const first = { id: '111', playable_url: 'https://video.fbcdn.net/a.mp4', length_in_second: 7 };
    const second = { id: '222', browser_native_sd_url: 'https://video.fbcdn.net/b.mp4', playable_duration_in_ms: 3000 };
    await site.send('https://www.facebook.com/api/graphql/', JSON.stringify(first) + '\n' + JSON.stringify(second));
    assert.deepEqual(take('fb', site.records).slice(1), [{
        id: 'fb:111', keys: ['111'], duration: 7, url: 'https://video.fbcdn.net/a.mp4',
    }, {
        id: 'fb:222', keys: ['222'], duration: 3, url: 'https://video.fbcdn.net/b.mp4',
    }], 'Facebook multilinha deve gerar um registro por JSON');
    console.log('Facebook for (;;); e multilinha: ok');
}

// ---------------------------------------------------------------- Regressões 9d56eed
{
    const site = setup();
    await site.send('https://www.tiktok.com/api/item/detail/', JSON.stringify({
        itemList: [{ id: '8000000000000000001', video: { duration: 5, playAddr: 'http://v16.tiktokcdn.com/insecure.mp4' } }],
    }));
    await site.send('https://www.facebook.com/api/graphql/', JSON.stringify({
        id: '900', playable_duration_in_ms: 5000, browser_native_hd_url: 'http://video.xx.fbcdn.net/insecure.mp4',
    }));
    assert.deepEqual(site.records, [], 'URL http em TikTok e Facebook deve ser recusada');
    console.log('TikTok e Facebook recusam URL http: ok');
}

{
    const site = setup();
    await site.send('https://www.facebook.com/api/graphql/', JSON.stringify({
        id: '333',
        playable_duration_in_ms: 9000,
        videoDeliveryLegacyFields: {
            browser_native_hd_url: 'https://video.xx.fbcdn.net/legacy-hd.mp4',
            browser_native_sd_url: 'https://video.xx.fbcdn.net/legacy-sd.mp4',
        },
    }));
    await site.send('https://www.facebook.com/api/graphql/', JSON.stringify({
        id: '444',
        length_in_second: 6,
        videoDeliveryLegacyFields: { browser_native_sd_url: 'https://video.xx.fbcdn.net/legacy-sd.mp4' },
    }));
    assert.deepEqual(take('fb', site.records), [{
        id: 'fb:333', keys: ['333'], duration: 9, url: 'https://video.xx.fbcdn.net/legacy-hd.mp4',
    }, {
        id: 'fb:444', keys: ['444'], duration: 6, url: 'https://video.xx.fbcdn.net/legacy-sd.mp4',
    }], 'Facebook deve ler URLs de videoDeliveryLegacyFields usando id/duração do pai');
    console.log('Facebook videoDeliveryLegacyFields: ok');
}

{
    const site = setup();
    await site.send('https://www.facebook.com/api/graphql/', JSON.stringify({
        id: '555',
        length_in_second: 4,
        browser_native_sd_url: 'https://video.fbcdn.net/parent.mp4',
        videoDeliveryLegacyFields: { browser_native_hd_url: 'https://video.fbcdn.net/child-hd.mp4' },
    }));
    assert.deepEqual(take('fb', site.records), [{
        id: 'fb:555', keys: ['555'], duration: 4, url: 'https://video.fbcdn.net/child-hd.mp4',
    }], 'URL no pai e no filho não deve duplicar o registro');
    console.log('Facebook pai e filho sem duplicata: ok');
}

// ---------------------------------------------------------------- XHR
{
    const site = setup();
    const id = '7334567890123456789';
    await site.sendXhr('https://www.tiktok.com/api/item/detail/?itemId=' + id, {
        itemList: [{ id, video: { duration: 8, playAddr: 'https://v16.tiktokcdn.com/xhr.mp4' } }],
    }, 'json');
    assert.deepEqual(take('tt', site.records), [{
        id: 'tt:' + id, keys: [id], duration: 8, url: 'https://v16.tiktokcdn.com/xhr.mp4',
    }], 'XHR com responseType json deve gerar registro');
    console.log('TikTok via XMLHttpRequest: ok');
}

// ---------------------------------------------------------------- Instagram e X
{
    const site = setup();
    await site.send('https://www.instagram.com/graphql/query/', JSON.stringify({
        data: { xdt_api__v1__media__shortcode__web_info: { items: [{
            code: 'CabcDEF123',
            pk: '987654321',
            video_versions: [
                { url: 'https://scontent.cdninstagram.com/sd.mp4', width: 480, height: 270 },
                { url: 'https://scontent.cdninstagram.com/hd.mp4', width: 1080, height: 1920 },
            ],
            video_duration: 12.5,
        }] } },
    }));
    await site.send('https://x.com/i/api/graphql/abc', JSON.stringify({
        globalObjects: { tweets: { 123: {
            id_str: '123',
            media_url_https: 'https://pbs.twimg.com/media/AbCdEf.jpg',
            video_info: {
                variants: [
                    { content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/low.mp4' },
                    { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/high.mp4' },
                ],
                duration_millis: 10000,
            },
        } } },
    }));
    assert.deepEqual(take('ig', site.records), [{
        id: 'ig:987654321', code: 'CabcDEF123', duration: 12.5, url: 'https://scontent.cdninstagram.com/hd.mp4',
    }], 'Instagram deve manter o registro com code e maior resolução');
    assert.deepEqual(take('x', site.records), [{
        id: 'x:123', keys: ['123', '/media/AbCdEf'], duration: 10, url: 'https://video.twimg.com/high.mp4',
    }], 'X deve manter o registro com keys e maior bitrate');
    console.log('Instagram e X: ok');
}

// ---------------------------------------------------------------- Edição store
{
    const site = setup('store');
    assert.equal(site.window.fetch, site.originalFetch, 'store não deve interceptar fetch');
    assert.equal(site.XHR.prototype.open, site.originalOpen, 'store não deve interceptar XHR');
    site.scripts.push({
        textContent: JSON.stringify({ itemList: [{ id: '123', video: { playAddr: 'https://v16.tiktokcdn.com/x.mp4' } }] }),
    });
    site.fireDomReady();
    await site.send('https://www.tiktok.com/api/item/detail/', JSON.stringify({ id: '123', video: { playAddr: 'https://v16.tiktokcdn.com/x.mp4' } }));
    assert.deepEqual(site.records, [], 'edição store não deve capturar mídia');
    console.log('Edição store sem captura: ok');
}

console.log('inject de mídia TikTok, Facebook, Instagram, X e store: todos os checks passaram');
