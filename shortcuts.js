// Compartilhado entre o content script e o popup de configurações.

// Um atalho é guardado como texto: modificadores + código físico da tecla, ex.: "Ctrl+Shift+KeyF".
// Texto vazio significa atalho desativado.
var SPEEDIA_ACTIONS = [
  { id: 'fullscreen', label: 'Tela cheia', hint: 'No vídeo que está com som', def: 'KeyF' },
  { id: 'mute', label: 'Ligar/desligar o som', hint: 'No vídeo que está na tela', def: 'KeyM' },
  { id: 'speedUp', label: 'Aumentar a velocidade', hint: 'Sobe uma fase, ex.: 1× → 1.25×', def: 'Shift+Period' },
  { id: 'speedDown', label: 'Diminuir a velocidade', hint: 'Desce uma fase, ex.: 1.25× → 1×', def: 'Shift+Comma' },
  { id: 'speedReset', label: 'Resetar a velocidade', hint: 'Volta para 1×', def: 'Shift+Digit1' },
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
  const names = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espaço', Period: '.', Comma: ',' };
  const key = names[code] || code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
  return [...parts, key].join(' + ');
}
