import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

// Roda o background real com chrome e fetch falsos para checar o aviso de nova versão.
const { outputFiles: [bundle] } = await build({
    entryPoints: ['src/background/index.ts'], bundle: true, write: false, format: 'iife',
});
const flush = () => new Promise((r) => setTimeout(r, 0));

async function load({ version = '1.6.0', edition = 'full', base = 'chrome-extension://abc/', alarm = null, stored = {}, release } = {}) {
    const t = { badge: [], created: [], stored: { ...stored }, onAlarm: null };
    const chrome = {
        runtime: {
            getManifest: () => ({ version }), getURL: (p) => base + p,
            onMessage: { addListener() {} }, onInstalled: { addListener() {} },
        },
        alarms: {
            onAlarm: { addListener: (fn) => { t.onAlarm = fn; } },
            get: async () => alarm, create: (name, info) => t.created.push({ name, ...info }),
        },
        storage: { local: {
            get: async (k) => ({ [k]: t.stored[k] }),
            set: async (o) => Object.assign(t.stored, o),
        } },
        action: { setBadgeText: async ({ text }) => { t.badge.push(text); } },
    };
    const fetch = async () => (release instanceof Error ? Promise.reject(release)
        : { ok: release !== undefined, json: async () => release });
    runInNewContext(bundle.text, { chrome, fetch, SPEEDIA_EDITION: edition, console });
    await flush();
    t.check = async () => { t.onAlarm({ name: 'speedia-update' }); for (let i = 0; i < 5; i++) await flush(); };
    return t;
}

// Versão nova: grava o aviso com link montado por nós e mostra o selo.
let t = await load({ release: { tag_name: 'v1.10.0' } });
assert.deepEqual(t.created.map((c) => ({ ...c })), [{ name: 'speedia-update', delayInMinutes: 1, periodInMinutes: 1440 }]);
await t.check();
assert.deepEqual({ ...t.stored.update }, { version: '1.10.0', url: 'https://github.com/Glerme/Speedia/releases/tag/v1.10.0' });
assert.equal(t.badge.at(-1), 'NEW');

// Mesma versão ou mais antiga: limpa o aviso e o selo.
for (const tag of ['v1.6.0', 'v1.5.9']) {
    t = await load({ release: { tag_name: tag }, stored: { update: { version: '9.9.9', url: 'https://github.com/Glerme/Speedia/x' } } });
    await t.check();
    assert.equal(t.stored.update, null);
    assert.equal(t.badge.at(-1), '');
}

// Tag fora do formato, erro HTTP e falta de rede não mexem no que está gravado.
for (const release of [{ tag_name: 'v1.7.0<script>' }, undefined, new Error('offline')]) {
    t = await load({ release });
    await t.check();
    assert.equal('update' in t.stored, false);
}

// Ao abrir o service worker, o selo reflete o aviso gravado (e some depois que a extensão já foi atualizada).
t = await load({ stored: { update: { version: '1.7.0', url: 'https://github.com/Glerme/Speedia/releases/tag/v1.7.0' } } });
assert.equal(t.badge.at(-1), 'NEW');
t = await load({ version: '1.7.0', stored: { update: { version: '1.7.0', url: 'https://github.com/Glerme/Speedia/releases/tag/v1.7.0' } } });
assert.equal(t.badge.at(-1), '');
// Link fora do repositório é ignorado.
t = await load({ stored: { update: { version: '1.7.0', url: 'https://evil.example/' } } });
assert.equal(t.badge.at(-1), '');

// Alarme já existente não é recriado (recriar zeraria o prazo).
t = await load({ alarm: { name: 'speedia-update' }, release: { tag_name: 'v1.6.0' } });
assert.deepEqual(t.created, []);

// Edição da loja e Firefox não checam.
for (const opts of [{ edition: 'store' }, { base: 'moz-extension://abc/' }]) {
    t = await load({ ...opts, release: { tag_name: 'v9.0.0' } });
    assert.equal(t.onAlarm, null);
    assert.deepEqual(t.created, []);
    assert.deepEqual(t.badge, []);
}

console.log('Aviso de nova versão: comparação, selo, link, erros, alarme e edições passaram');
