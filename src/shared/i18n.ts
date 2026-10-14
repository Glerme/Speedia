// Compartilhado entre o content script, o popup e a página de boas-vindas.

// Texto localizado (_locales). Se a API falhar (ex.: extensão recarregada), devolve a própria chave.
export function speediaMsg(key: string, ...subs: string[]): string {
  try {
    return chrome.i18n.getMessage(key, subs) || key;
  } catch {
    return key;
  }
}

// Preenche os elementos marcados com data-i18n (texto), data-i18n-title e data-i18n-aria-label e define <html lang>.
export function speediaApplyI18n(): void {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = speediaMsg(el.dataset.i18n!);
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = speediaMsg(el.dataset.i18nTitle!);
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', speediaMsg(el.dataset.i18nAriaLabel!));
  }
}

