// Stub de chrome.* para rodar o código real da extensão numa página comum.
// O shadow root do content.js é fechado; força 'open' para o build poder clicar nos botões da barra.
const attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init) {
  return (window.__sr = attachShadow.call(this, { ...init, mode: 'open' }));
};

const load = (path) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', path, false);
  xhr.send();
  return JSON.parse(xhr.responseText);
};
const messages = load('/ext/_locales/en/messages.json');
const manifest = load('/ext/manifest.json');

const data = {};
const listeners = [];
const pick = (keys) => {
  if (keys == null) return { ...data };
  if (typeof keys === 'string') keys = [keys];
  const out = {};
  if (Array.isArray(keys)) {
    for (const k of keys) if (k in data) out[k] = data[k];
  } else {
    for (const [k, d] of Object.entries(keys)) out[k] = k in data ? data[k] : d;
  }
  return out;
};
// A API real aceita callback ou devolve Promise (welcome.js usa callback, o resto usa Promise).
const api = (fn) => (...args) => {
  const cb = typeof args.at(-1) === 'function' ? args.pop() : null;
  const res = fn(...args);
  if (cb) {
    cb(res);
    return undefined;
  }
  return Promise.resolve(res);
};

window.chrome = {
  i18n: {
    getUILanguage: () => 'en',
    getMessage(key, subs) {
      const m = messages[key];
      if (!m) return '';
      const list = [].concat(subs ?? []);
      return m.message.replace(/\$(\d)/g, (_, i) => list[i - 1] ?? '').replace(/\$[A-Z_]+\$/g, (x) => list[0] ?? x);
    },
  },
  storage: {
    sync: {
      get: api(pick),
      set: api((items) => {
        const changes = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: data[k], newValue: v };
          data[k] = v;
        }
        listeners.forEach((l) => l(changes, 'sync'));
      }),
    },
    onChanged: { addListener: (l) => listeners.push(l) },
  },
  runtime: { getManifest: () => manifest, sendMessage: async () => ({}) },
};

// Estado inicial vindo da URL do harness: ?store={"theme":"dark"}
Object.assign(data, JSON.parse(new URLSearchParams(location.search).get('store') || '{}'));
