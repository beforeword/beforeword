/* Local copy feedback. No entered or copied text is stored or sent. */
(() => {
  'use strict';
  const states = new WeakMap();
  const ru = (document.documentElement.lang || '').startsWith('ru');

  // Keep links to material inside folded sections reachable on all four pages.
  function revealHash() {
    if (!window.location.hash) return;
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let opened = false;
    for (let parent = target; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open) {
        parent.open = true;
        opened = true;
      }
    }
    if (opened) window.requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }
  window.addEventListener('hashchange', revealHash);
  revealHash();

  function fallbackCopy(text) {
    const active = document.activeElement;
    const selection = document.getSelection();
    const ranges = [];
    if (selection) {
      for (let i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
    }
    let fieldSelection = null;
    if (active && typeof active.selectionStart === 'number') {
      fieldSelection = [active.selectionStart, active.selectionEnd, active.selectionDirection];
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.readOnly = true;
    area.tabIndex = -1;
    area.setAttribute('aria-hidden', 'true');
    Object.assign(area.style, {
      position: 'fixed', left: '0', top: '0', width: '1px', height: '1px',
      padding: '0', border: '0', opacity: '0', fontSize: '16px'
    });
    document.body.appendChild(area);
    try {
      area.focus({ preventScroll: true });
      area.select();
      area.setSelectionRange(0, area.value.length);
      if (!document.execCommand('copy')) throw new Error('Copy was not accepted');
    } finally {
      area.remove();
      if (active && active.isConnected && typeof active.focus === 'function') {
        active.focus({ preventScroll: true });
        if (fieldSelection && typeof active.setSelectionRange === 'function') {
          active.setSelectionRange(...fieldSelection);
        }
      }
      if (selection && ranges.length) {
        selection.removeAllRanges();
        ranges.forEach(range => selection.addRange(range));
      }
    }
  }

  async function write(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (_) {
        // A denied Clipboard API request can still permit a user-initiated copy.
      }
    }
    fallbackCopy(text);
  }

  document.addEventListener('click', async event => {
    const origin = event.target instanceof Element ? event.target : event.target.parentElement;
    const button = origin && origin.closest('[data-copy-target], [data-copy-text]');
    if (!button) return;
    event.preventDefault();
    let state = states.get(button);
    if (!state) {
      const status = document.createElement('span');
      status.className = 'bw-copy-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      button.insertAdjacentElement('afterend', status);
      state = { status, busy: false, timer: null, label: button.getAttribute('data-label-copy') || button.textContent };
      states.set(button, state);
    }
    if (state.busy) return;
    const targetId = button.getAttribute('data-copy-target');
    const target = targetId ? document.getElementById(targetId) : null;
    const text = target ? target.textContent : button.getAttribute('data-copy-text');
    window.clearTimeout(state.timer);
    button.textContent = state.label;
    if (text === null || text === '') {
      state.status.textContent = ru ? 'Текст для копирования не найден.' : 'No text is available to copy.';
      return;
    }
    state.busy = true;
    button.setAttribute('aria-busy', 'true');
    state.status.textContent = ru ? 'Копирование…' : 'Copying…';
    try {
      await write(text);
      button.textContent = button.getAttribute('data-label-copied') || (ru ? 'Скопировано' : 'Copied');
      state.status.textContent = button.getAttribute('data-status-copied') ||
        (button.hasAttribute('data-copy-text') ? (ru ? 'Тест скопирован.' : 'Test copied.') : (ru ? 'Текст скопирован.' : 'Text copied.'));
      state.timer = window.setTimeout(() => { button.textContent = state.label; }, 2000);
    } catch (_) {
      button.textContent = state.label;
      state.status.textContent = ru ? 'Не удалось скопировать. Выдели и скопируй текст вручную.' : 'Copy failed. Select the text and copy it manually.';
    } finally {
      state.busy = false;
      button.removeAttribute('aria-busy');
    }
  });
})();
