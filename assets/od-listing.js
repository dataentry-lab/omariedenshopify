/* od-listing — collection / search listing behaviour (loaded after theme.js, window.OD available)
   - sort / filter / category buttons load the results in the background (fetch + history.pushState), no page reload;
     the grid shows skeleton cards and the toolbar an "Updating" spinner while loading
   - infinite scroll with skeleton placeholder cards
   - desktop grid toggle 4 / 5 per row (remembered for the session)
   - sticky toolbar: measures the header into --od-header-h, toggles `is-stuck`
   - filter drawer category tree drill-in / back */
(function () {
  'use strict';
  var OD = window.OD || {};
  var $ = OD.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = OD.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ===================== filter drawer: category tree ===================== */
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-ft-go]');
    if (!go) return;
    var tree = go.closest('[data-ft]');
    if (!tree) return;
    e.preventDefault();
    showPanel(tree, go.getAttribute('data-ft-go'));
  });
  function showPanel(tree, id) {
    var found = false;
    $$('[data-ft-panel]', tree).forEach(function (p) {
      var on = p.getAttribute('data-ft-panel') === id;
      p.hidden = !on;
      if (on) { found = true; p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }
    });
    if (!found) { var root = $('[data-ft-panel="root"]', tree); if (root) root.hidden = false; }
    var acc = tree.closest('[data-accordion-content]');
    if (acc && acc.hasAttribute('data-accordion-open')) acc.style.height = 'auto';
  }
  function initTrees(root) {
    $$('[data-ft]', root || document).forEach(function (tree) { showPanel(tree, tree.getAttribute('data-ft-start') || 'root'); });
  }
  initTrees();

  var listing = $('[data-listing]');
  if (!listing) return;

  /* ===================== helpers ===================== */
  var header = $('[data-header]');
  var mq = window.matchMedia('(max-width: 767px)');
  var headerH = 0;
  var io = null;
  var COLS_KEY = 'od_grid_cols';

  function measureHeader() {
    var h = header ? Math.round(header.getBoundingClientRect().height) : 0;
    if (h !== headerH) { headerH = h; document.documentElement.style.setProperty('--od-header-h', h + 'px'); return true; }
    return false;
  }
  var controls = function () { return $('[data-listing-controls]', listing); };
  var sentinelEl = function () { return $('[data-listing-sentinel]', listing); };
  var toolbar = function () { return $('[data-listing-toolbar]', listing); };
  var grid = function () { return $('[data-product-grid]', listing); };

  function setStuck(stuck) { var c = controls(); if (c) c.classList.toggle('is-stuck', !!stuck); }
  var ticking = false;
  function evalDesktop() {
    var t = toolbar();
    if (!t) return;
    t.classList.toggle('is-stuck', t.getBoundingClientRect().top <= headerH + 1 && window.scrollY > 10);
  }
  window.addEventListener('scroll', function () {
    if (mq.matches || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; evalDesktop(); });
  }, { passive: true });
  function evaluate() {
    var s = sentinelEl();
    if (!mq.matches) { setStuck(false); evalDesktop(); return; }
    var t = toolbar(); if (t) t.classList.remove('is-stuck');
    if (!s) { setStuck(false); return; }
    setStuck(s.getBoundingClientRect().top < headerH);
  }
  function observe() {
    if (io) { io.disconnect(); io = null; }
    var s = sentinelEl();
    if (!s || !controls() || !('IntersectionObserver' in window)) return;
    if (!mq.matches) { setStuck(false); evalDesktop(); return; }
    io = new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      setStuck(!e.isIntersecting && e.boundingClientRect.top < headerH);
    }, { rootMargin: '-' + headerH + 'px 0px 0px 0px', threshold: [0, 1] });
    io.observe(s);
    evaluate();
  }
  function refreshSticky() { var changed = measureHeader(); if (changed || !io) observe(); else evaluate(); }

  /* ===================== grid columns (desktop 4 / 5) ===================== */
  function applyCols(cols) {
    var g = grid();
    if (!g) return;
    g.setAttribute('data-cols', cols);
    $$('[data-grid-cols]', listing).forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-grid-cols') === String(cols)); b.setAttribute('aria-pressed', b.getAttribute('data-grid-cols') === String(cols) ? 'true' : 'false'); });
  }
  function savedCols() { try { return sessionStorage.getItem(COLS_KEY) || ''; } catch (e) { return ''; } }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-grid-cols]');
    if (!b) return;
    e.preventDefault();
    var cols = b.getAttribute('data-grid-cols');
    applyCols(cols);
    try { sessionStorage.setItem(COLS_KEY, cols); } catch (err) {}
  });

  /* ===================== skeletons ===================== */
  function skeletonCard() {
    return '<div class="od-skel-card" aria-hidden="true"><div class="od-skel od-skel-card__img"></div><div class="od-skel od-skel--line" style="width:40%"></div><div class="od-skel od-skel--line" style="width:80%"></div><div class="od-skel od-skel--line" style="width:30%"></div></div>';
  }
  function skeletons(n) { var out = ''; for (var i = 0; i < n; i++) out += skeletonCard(); return out; }
  function colsNow() {
    var g = grid();
    if (!g) return 4;
    if (mq.matches) return 2;
    return parseInt(g.getAttribute('data-cols') || '4', 10) || 4;
  }

  /* ===================== AJAX load (sort / filter / categories / back-forward) ===================== */
  var loading = null;
  function setUpdating(on) {
    var t = toolbar();
    if (t) t.classList.toggle('is-updating', !!on);
    listing.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  function reinit(root) {
    OD.initCards && OD.initCards(root);
    OD.wlPaint && OD.wlPaint(root);
    var saved = savedCols();
    if (saved) applyCols(saved);
    refreshSticky();
    observeLoadMore();
    initTrees(document);
  }
  function load(url, push) {
    var g = grid();
    if (!g) { window.location.href = url; return; }
    var token = loading = {};
    setUpdating(true);
    g.innerHTML = skeletons(colsNow() * 2);
    var lm = $('[data-load-more]', listing); if (lm) lm.innerHTML = '';
    // keep the toolbar in view while results change
    var t = toolbar();
    if (t) { var top = t.getBoundingClientRect().top; if (top < headerH || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - headerH - 8, behavior: 'smooth' }); }
    fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        if (token !== loading) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = $('[data-listing]', doc);
        if (!fresh) { window.location.href = url; return; }
        listing.innerHTML = fresh.innerHTML;
        // the filter drawer lives outside the listing: refresh it too (active states / counts)
        var fm = $('[data-modal="filter"]'), fmNew = $('[data-modal="filter"]', doc);
        if (fm && fmNew) fm.innerHTML = fmNew.innerHTML;
        var bc = $('[data-breadcrumbs]'), bcNew = $('[data-breadcrumbs]', doc);
        if (bc && bcNew && !listing.contains(bc)) bc.innerHTML = bcNew.innerHTML;
        if (doc.title) document.title = doc.title;
        if (push) history.pushState({ odListing: true }, '', url);
        reinit(listing);
        setUpdating(false);
        loading = null;
        document.dispatchEvent(new CustomEvent('od:listing:load', { detail: { url: url } }));
      })
      .catch(function () { window.location.href = url; });
  }
  OD.listingLoad = load;

  function sameListing(href) {
    try {
      var u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) return false;
      var here = window.location.pathname;
      var isSearch = /\/search\/?$/.test(here) || /\/search\/?$/.test(u.pathname);
      if (isSearch) return /\/search\/?$/.test(u.pathname) && /\/search\/?$/.test(here);
      return /\/collections\//.test(u.pathname) || /\/collections\/?$/.test(u.pathname);
    } catch (e) { return false; }
  }
  // category buttons, filter drawer links, reset link
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    var a = e.target.closest('[data-listing-cats] a, [data-filter-form] a.od-ft__row, [data-filter-form] a._resetBtn_rmug7_149, [data-listing-ajax] a');
    if (!a || !sameListing(a.href)) return;
    e.preventDefault();
    if (OD.openModals && OD.openModals.has('filter') && OD.closeModal) OD.closeModal('filter');
    load(a.href, true);
  });
  // filter form apply
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-filter-form]');
    if (!form) return;
    var action = form.getAttribute('action') || window.location.pathname;
    if (!sameListing(action)) return;
    e.preventDefault();
    var params = new URLSearchParams(new FormData(form));
    var url = action + (params.toString() ? '?' + params.toString() : '');
    if (OD.closeModal) OD.closeModal('filter');
    load(url, true);
  });
  // sort select (custom select in the toolbar)
  document.addEventListener('od:select', function (e) {
    var box = e.target.closest && e.target.closest('[data-sort-select]');
    if (!box || !listing.contains(box)) return;
    var url = new URL(window.location.href);
    url.searchParams.set('sort_by', e.detail.value);
    url.searchParams.delete('page');
    load(url.toString(), true);
  });
  window.addEventListener('popstate', function () { if (grid()) load(window.location.href, false); });

  /* ===================== infinite scroll with skeleton cards ===================== */
  var lmIo = null;
  var lmLoading = false;
  function observeLoadMore() {
    if (lmIo) { lmIo.disconnect(); lmIo = null; }
    var s = $('[data-load-more]', listing);
    if (!s || !s.getAttribute('data-next-url') || !('IntersectionObserver' in window)) return;
    lmIo = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || lmLoading) return;
      var next = s.getAttribute('data-next-url');
      if (!next) { lmIo.disconnect(); return; }
      lmLoading = true;
      var g = grid();
      var holder = document.createElement('div');
      holder.className = 'od-listing__skel-page';
      holder.setAttribute('data-skel-page', '');
      holder.innerHTML = skeletons(colsNow());
      Array.prototype.slice.call(holder.children).forEach(function (c) { c.setAttribute('data-skel-page', ''); g.appendChild(c); });
      fetch(next, { headers: { Accept: 'text/html' }, credentials: 'same-origin' })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var newGrid = $('[data-product-grid]', doc);
          var newSentinel = $('[data-load-more]', doc);
          $$('[data-skel-page]', g).forEach(function (c) { c.remove(); });
          if (newGrid) {
            var frag = document.createDocumentFragment();
            Array.prototype.slice.call(newGrid.children).forEach(function (c) { c.classList.add('od-fade-in'); frag.appendChild(c); });
            g.appendChild(frag);
            OD.initCards && OD.initCards(g);
            OD.wlPaint && OD.wlPaint(g);
          }
          s.setAttribute('data-next-url', newSentinel ? (newSentinel.getAttribute('data-next-url') || '') : '');
          if (!s.getAttribute('data-next-url')) lmIo.disconnect();
          lmLoading = false;
        })
        .catch(function () { $$('[data-skel-page]', g).forEach(function (c) { c.remove(); }); lmLoading = false; });
    }, { rootMargin: '600px' });
    lmIo.observe(s);
  }

  /* ===================== boot ===================== */
  measureHeader();
  observe();
  observeLoadMore();
  var saved = savedCols();
  if (saved) applyCols(saved); else applyCols(grid() ? (grid().getAttribute('data-cols') || '4') : '4');
  if ('ResizeObserver' in window && header) new ResizeObserver(function () { refreshSticky(); }).observe(header);
  window.addEventListener('resize', (OD.debounce ? OD.debounce(refreshSticky, 100) : refreshSticky));
  if (mq.addEventListener) mq.addEventListener('change', refreshSticky); else if (mq.addListener) mq.addListener(refreshSticky);
  window.addEventListener('load', refreshSticky);
  document.addEventListener('keydown', function (e) {
    var sort = e.target.closest && e.target.closest('[data-sort-select]');
    if (sort && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sort.click(); }
  });
})();
