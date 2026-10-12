(() => {
  'use strict';

  const list = document.getElementById('shortcuts');
  const autoPip = document.getElementById('autoPip');
  let shortcuts = speediaDefaultShortcuts();
  let recording = null; // id da ação esperando uma tecla

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    el.append(...children);
    return el;
  }

  function save() {
    chrome.storage.sync.set({ shortcuts }).catch(() => {});
  }

  function render() {
    list.replaceChildren(
      ...SPEEDIA_ACTIONS.map((a) => {
        const combo = shortcuts[a.id];
        const rec = recording === a.id;
        const key = h('button', {
          className: 'key' + (rec ? ' rec' : combo ? '' : ' empty'),
          textContent: rec ? 'Pressione…' : speediaPretty(combo) || 'Nenhum',
          title: 'Clique e pressione a nova tecla (Esc cancela)',
          onclick: () => {
            recording = rec ? null : a.id;
            render();
          },
        });
        const clear = h('button', {
          className: 'clear',
          textContent: '✕',
          title: 'Desativar este atalho',
          onclick: () => {
            recording = null;
            shortcuts[a.id] = '';
            save();
            render();
          },
        });
        clear.setAttribute('aria-label', 'Desativar o atalho: ' + a.label);
        return h(
          'div',
          { className: 'item' },
          h('div', { className: 'text' }, a.label, h('div', { className: 'hint', textContent: a.hint })),
          key,
          clear
        );
      })
    );
    if (recording) list.querySelector('.rec')?.focus();
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        recording = null;
        render();
        return;
      }
      const combo = speediaCombo(e);
      if (!combo) return; // só modificadores por enquanto
      // A mesma tecla não pode disparar duas ações: a anterior perde o atalho.
      for (const id in shortcuts) if (shortcuts[id] === combo) shortcuts[id] = '';
      shortcuts[recording] = combo;
      recording = null;
      save();
      render();
    },
    true
  );

  autoPip.onchange = () => chrome.storage.sync.set({ autoPip: autoPip.checked }).catch(() => {});
  document.getElementById('reset').onclick = () => {
    recording = null;
    shortcuts = speediaDefaultShortcuts();
    save();
    render();
  };

  chrome.storage.sync.get({ autoPip: true, shortcuts: {} }).then((s) => {
    autoPip.checked = s.autoPip;
    shortcuts = { ...speediaDefaultShortcuts(), ...s.shortcuts };
    render();
  });

  render();
})();
