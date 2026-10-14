// Compartilhado entre o content script, o popup e a página de boas-vindas.

// Texto localizado (_locales). Se a API falhar (ex.: extensão recarregada), devolve a própria chave.
function speediaMsg(key, ...subs) {
  try {
    return chrome.i18n.getMessage(key, subs) || key;
  } catch {
    return key;
  }
}

// Preenche os elementos marcados com data-i18n (texto), data-i18n-title e data-i18n-aria-label e define <html lang>.
function speediaApplyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = speediaMsg(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = speediaMsg(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', speediaMsg(el.dataset.i18nAriaLabel));
  }
}

// Um atalho é guardado como texto: modificadores + código físico da tecla, ex.: "Ctrl+Shift+KeyF".
// Texto vazio significa atalho desativado.
var SPEEDIA_ACTIONS = [
  { id: 'fullscreen', label: speediaMsg('actFullscreenLabel'), hint: speediaMsg('actFullscreenHint'), def: 'KeyF' },
  { id: 'mute', label: speediaMsg('actMuteLabel'), hint: speediaMsg('actMuteHint'), def: 'KeyM' },
  { id: 'speedUp', label: speediaMsg('actSpeedUpLabel'), hint: speediaMsg('actSpeedUpHint'), def: 'Shift+Period' },
  { id: 'speedDown', label: speediaMsg('actSpeedDownLabel'), hint: speediaMsg('actSpeedDownHint'), def: 'Shift+Comma' },
  { id: 'speedReset', label: speediaMsg('actSpeedResetLabel'), hint: speediaMsg('actSpeedResetHint'), def: 'Shift+Digit1' },
];

function speediaDefaultShortcuts() {
  const out = {};
  for (const a of SPEEDIA_ACTIONS) out[a.id] = a.def;
  return out;
}

function speediaCombo(e) {
  if (!e.code || ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return '';
  let combo = '';
  if (e.ctrlKey) combo += 'Ctrl+';
  if (e.altKey) combo += 'Alt+';
  if (e.shiftKey) combo += 'Shift+';
  if (e.metaKey) combo += 'Meta+';
  return combo + e.code;
}

function speediaPretty(combo) {
  if (!combo) return '';
  const parts = combo.split('+');
  const code = parts.pop();
  const names = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: speediaMsg('keySpace'), Period: '.', Comma: ',' };
  const key = names[code] || code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
  return [...parts, key].join(' + ');
}
