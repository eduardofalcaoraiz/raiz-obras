(function () {
  'use strict';
  const opened = new Map();
  let top = null, frame = 0, sequence = 0;
  const candidates = 'button,input,select,textarea,a[href],area[href],iframe,summary,[tabindex],[contenteditable="true"]';
  const visible = el => el.isConnected && !!el.getClientRects().length &&
    getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert],[hidden]');
  const nativeOpen = () => !!document.querySelector('dialog[open]');
  function targets(modal) {
    return [...modal.querySelectorAll(candidates)].filter(el => visible(el) &&
      el.tabIndex >= 0 && !el.matches(':disabled')).sort((a, b) =>
      (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
  }
  function focus(modal) {
    const autofocus = modal.querySelector('[autofocus]');
    (autofocus && visible(autofocus) && !autofocus.matches(':disabled') ? autofocus : modal).focus({preventScroll:true});
  }
  function prepare(overlay) {
    const modal = overlay.querySelector('.modal');
    if (!modal || modal.closest('dialog')) return null;
    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    if (!modal.hasAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');
    if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
    if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) {
      const heading = modal.querySelector('.mhead h2,h1,h2,h3');
      if (heading) {
        if (!heading.id) {
          do { heading.id = 'platform-dialog-title-' + (++sequence); } while (document.querySelectorAll('#' + heading.id).length > 1);
        }
        modal.setAttribute('aria-labelledby', heading.id);
      } else modal.setAttribute('aria-label', 'Janela');
    }
    return modal;
  }
  function sync() {
    const overlays = [...document.querySelectorAll('.overlay.show')].filter(el =>
      !el.closest('dialog,#sidebar') && visible(el) && el.querySelector('.modal'));
    const previous = top;
    for (const overlay of overlays) {
      if (!opened.has(overlay)) opened.set(overlay, {modal:prepare(overlay), restore:document.activeElement});
    }
    // Equal z-index overlays paint in document order, not opening order.
    overlays.sort((a, b) => (parseFloat(getComputedStyle(a).zIndex) || 0) - (parseFloat(getComputedStyle(b).zIndex) || 0));
    top = opened.get(overlays.at(-1)) || null;
    let restore = previous?.restore;
    const visited = new Set();
    while (restore && !visible(restore) && !visited.has(restore)) {
      visited.add(restore);
      restore = [...opened.values()].find(item => item.modal?.contains(restore))?.restore;
    }
    for (const overlay of opened.keys()) if (!overlays.includes(overlay)) opened.delete(overlay);
    if (nativeOpen()) return;
    if (previous !== top && restore && visible(restore) && (!top || top.modal.contains(restore))) restore.focus({preventScroll:true});
    if (top?.modal && !top.modal.contains(document.activeElement)) focus(top.modal);
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); });
  }
  function init() {
    new MutationObserver(schedule).observe(document.body, {subtree:true, childList:true,
      attributes:true, attributeFilter:['class','style','hidden','disabled','open']});
    document.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || nativeOpen()) return;
      sync();
      if (!top?.modal) return;
      const list = targets(top.modal), index = list.indexOf(document.activeElement);
      event.preventDefault();
      event.stopPropagation();
      const next = index < 0 ? (event.shiftKey ? list.length - 1 : 0) :
        (index + (event.shiftKey ? -1 : 1) + list.length) % list.length;
      (list[next] || top.modal).focus();
    }, true);
    document.addEventListener('focusin', () => {
      if (top?.modal && visible(top.modal) && !nativeOpen() && !top.modal.contains(document.activeElement)) focus(top.modal);
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
