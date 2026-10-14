import { speediaMsg } from './i18n';

// Um atalho é guardado como texto: modificadores + código físico da tecla, ex.: "Ctrl+Shift+KeyF".
// Texto vazio significa atalho desativado.
export const SPEEDIA_ACTIONS = [
  { id: 'fullscreen', label: speediaMsg('actFullscreenLabel'), hint: speediaMsg('actFullscreenHint'), def: 'KeyF' },
  { id: 'mute', label: speediaMsg('actMuteLabel'), hint: speediaMsg('actMuteHint'), def: 'KeyM' },
  { id: 'speedUp', label: speediaMsg('actSpeedUpLabel'), hint: speediaMsg('actSpeedUpHint'), def: 'Shift+Period' },
  { id: 'speedDown', label: speediaMsg('actSpeedDownLabel'), hint: speediaMsg('actSpeedDownHint'), def: 'Shift+Comma' },
  { id: 'speedReset', label: speediaMsg('actSpeedResetLabel'), hint: speediaMsg('actSpeedResetHint'), def: 'Shift+Digit1' },
] satisfies { id: string; label: string; hint: string; def: string }[];

export function speediaDefaultShortcuts(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of SPEEDIA_ACTIONS) out[a.id] = a.def;
  return out;
}

export function speediaCombo(e: KeyboardEvent): string {
  if (!e.code || ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return '';
  let combo = '';
  if (e.ctrlKey) combo += 'Ctrl+';
  if (e.altKey) combo += 'Alt+';
  if (e.shiftKey) combo += 'Shift+';
  if (e.metaKey) combo += 'Meta+';
  return combo + e.code;
}

export function speediaPretty(combo: string): string {
  if (!combo) return '';
  const parts = combo.split('+');
  const code = parts.pop()!;
  const names: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: speediaMsg('keySpace'), Period: '.', Comma: ',' };
  const key = names[code] || code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
  return [...parts, key].join(' + ');
}
