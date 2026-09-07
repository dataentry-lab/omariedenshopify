/* od-home: "Just Arrived" / "Privé Live" row animation (sections/just-arrived.liquid).
   Every N seconds the last card is moved to the start and the whole row slides right by one card (Net-a-Porter Live:
   translateX(-(card + gap)) -> 0, 800ms ease-in-out). Infinite loop over the same products. Pauses while the mouse is over a card, when a drawer
   is open, when off screen or the tab is hidden. */
(function () {
  'use strict';
  var OD = window.OD || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(sec) {
    if (sec._odLive) return;
    sec._odLive = true;
    var row = sec.querySelector('[data-od-live-row]');
    var viewport = sec.querySelector('[data-od-live-viewport]');
    if (!row || row.children.length < 2) return;
    var speed = Math.max(1, parseFloat(sec.getAttribute('data-speed') || '3')) * 1000;
    // slide duration: 800ms, shorter when the interval is short (1s -> 600ms) so one slide always ends before the next
    var dur = Math.min(800, Math.round(speed * 0.6));
    row.style.setProperty('--od-live-dur', dur + 'ms');
    var mobile = window.matchMedia('(max-width: 767px)');
    function applyVisible() {
      var v = mobile.matches ? sec.getAttribute('data-visible-mobile') || '2.5' : sec.getAttribute('data-visible') || '6';
      row.style.setProperty('--od-live-visible', v);
    }
    applyVisible();
    if (mobile.addEventListener) mobile.addEventListener('change', applyVisible); else if (mobile.addListener) mobile.addListener(applyVisible);

    var paused = false, visible = true, busy = false, timer = null, busySince = 0;
    // live checks instead of latched flags (a missed mouseleave / focusout can never freeze the row)
    var canHover = window.matchMedia('(hover: hover)').matches; // touch devices keep :hover after a tap, so only mouse devices pause
    // pause only while the mouse is over a product card (image or text), not the whole section (client 7 Sep)
    function hovering() { if (!canHover) return false; try { return !!row.querySelector('.od-live__card:hover'); } catch (e) { return false; } }
    function focused() { return canHover && document.activeElement && sec.contains(document.activeElement) && document.activeElement !== document.body; }
    function modalOpen() {
      if (!OD.openModals || !OD.openModals.size) return false;
      var any = false;
      OD.openModals.forEach(function (n) { var m = document.querySelector('[data-modal="' + n + '"]'); if (m && m.classList.contains(m.getAttribute('data-show-class'))) any = true; });
      return any;
    }
    var rtl = document.documentElement.dir === 'rtl' || sec.closest('[dir=rtl]') !== null;
    function gapPx() {
      var g = parseFloat(getComputedStyle(row).columnGap || getComputedStyle(row).gap || '16');
      return isNaN(g) ? 16 : g;
    }
    function finish() {
      row.classList.remove('is-shifting');
      row.style.transform = 'translateX(0)';
      busy = false;
    }
    /* Net-a-Porter Live: the last card is moved to the front (infinite loop over the same products), the row is
       shifted instantly by one card + gap so nothing appears to change, then eased back to 0 in 800ms (GPU transform).
       The card that no longer fits at the end is simply clipped by the viewport. */
    function step() {
      // drawers / modals: checked live (an open drawer pauses, closing it resumes without any click)
      if (busy && Date.now() - busySince > dur + 600) finish(); // watchdog: never stay busy
      if (modalOpen() || hovering() || focused() || !visible || busy || document.hidden || reduce) return;
      busy = true; busySince = Date.now();
      var last = row.lastElementChild;
      row.classList.remove('is-shifting');
      row.style.transform = 'translateX(0)';
      row.insertBefore(last, row.firstElementChild);
      var shift = last.getBoundingClientRect().width + gapPx();
      row.style.transform = 'translateX(' + (rtl ? shift : -shift) + 'px)';
      void row.offsetWidth; // commit the start position without a transition
      row.classList.add('is-shifting');
      var done = false;
      var onEnd = function (e) { if (e && e.target !== row) return; if (done) return; done = true; row.removeEventListener('transitionend', onEnd); finish(); };
      row.addEventListener('transitionend', onEnd);
      requestAnimationFrame(function () { row.style.transform = 'translateX(0)'; });
      setTimeout(function () { if (!done) { done = true; row.removeEventListener('transitionend', onEnd); finish(); } }, dur + 150);
    }
    function start() { stop(); timer = setInterval(step, speed); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: .15 }).observe(viewport || sec);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
    window.addEventListener('pageshow', function () { finish(); start(); });
    start();
    OD.initCards && OD.initCards(sec);
    OD.wlPaint && OD.wlPaint(sec);
  }

  function init(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-od-live]'), setup);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); }); else init();
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  OD.initLive = init;
})();
