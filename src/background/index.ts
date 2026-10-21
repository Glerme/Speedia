import { speediaNewer, speediaPendingUpdate } from '../shared/update';

// Só baixa de CDNs conhecidas: a URL vem da página, então não confiamos nela cegamente.
const ALLOWED_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net|twimg\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokv\.com|redd\.it)$/;

// A edição da loja não tem download de vídeos (edition.js ausente = completa).
if (chrome.downloads && globalThis.SPEEDIA_EDITION !== 'store') chrome.runtime.onMessage.addListener((msg: { type?: string; url: string; filename?: unknown }, _sender, sendResponse) => {
  if (msg?.type !== 'download') return;

  let url: URL;
  try {
    url = new URL(msg.url);
  } catch {
    sendResponse({ ok: false, error: chrome.i18n.getMessage('errInvalidUrl') });
    return;
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.test(url.hostname)) {
    sendResponse({ ok: false, error: chrome.i18n.getMessage('errOriginNotAllowed') });
    return;
  }

  const filename = String(msg.filename || 'video.mp4').replace(/[^\w.-]+/g, '_');
  chrome.downloads.download({ url: url.href, filename }, () => {
    const err = chrome.runtime.lastError;
    sendResponse(err ? { ok: false, error: err.message } : { ok: true });
  });
  return true;
});

// Abre a página de boas-vindas só na primeira instalação (não em atualizações).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

// Nova versão no GitHub: só na edição completa fora do Firefox (o Firefox se atualiza pelo updates.json).
const UPDATE_ALARM = 'speedia-update';
const showBadge = (on: boolean) => chrome.action.setBadgeText({ text: on ? 'NEW' : '' }).catch(() => {});

async function checkUpdate(): Promise<void> {
  try {
    const res = await fetch('https://api.github.com/repos/Glerme/Speedia/releases/latest');
    if (!res.ok) return;
    const tag = String(((await res.json()) as { tag_name?: unknown }).tag_name ?? '');
    const version = tag.replace(/^v/, '');
    // Resposta externa: só aceita x.y.z e monta o link nós mesmos.
    if (!/^\d+\.\d+\.\d+$/.test(version)) return;
    const update = speediaNewer(version, chrome.runtime.getManifest().version)
      ? { version, url: `https://github.com/Glerme/Speedia/releases/tag/v${version}` }
      : null;
    await chrome.storage.local.set({ update });
    showBadge(!!update);
  } catch { /* sem rede: tenta no próximo alarme */ }
}

if (globalThis.SPEEDIA_EDITION !== 'store' && chrome.alarms && !chrome.runtime.getURL('').startsWith('moz-extension:')) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === UPDATE_ALARM) checkUpdate();
  });
  // Recriar o alarme a cada despertar do service worker zeraria o prazo; só cria se não existir.
  chrome.alarms.get(UPDATE_ALARM).then((a) => {
    if (!a) chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: 1, periodInMinutes: 24 * 60 });
  });
  // O selo some ao reiniciar o navegador e deve sumir depois que a extensão é atualizada.
  chrome.storage.local.get('update').then((s) => showBadge(!!speediaPendingUpdate(s.update)));
}
