// Aviso de nova versão: só a edição completa no Chrome (zip do GitHub, "Carregar sem compactação")
// não se atualiza sozinha. O Firefox usa o updates.json e as lojas atualizam por conta própria.

export interface SpeediaUpdate {
  version: string;
  url: string;
}

// true se a versão a (x.y.z) for maior que b.
export function speediaNewer(a: string, b: string): boolean {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

// Atualização pendente gravada pelo background (chrome.storage.local 'update'), ou null se já está em dia.
export function speediaPendingUpdate(stored: unknown): SpeediaUpdate | null {
  const u = stored as SpeediaUpdate | null | undefined;
  if (!u || typeof u.version !== 'string' || typeof u.url !== 'string') return null;
  if (!u.url.startsWith('https://github.com/Glerme/Speedia/')) return null;
  return speediaNewer(u.version, chrome.runtime.getManifest().version) ? u : null;
}
