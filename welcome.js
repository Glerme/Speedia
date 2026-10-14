// Monta a tabela com os atalhos atuais (padrões + o que o usuário personalizou).
function renderShortcuts(saved) {
  const shortcuts = { ...speediaDefaultShortcuts(), ...saved };
  const body = document.getElementById('shortcuts-body');
  body.replaceChildren();

  for (const action of SPEEDIA_ACTIONS) {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = action.label;
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = action.hint;
    th.append(" ", hint);

    const td = document.createElement('td');
    const pretty = speediaPretty(shortcuts[action.id]);
    if (pretty) {
      const kbd = document.createElement('kbd');
      kbd.textContent = pretty;
      td.append(kbd);
    } else {
      td.className = 'off';
      td.textContent = 'Desativado';
    }

    tr.append(th, td);
    body.append(tr);
  }
}

renderShortcuts({});
chrome.storage.sync.get('shortcuts', (res) => {
  if (!chrome.runtime.lastError) renderShortcuts(res?.shortcuts);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.shortcuts) renderShortcuts(changes.shortcuts.newValue);
});
