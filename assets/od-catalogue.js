/* od-catalogue: catalogue book reader (round 11). Markup: sections/main-catalogue.liquid, styles: assets/od-catalogue.css.
   One page at a time. Turning a page peels it from the outer edge: the page is cut into vertical strips that rotate
   around a moving fold line (near the fold they bend, past it they lie flat on their back), which reads as paper curling.
   Forward: the current page peels away and the next one waits underneath. Back: the same animation played in reverse.
   Drag on touch follows the finger, release past 35% finishes the turn. Product tiles open the shared quick view (od-card.js). */
(function () {
  'use strict';
  if (window.__odCatalogue) return;
  window.__odCatalogue = true;
  var OD = window.OD || (window.OD = {});
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var STRIPS = 12, DUR = 1000, CURL = 3.2;
  var ease = function (p) { return p < .5 ? 2 * p * p : -1 + (4 - 2 * p) * p; };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    var pages = $$('[data-cat-page]', root);
    if (!pages.length) return;
    var rtl = root.getAttribute('data-dir') === 'rtl';
    var book = $('[data-cat-book]', root), under = $('[data-cat-under]', root), cur = $('[data-cat-current]', root), strips = $('[data-cat-strips]', root);
    var prevBtn = $('[data-cat-prev]', root), nextBtn = $('[data-cat-next]', root), count = $('[data-cat-count]', root), prog = $('[data-cat-progress]', root);
    var thumbsBtn = $('[data-cat-thumbs]', root), thumbStrip = $('[data-cat-thumbstrip]', root), hint = $('[data-cat-hint]', root);
    var N = pages.length, i = 0, busy = false, drag = null;
    var m = (location.hash || '').match(/^#p(\d+)$/);
    if (m) i = Math.max(0, Math.min(N - 1, parseInt(m[1], 10) - 1));

    function clone(k) { var c = pages[k].cloneNode(true); c.removeAttribute('data-cat-page'); return c; }
    function render() {
      strips.innerHTML = ''; under.innerHTML = '';
      cur.innerHTML = ''; cur.appendChild(clone(i)); cur.style.visibility = '';
      if (count) count.textContent = i + 1;
      if (prog) prog.style.width = ((i + 1) / N * 100) + '%';
      if (prevBtn) prevBtn.disabled = i === 0;
      if (nextBtn) nextBtn.disabled = i === N - 1;
      $$('[data-cat-go]', root).forEach(function (t) { t.classList.toggle('is-on', parseInt(t.getAttribute('data-cat-go'), 10) === i); });
      try { history.replaceState(null, '', location.pathname + location.search + '#p' + (i + 1)); } catch (e) { /* noop */ }
      OD.fadeImages && OD.fadeImages(cur);
      OD.wlPaint && OD.wlPaint(cur);
    }

    /* build the strips for a turn: `front` is the page that turns, `back` is what its reverse shows */
    function buildStrips(front, back) {
      strips.innerHTML = '';
      var W = book.clientWidth, w = W / STRIPS, arr = [];
      for (var k = 0; k < STRIPS; k++) {
        var s = document.createElement('div'); s.className = 'od-cat__strip'; s.style.width = (w + .8) + 'px';
        var f = document.createElement('div'); f.className = 'od-cat__strip-f';
        var fp = clone(front); fp.style.width = W + 'px'; fp.style.left = (-k * w) + 'px'; f.appendChild(fp);
        var b = document.createElement('div'); b.className = 'od-cat__strip-b';
        var bp = clone(back); bp.style.width = W + 'px'; bp.style.left = (-(W - (k + 1) * w)) + 'px'; b.appendChild(bp);
        var sh = document.createElement('div'); sh.className = 'od-cat__strip-shade';
        sh.style.background = rtl ? 'linear-gradient(270deg, rgba(0,0,0,.3), rgba(0,0,0,0))' : 'linear-gradient(90deg, rgba(0,0,0,.3), rgba(0,0,0,0))';
        s.appendChild(f); s.appendChild(b); s.appendChild(sh); strips.appendChild(s); arr.push(s);
      }
      return { list: arr, W: W, w: w };
    }
    /* p = 0 flat (page in place), p = 1 fully turned */
    function paint(S, p) {
      var W = S.W, w = S.w, fold = W * (1 - p);
      S.list.forEach(function (s, k) {
        var x = k * w, d = x - fold, ang = 0, left = x, tx = 0;
        if (d > 0) { ang = Math.min(180, 180 * (d / (w * CURL))); left = fold; tx = fold - x; }
        var lift = Math.sin(Math.min(Math.PI, (d / (w * CURL)) * Math.PI)) * 12;
        if (rtl) {
          s.style.left = ''; s.style.right = left + 'px';
          s.style.transform = 'translateX(' + (-tx) + 'px) rotateY(' + ang + 'deg)';
        } else {
          s.style.right = ''; s.style.left = left + 'px';
          s.style.transform = 'translateX(' + tx + 'px) rotateY(' + (-ang) + 'deg)';
        }
        s.style.zIndex = d > 0 ? 100 + k : k;
        var mid = ang > 0 && ang < 180;
        s.lastChild.style.opacity = mid ? Math.sin(ang * Math.PI / 180) * .85 : 0;
        s.style.filter = mid && lift > 0 ? 'drop-shadow(0 ' + lift + 'px ' + (lift * 1.3) + 'px rgba(0,0,0,.28))' : '';
      });
    }
    var S = null, raf = 0;
    function start(dir) {
      var to = i + dir;
      if (to < 0 || to >= N) return null;
      var fwd = dir > 0;
      S = buildStrips(fwd ? pages[i] : pages[to], fwd ? pages[to] : pages[i]);
      under.innerHTML = ''; under.appendChild(clone(fwd ? to : i));
      cur.style.visibility = 'hidden';
      S.to = to; S.fwd = fwd;
      paint(S, fwd ? 0 : 1);
      return S;
    }
    function finish(done) {
      i = done ? S.to : i;
      S = null; busy = false; render();
    }
    function animate(from, to, ms, cb) {
      cancelAnimationFrame(raf);
      var t0 = null;
      function frame(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / ms);
        paint(S, from + (to - from) * ease(p));
        if (p < 1) raf = requestAnimationFrame(frame); else cb();
      }
      raf = requestAnimationFrame(frame);
    }
    function flip(dir) {
      if (busy) return;
      if (reduced) { var to = i + dir; if (to >= 0 && to < N) { i = to; render(); } return; }
      if (!start(dir)) return;
      busy = true;
      animate(S.fwd ? 0 : 1, S.fwd ? 1 : 0, DUR, function () { finish(true); });
    }
    function goTo(k) {
      if (busy || k === i || k < 0 || k >= N) return;
      if (Math.abs(k - i) === 1) { flip(k - i); return; }
      i = k; render();
    }

    /* drag / swipe: the fold follows the finger */
    function onDown(e) {
      if (busy || e.button > 0) return;
      if (e.target.closest('button, a, [data-quick-add-open]')) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, dir: 0 };
    }
    function onMove(e) {
      if (!drag || busy && !drag.on) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        var dir = (dx < 0 ? 1 : -1) * (rtl ? -1 : 1);
        if (!start(dir)) { drag = null; return; }
        drag.on = true; drag.dir = dir; busy = true;
        try { book.setPointerCapture(drag.id); } catch (err) { /* noop */ }
      }
      var W = S.W, p = Math.max(0, Math.min(1, Math.abs(dx) / W * 1.25));
      drag.p = p;
      paint(S, S.fwd ? p : 1 - p);
      e.preventDefault();
    }
    function onUp() {
      if (!drag) return;
      if (drag.on && S) {
        var p = drag.p || 0, fwd = S.fwd;
        if (p > .35) animate(fwd ? p : 1 - p, fwd ? 1 : 0, 450, function () { finish(true); });
        else animate(fwd ? p : 1 - p, fwd ? 0 : 1, 350, function () { finish(false); });
      }
      drag = null;
    }
    book.addEventListener('pointerdown', onDown);
    book.addEventListener('pointermove', onMove);
    book.addEventListener('pointerup', onUp);
    book.addEventListener('pointercancel', onUp);
    book.addEventListener('dragstart', function (e) { e.preventDefault(); });

    prevBtn && prevBtn.addEventListener('click', function () { flip(-1); });
    nextBtn && nextBtn.addEventListener('click', function () { flip(1); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') flip(rtl ? -1 : 1);
      if (e.key === 'ArrowLeft') flip(rtl ? 1 : -1);
    });
    root.setAttribute('tabindex', '-1');
    $$('[data-cat-go]', root).forEach(function (t) { t.addEventListener('click', function () { goTo(parseInt(t.getAttribute('data-cat-go'), 10)); }); });
    thumbsBtn && thumbsBtn.addEventListener('click', function () {
      var open = thumbStrip.hidden; thumbStrip.hidden = !open; thumbsBtn.classList.toggle('is-on', open);
      if (open) { var on = $('[data-cat-go].is-on', root); on && on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
    });
    var shareBtn = $('[data-cat-share]', root);
    shareBtn && shareBtn.addEventListener('click', function () {
      var url = location.href, title = root.getAttribute('data-title') || document.title;
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      try { navigator.clipboard.writeText(url).then(function () { OD.toast && OD.toast(shareBtn.getAttribute('title') || 'Link copied'); }); } catch (e) { window.prompt('', url); }
    });
    var fullBtn = $('[data-cat-full]', root);
    function fullOn() { return document.fullscreenElement === root || root.classList.contains('is-full'); }
    fullBtn && fullBtn.addEventListener('click', function () {
      if (fullOn()) {
        if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
        root.classList.remove('is-full'); document.body.style.overflow = '';
      } else if (root.requestFullscreen) {
        root.requestFullscreen().catch(function () { root.classList.add('is-full'); document.body.style.overflow = 'hidden'; });
      } else { root.classList.add('is-full'); document.body.style.overflow = 'hidden'; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('is-full')) { root.classList.remove('is-full'); document.body.style.overflow = ''; } });
    window.addEventListener('hashchange', function () { var mm = (location.hash || '').match(/^#p(\d+)$/); if (mm) { var k = parseInt(mm[1], 10) - 1; if (k !== i) goTo(k); } });
    window.addEventListener('resize', function () { if (!busy) render(); });

    render();
    if (hint && window.matchMedia('(hover: none)').matches && N > 1) {
      var seen = false; try { seen = localStorage.getItem('od_cat_hint') === '1'; } catch (e) { /* noop */ }
      if (!seen) { hint.classList.add('is-on'); setTimeout(function () { hint.classList.remove('is-on'); }, 2600); try { localStorage.setItem('od_cat_hint', '1'); } catch (e) { /* noop */ } }
    }
  }
  function boot() { $$('[data-od-catalogue]').forEach(function (r) { if (!r.__odCat) { r.__odCat = true; init(r); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', function (e) { var r = $('[data-od-catalogue]', e.target); if (r) { r.__odCat = false; init(r); r.__odCat = true; } });
  document.addEventListener('shopify:block:select', function (e) {
    var r = e.target.closest && e.target.closest('[data-od-catalogue]'); if (!r) return;
    var pg = e.target.closest('[data-cat-page]'); if (!pg) return;
    location.hash = '#p' + (parseInt(pg.getAttribute('data-cat-page'), 10) + 1);
  });
})();
