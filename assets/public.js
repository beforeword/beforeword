'use strict';
(() => {
  const status = document.getElementById('copy-status');
  let timer;
  function notify(key) {
    status.textContent = status.dataset[key];
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ''; }, 6500);
  }
  async function copy(button) {
    const source = document.getElementById(button.dataset.copyTarget);
    if (!source) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(source.tagName === 'TEXTAREA' ? source.value : source.textContent);
      notify('copied');
    } catch (_) {
      const disclosure = button.dataset.copyDetails && document.getElementById(button.dataset.copyDetails);
      if (disclosure) disclosure.open = true;
      try {
        source.focus();
        if (source.tagName === 'TEXTAREA') {
          source.select();
          source.setSelectionRange(0, source.value.length);
        } else {
          const selection = window.getSelection();
          if (!selection) throw new Error('selection unavailable');
          const range = document.createRange();
          range.selectNodeContents(source);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        source.scrollIntoView({block: 'nearest'});
        notify('selected');
      } catch (_) {
        notify('failed');
      }
    }
  }
  document.querySelectorAll('[data-copy-target]').forEach(button => {
    button.addEventListener('click', () => copy(button));
  });
  const disclosures = ['instruction-details', 'medium-details', 'compact-details']
    .map(id => [id, document.getElementById(id)]).filter(([, node]) => node);
  if (disclosures.length) {
    for (const [id, node] of disclosures) {
      document.querySelectorAll('a[href$="#' + id + '"]').forEach(link => {
        link.addEventListener('click', () => { node.open = true; });
      });
    }
    const revealLinkedInstruction = () => {
      for (const [id, node] of disclosures) {
        if (window.location.hash === '#' + id) node.open = true;
      }
    };
    window.addEventListener('hashchange', revealLinkedInstruction);
    revealLinkedInstruction();
  }
  document.documentElement.classList.add('js-ready');
})();
