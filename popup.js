(() => {
  'use strict';

  // Textos da interface (PT-BR) concentrados aqui para facilitar a localização.
  const T = {
    pressKey: 'Pressione…',
    none: 'Nenhum',
    keyTitle: 'Clique e pressione a nova tecla (Esc cancela)',
    keyAria: (label, pretty) => `Atalho de ${label}: ${pretty}. Clique para alterar`,
    clearTitle: 'Desativar este atalho',
    clearAria: (label) => 'Desativar o atalho: ' + label,
    recording: (label) => `Pressione a nova tecla para “${label}”. Esc cancela.`,
    conflict: (pretty, other) => `${pretty} já era de “${other}”; esse atalho foi desativado.`,
    saved: 'Atalho salvo.',
    cleared: (label) => `Atalho de “${label}” desativado.`,
    reset: 'Atalhos restaurados para o padrão.',
    undo: 'Desfazer',
  };

  const list = document.getElementById('shortcuts');
  const autoPip = document.getElementById('autoPip');
  const bar = document.getElementById('bar');
  const $reset = document.getElementById('reset');
  const statusText = document.getElementById('statusText');
  const undoBtn = document.getElementById('undo');
  let shortcuts = speediaDefaultShortcuts();
  let recording = null; // id da ação esperando uma tecla
  let flashId = null; // linha a destacar no próximo render
  let undoSnapshot = null;
  let statusTimer = 0;

  document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    el.append(...children);
    return el;
  }

  function save() {
    chrome.storage.sync.set({ shortcuts }).catch(() => {});
  }

  function say(text, { undo = false } = {}) {
    clearTimeout(statusTimer);
    statusText.textContent = text;
    if (!undo) undoSnapshot = null;
    if (!undo && document.activeElement === undoBtn) $reset.focus();
    undoBtn.hidden = !undo;
    bar.classList.add('on');
    if (!recording) statusTimer = setTimeout(hideStatus, undo ? 8000 : 4000);
  }

  // A região role=status fica sempre no DOM; só o texto muda.
  function hideStatus() {
    clearTimeout(statusTimer);
    if (document.activeElement === undoBtn) $reset.focus();
    statusText.textContent = '';
    undoBtn.hidden = true;
    bar.classList.remove('on');
    undoSnapshot = null;
  }

  function focusKey(id) {
    list.querySelectorAll('.key')[SPEEDIA_ACTIONS.findIndex((a) => a.id === id)]?.focus();
  }

  // Guarda o estado atual para o botão Desfazer antes de uma mudança destrutiva.
  function snapshot() {
    return { ...shortcuts };
  }

  function render() {
    list.replaceChildren(
      ...SPEEDIA_ACTIONS.map((a) => {
        const combo = shortcuts[a.id];
        const rec = recording === a.id;
        const pretty = speediaPretty(combo) || T.none;
        const key = h('button', {
          type: 'button',
          className: 'key' + (rec ? ' rec' : combo ? '' : ' empty'),
          textContent: rec ? T.pressKey : pretty,
          title: T.keyTitle,
          onclick: () => {
            recording = rec ? null : a.id;
            if (recording) say(T.recording(a.label));
            else hideStatus();
            render();
          },
        });
        key.setAttribute('aria-label', rec ? T.recording(a.label) : T.keyAria(a.label, pretty));
        const clear = h('button', {
          type: 'button',
          className: 'clear',
          textContent: '✕',
          title: T.clearTitle,
          onclick: () => {
            recording = null;
            undoSnapshot = snapshot();
            shortcuts[a.id] = '';
            save();
            say(T.cleared(a.label), { undo: true });
            render();
            focusKey(a.id);
          },
        });
        clear.setAttribute('aria-label', T.clearAria(a.label));
        clear.disabled = !combo;
        const item = h(
          'div',
          { className: 'item' + (flashId === a.id ? ' flash' : '') },
          h('div', { className: 'text' }, a.label, h('div', { className: 'hint', textContent: a.hint })),
          key,
          clear
        );
        return item;
      })
    );
    flashId = null;
    if (recording) list.querySelector('.rec')?.focus();
  }

  function cancelRecording(refocus = true) {
    if (!recording) return;
    const id = recording;
    recording = null;
    hideStatus();
    render();
    if (refocus) focusKey(id);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!recording) return;
      if (e.key === 'Tab') return cancelRecording(); // deixa o foco seguir
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return cancelRecording();
      const combo = speediaCombo(e);
      if (!combo) return; // só modificadores por enquanto
      const target = recording;
      undoSnapshot = snapshot();
      // A mesma tecla não pode disparar duas ações: a anterior perde o atalho.
      let taken = null;
      for (const id in shortcuts) {
        if (id !== target && shortcuts[id] === combo) {
          shortcuts[id] = '';
          taken = SPEEDIA_ACTIONS.find((a) => a.id === id);
        }
      }
      shortcuts[target] = combo;
      recording = null;
      flashId = target;
      save();
      if (taken) say(T.conflict(speediaPretty(combo), taken.label), { undo: true });
      else say(T.saved);
      render();
      focusKey(target);
    },
    true
  );

  // Clicar fora da lista cancela a gravação (dentro dela, os próprios botões cuidam disso).
  document.addEventListener('mousedown', (e) => {
    if (recording && !e.target.closest('#shortcuts')) cancelRecording(false);
  });

  undoBtn.onclick = () => {
    if (!undoSnapshot) return;
    shortcuts = undoSnapshot;
    save();
    $reset.focus();
    hideStatus();
    render();
  };

  autoPip.onchange = () => chrome.storage.sync.set({ autoPip: autoPip.checked }).catch(() => {});
  $reset.onclick = () => {
    recording = null;
    undoSnapshot = snapshot();
    shortcuts = speediaDefaultShortcuts();
    save();
    say(T.reset, { undo: true });
    render();
  };

  chrome.storage.sync.get({ autoPip: true, shortcuts: {} }).then((s) => {
    autoPip.checked = s.autoPip;
    shortcuts = { ...speediaDefaultShortcuts(), ...s.shortcuts };
    render();
  }).catch(() => render());

  render();
})();
