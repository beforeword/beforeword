/* Shared navigation behaviour; no entered text is stored or sent. */
(() => {
  'use strict';
  const menu = document.querySelector('.bw-header .bw-menu');
  if (!menu) return;
  const trigger = menu.querySelector('summary');
  const close = (restoreFocus = false) => {
    if (!menu.open) return;
    menu.open = false;
    if (restoreFocus && trigger) trigger.focus();
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) close(true);
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) close();
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close()));
  const desktop = matchMedia('(min-width: 901px)');
  const sync = () => { if (desktop.matches) close(); };
  if (desktop.addEventListener) desktop.addEventListener('change', sync);
  else desktop.addListener(sync);
  sync();
})();
