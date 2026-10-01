/* Print all model-page text, then restore the reader's open/closed sections. */
(() => {
  'use strict';
  let folded = null;
  window.addEventListener('beforeprint', () => {
    if (folded !== null) return;
    folded = Array.from(document.querySelectorAll('#main details')).filter(item => !item.open);
    folded.forEach(item => { item.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (folded === null) return;
    folded.forEach(item => { item.open = false; });
    folded = null;
  });
})();
