/* od-menu: side menu drawer (mobile + desktop).
   Loaded after theme.js, so window.OD (openModal/closeModal/setAccordion/$/$$/on) is available.
   - Header hamburger [data-open-mobile-nav] now opens the "menu" modal (drawer) instead of the old mobile nav.
   - Level-2 panels slide in over level 1 inside the same drawer; back slides them out; close closes everything.
   - Inside a level-2 panel only one accordion is open at a time. */
(function () {
  'use strict';
  var OD = window.OD || {};
  var $ = OD.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = OD.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var OPEN = 'is-open';

  function drawer() { return $('[data-side-menu]'); }
  function openModal(name) { if (OD.openModal) OD.openModal(name); }

  // 1. Hamburger: capture-phase so theme.js's old mobile-nav handler (and the generic data-open-modal handler) never run.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-open-mobile-nav]') : null;
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openModal('menu');
  }, true);

  function showPanel(root, idx) {
    var panel = $('[data-sm-panel="' + idx + '"]', root);
    if (!panel) return;
    $$('.od-sm__panel--l2.' + OPEN, root).forEach(function (p) { if (p !== panel) hidePanel(p); });
    var body = $('.od-sm__body', panel);
    if (body) body.scrollTop = 0;
    panel.classList.add(OPEN);
    panel.setAttribute('aria-hidden', 'false');
    $$('[data-sm-open]', root).forEach(function (b) { b.setAttribute('aria-expanded', b.getAttribute('data-sm-open') === String(idx) ? 'true' : 'false'); });
  }
  function hidePanel(panel) {
    panel.classList.remove(OPEN);
    panel.setAttribute('aria-hidden', 'true');
  }
  function resetPanels(root) {
    $$('.od-sm__panel--l2', root).forEach(hidePanel);
    $$('[data-sm-open]', root).forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    var l1 = $('[data-sm-level1] .od-sm__body', root);
    if (l1) l1.scrollTop = 0;
  }

  // 2. Level 1 -> level 2, back, keyboard support for the div "buttons"
  document.addEventListener('click', function (e) {
    var root = drawer();
    if (!root || !e.target.closest || !root.contains(e.target)) return;
    var open = e.target.closest('[data-sm-open]');
    if (open) { e.preventDefault(); showPanel(root, open.getAttribute('data-sm-open')); return; }
    var back = e.target.closest('[data-sm-back]');
    if (back) { e.preventDefault(); var p = back.closest('.od-sm__panel--l2'); if (p) hidePanel(p); $$('[data-sm-open]', root).forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (!t || !t.closest || !t.matches('[data-sm-back], [data-close-modal="menu"]')) return;
    e.preventDefault();
    t.click();
  });

  // 3. Only one accordion open per level-2 panel (theme.js toggles the clicked one; runs before this bubble listener).
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-accordion-toggle]');
    if (!t || e.target.closest('a')) return;
    var panel = t.closest('.od-sm__panel--l2');
    if (!panel) return;
    var acc = t.closest('[data-accordion]');
    $$('[data-accordion]', panel).forEach(function (other) {
      if (other === acc) return;
      var c = $('[data-accordion-content]', other);
      if (c && c.hasAttribute('data-accordion-open') && OD.setAccordion) OD.setAccordion(other, false);
    });
  });

  // 4. Reset to level 1 after the drawer has closed (modal system removes the show class; watch for it).
  function init() {
    var root = drawer();
    if (!root) return;
    var showCls = root.getAttribute('data-show-class') || 'od-sm--show';
    var timer = null;
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var shown = root.classList.contains(showCls);
        clearTimeout(timer);
        if (!shown) timer = setTimeout(function () { resetPanels(root); }, 400);
      }).observe(root, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('od:modal:open', function (e) {
      if (!e.detail || e.detail.name !== 'menu') return;
      clearTimeout(timer);
      var close = $('[data-sm-level1] [data-close-modal="menu"]', root);
      if (close && close.focus) setTimeout(function () { try { close.focus({ preventScroll: true }); } catch (err) { /* noop */ } }, 450);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
