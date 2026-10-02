'use strict';
(() => {
  const root = document.querySelector('.bw-update-shell');
  if (!root) return;
  const disclosure = root.querySelector('#bw-updates');
  const feedback = root.querySelector('.bw-update-feedback');
  function notify(key) {
    feedback.textContent = feedback.dataset[key] || '';
  }
  async function copy(button) {
    const field = document.getElementById(button.dataset.updateCopy);
    if (!field || !root.contains(field)) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(field.value);
      notify(button.dataset.updateCopy === 'bw-update-feed-url' ? 'feedCopied' : 'copied');
    } catch (_) {
      try {
        const container = field.closest('details');
        if (container) container.open = true;
        field.focus();
        field.select();
        field.setSelectionRange(0, field.value.length);
        notify('selected');
      } catch (_) {
        notify('failed');
      }
    }
  }
  root.querySelectorAll('[data-update-copy]').forEach(button => {
    button.addEventListener('click', () => copy(button));
  });
  function revealLinkedUpdates() {
    if (location.hash === '#bw-updates' && disclosure) disclosure.open = true;
  }
  window.addEventListener('hashchange', revealLinkedUpdates);
  revealLinkedUpdates();
  root.classList.add('bw-update-ready');
})();
