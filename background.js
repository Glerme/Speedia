// Só baixa de CDNs conhecidas: a URL vem da página, então não confiamos nela cegamente.
const ALLOWED_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net|twimg\.com)$/;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'download') return;

  let url;
  try {
    url = new URL(msg.url);
  } catch {
    sendResponse({ ok: false, error: 'URL inválida' });
    return;
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.test(url.hostname)) {
    sendResponse({ ok: false, error: 'origem não permitida' });
    return;
  }

  const filename = String(msg.filename || 'video.mp4').replace(/[^\w.-]+/g, '_');
  chrome.downloads.download({ url: url.href, filename }, () => {
    const err = chrome.runtime.lastError;
    sendResponse(err ? { ok: false, error: err.message } : { ok: true });
  });
  return true;
});
