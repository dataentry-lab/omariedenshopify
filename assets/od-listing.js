/* od-listing — collection / search listing behaviour (loaded after theme.js, window.OD available)
   - sort / filter / category buttons load the results in the background (fetch + history.pushState), no page reload;
     the grid shows skeleton cards and the toolbar an "Updating" spinner while loading
   - infinite scroll with skeleton placeholder cards
   - desktop grid toggle 4 / 5 per row (remembered for the session)
   - sticky toolbar: measures the header into --od-header-h, toggles `is-stuck`
   - filter drawer category tree drill-in / back
   - round 14: filter popup (.od-fp): panes root <-> group, every change applies at once (ajax, popup stays open), Reset, live count */
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
    var fpT = tree.closest('[data-fp]');
    if (fpT) {
      var shown = $('[data-ft-panel]:not([hidden])', tree), tt = $('[data-fp-title]', fpT);
      if (shown && tt && shown.getAttribute('data-ft-label')) tt.textContent = shown.getAttribute('data-ft-label');
    }
    var acc = tree.closest('[data-accordion-content]');
    if (acc && acc.hasAttribute('data-accordion-open')) acc.style.height = 'auto';
  }
  function initTrees(root) {
    $$('[data-ft]', root || document).forEach(function (tree) { if (tree.closest('[data-fp]')) return; showPanel(tree, tree.getAttribute('data-ft-start') || 'root'); });
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

  /* ===================== category buttons: one row + "+ n more" (desktop, round 9) =====================
     Desktop (>= 768px): only the buttons that fit one row stay visible, then a "+ n more" button; clicking it shows every
     row ("Less" collapses). The active category is moved to the front when it would not fit the first row.
     Recomputed on resize and after every AJAX load. Mobile keeps the sideways scroll row (no JS). */
  var catsMq = window.matchMedia('(min-width: 768px)');
  function layoutCats(nav) {
    if (!nav) return;
    var more = $('[data-cats-more]', nav);
    var links = $$('[data-cat]', nav);
    if (!more || !links.length) return;
    if (!nav._odOrder) nav._odOrder = links.slice();
    var order = nav._odOrder;
    // reset to the original order and show everything before measuring
    order.forEach(function (a) { a.classList.remove('is-overflow'); nav.insertBefore(a, more); });
    nav.classList.remove('is-collapsed');
    if (!catsMq.matches) { more.hidden = true; nav.classList.remove('is-expanded'); return; }
    var expanded = nav.classList.contains('is-expanded');
    var width = nav.clientWidth;
    var gap = parseFloat(getComputedStyle(nav).columnGap || getComputedStyle(nav).gap || '8') || 8;
    var widths = order.map(function (a) { return a.getBoundingClientRect().width; });
    var total = widths.reduce(function (t, w, i) { return t + w + (i ? gap : 0); }, 0);
    if (total <= width + 0.5) { more.hidden = true; nav.classList.remove('is-expanded'); return; }
    var tMore = nav.getAttribute('data-t-more') || '+ __N__ more';
    var tLess = nav.getAttribute('data-t-less') || 'Less';
    more.hidden = false;
    more.textContent = tMore.replace('__N__', String(order.length));
    var moreW = more.getBoundingClientRect().width + gap;
    var fit = function (list) {
      var used = 0, n = 0;
      for (var i = 0; i < list.length; i++) {
        var w = widths[order.indexOf(list[i])] + (i ? gap : 0);
        if (used + w + moreW > width) break;
        used += w; n++;
      }
      return Math.max(1, n);
    };
    var list = order.slice();
    var active = list.filter(function (a) { return a.classList.contains('is-active'); })[0];
    var n = fit(list);
    if (active && list.indexOf(active) >= n) { list.splice(list.indexOf(active), 1); list.unshift(active); n = fit(list); }
    // second pass with the real "+ n more" width
    more.textContent = tMore.replace('__N__', String(list.length - n));
    moreW = more.getBoundingClientRect().width + gap;
    n = fit(list);
    if (active && list.indexOf(active) >= n) { list.splice(list.indexOf(active), 1); list.unshift(active); n = fit(list); }
    list.forEach(function (a, i) { nav.insertBefore(a, more); a.classList.toggle('is-overflow', i >= n); });
    more.textContent = expanded ? tLess : tMore.replace('__N__', String(list.length - n));
    more.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    nav.classList.toggle('is-collapsed', !expanded);
  }
  function initCats() { $$('[data-listing-cats]', listing).forEach(layoutCats); }
  /* ===================== mobile title: fit each " - " segment on one line (round 11) ===================== */
  function fitTitle() {
    $$('[data-listing-title].od-listing__heading--split', listing).forEach(function (h) {
      var segs = $$('.od-listing__seg', h);
      if (!segs.length) return;
      if (window.innerWidth >= 768) { h.style.fontSize = ''; return; }
      var max = 32, min = 20, size = max;
      h.style.fontSize = size + 'px';
      var w = h.clientWidth;
      function over() { for (var i = 0; i < segs.length; i++) { if (segs[i].scrollWidth > w + 1) return true; } return false; }
      while (over() && size > min) { size -= 1; h.style.fontSize = size + 'px'; }
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cats-more]');
    if (!b) return;
    e.preventDefault();
    var nav = b.closest('[data-listing-cats]');
    nav.classList.toggle('is-expanded');
    layoutCats(nav);
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
    initCats();
    fitTitle();
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
    if (t && !fpOpen()) { var top = t.getBoundingClientRect().top; if (top < headerH || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - headerH - 8, behavior: 'smooth' }); }
    var pathBefore = window.location.pathname;
    function finish(listingDoc, filterDoc, fullDoc) {
      var fresh = $('[data-listing]', listingDoc);
      if (!fresh) { window.location.href = url; return; }
      listing.innerHTML = fresh.innerHTML;
      // the filter popup / drawer lives outside the listing: refresh it too (active states / counts / summaries)
      var fm = $('[data-modal="filter"]'), fmNew = filterDoc && $('[data-modal="filter"]', filterDoc);
      if (fm && fmNew) { fm.innerHTML = fmNew.innerHTML; fpRestore(fm); }
      if (fullDoc) {
        var bc = $('[data-breadcrumbs]'), bcNew = $('[data-breadcrumbs]', fullDoc);
        if (bc && bcNew && !listing.contains(bc)) bc.innerHTML = bcNew.innerHTML;
        if (fullDoc.title) document.title = fullDoc.title;
      }
      if (push) history.pushState({ odListing: true }, '', url);
      reinit(listing);
      setUpdating(false);
      loading = null;
      document.dispatchEvent(new CustomEvent('od:listing:load', { detail: { url: url } }));
    }
    function full() {
      return fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin' })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          if (token !== loading) return;
          var doc = new DOMParser().parseFromString(html, 'text/html');
          finish(doc, doc, doc);
        });
    }
    // Section Rendering API (round 14b): only the listing section + the filter section, a fraction of the page
    var secEl = listing.closest('.shopify-section');
    var sid = secEl && secEl.id ? secEl.id.replace(/^shopify-section-/, '') : '';
    var hasFilterSec = !!$('#shopify-section-od-filter');
    var u;
    try { u = new URL(url, window.location.href); } catch (e) { u = null; }
    if (!sid || !u) { full().catch(function () { window.location.href = url; }); return; }
    var secUrl = new URL(u.toString());
    secUrl.searchParams.set('sections', sid + (hasFilterSec ? ',od-filter' : ''));
    fetch(secUrl.toString(), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('sections ' + r.status); return r.json(); })
      .then(function (json) {
        if (token !== loading) return;
        if (!json || !json[sid]) throw new Error('no section');
        var ldoc = new DOMParser().parseFromString(json[sid], 'text/html');
        var fdoc = json['od-filter'] ? new DOMParser().parseFromString(json['od-filter'], 'text/html') : null;
        finish(ldoc, fdoc, null);
        // a different collection (category link): breadcrumbs + title come from the full page, in the background
        if (u.pathname !== pathBefore) {
          fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var bc = $('[data-breadcrumbs]'), bcNew = $('[data-breadcrumbs]', doc);
            if (bc && bcNew && !listing.contains(bc)) bc.innerHTML = bcNew.innerHTML;
            if (doc.title) document.title = doc.title;
          }).catch(function () {});
        }
      })
      .catch(function () { full().catch(function () { window.location.href = url; }); });
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
    if (a.closest('[data-fp]')) {
      // popup: category links reload the listing behind and reopen the tree on the new category (types level when it has one)
      var fpA = a.closest('[data-fp]');
      fpKeep = { pane: 'cat', ft: a.hasAttribute('data-fp-cat') ? 'types' : null, scroll: 0 };
      fpBusyRow(a);
      if (a.hasAttribute('data-fp-cat')) fpSkeletonLevel(fpA, a.textContent.trim());
      fpLoading(true);
      load(a.href, true);
      return;
    }
    if (OD.openModals && OD.openModals.has('filter') && OD.closeModal) OD.closeModal('filter');
    load(a.href, true);
  });
  // filter form apply
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-filter-form]');
    if (!form) return;
    if (form.closest('[data-fp]')) { e.preventDefault(); if (OD.closeModal) OD.closeModal('filter'); return; }
    var action = form.getAttribute('action') || window.location.pathname;
    if (!sameListing(action)) return;
    e.preventDefault();
    var params = new URLSearchParams(new FormData(form));
    var url = action + (params.toString() ? (action.indexOf('?') > -1 ? '&' : '?') + params.toString() : '');
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


  /* ===================== filter popup (round 14) =====================
     Markup: snippets/modal-filter.liquid. One form, panes [data-fp-pane]; root pane lists the groups, the others hold the values.
     Any change (checkbox, price, category link, Reset) rebuilds the URL from the form and loads the listing behind (load()),
     the popup stays open; load() swaps the modal innerHTML with the fresh one (counts, summaries, chips) and fpRestore() puts the
     same pane / tree panel / scroll back without animation. "Show n results" (submit) only closes. */
  var fpKeep = null;
  var fpPriceTimer = null;
  function fpEl() { return $('[data-fp]'); }
  function fpOpen() { return !!(OD.openModals && OD.openModals.has('filter') && fpEl()); }
  function fpLoading(on) { var fp = fpEl(); if (fp) fp.classList.toggle('is-loading', !!on); }
  function fpBusyRow(el) {
    var row = el.closest('.od-ft__row, ._CheckboxButton_8c7of_30');
    if (!row || row.classList.contains('is-busy')) return;
    row.classList.add('is-busy');
    var sp = document.createElement('span'); sp.className = 'od-fp__rowspin'; sp.setAttribute('aria-hidden', 'true');
    var slot = row.querySelector('.od-fp__vc') || row.querySelector('svg');
    if (slot) slot.replaceWith(sp); else row.appendChild(sp);
  }
  function fpSkeletonLevel(fp, label) {
    // slide to a temporary tree panel with shimmer rows while the new category is fetched
    var tree = $('[data-ft]', fp);
    if (!tree) return;
    var old = $('[data-ft-panel="loading"]', tree);
    if (old) old.remove();
    var p = document.createElement('div');
    p.className = 'od-ft__panel'; p.setAttribute('data-ft-panel', 'loading'); p.setAttribute('aria-busy', 'true');
    var rows = '';
    for (var i = 0; i < 6; i++) rows += '<div class="od-fp__skel"><i></i><b style="width:' + (38 + ((i * 17) % 40)) + '%"></b></div>';
    p.innerHTML = '<p class="od-fp__eye">' + label.replace(/</g, '&lt;') + '</p>' + rows;
    tree.appendChild(p);
    setTimeout(function () { showPanel(tree, 'loading'); }, 120);
  }
  function fpShow(fp, id, instant) {
    if (!fp) return;
    if (instant) fp.classList.add('od-fp--instant');
    var root = $('[data-fp-pane="root"]', fp);
    var target = $('[data-fp-pane="' + id + '"]', fp) || root;
    var isRoot = target === root;
    $$('[data-fp-pane]', fp).forEach(function (p) { p.classList.toggle('is-on', p === target); });
    if (root) root.classList.toggle('is-left', !isRoot);
    fp.classList.toggle('is-level', !isRoot);
    var title = $('[data-fp-title]', fp);
    if (title) {
      var shownP = $('[data-ft-panel]:not([hidden])', target);
      title.textContent = isRoot ? (title.getAttribute('data-t-root') || 'Filter') : ((shownP && shownP.getAttribute('data-ft-label')) || target.getAttribute('data-fp-label') || '');
    }
    var left = $('[data-fp-left]', fp), ll = $('[data-fp-left-label]', fp);
    if (left && ll) {
      ll.textContent = isRoot ? left.getAttribute('data-t-clear') : left.getAttribute('data-t-back');
      left.classList.toggle('is-act', !isRoot || fp.hasAttribute('data-fp-cat') || !!$('[data-fp-reset]:not([hidden])', fp));
    }
    fp.setAttribute('data-fp-current', isRoot ? 'root' : id);
    if (instant) { void fp.offsetWidth; fp.classList.remove('od-fp--instant'); }
  }
  function fpApply(fp) {
    var form = $('[data-filter-form]', fp);
    if (!form) return;
    var action = form.getAttribute('action') || window.location.pathname;
    if (!sameListing(action)) { form.submit(); return; }
    var params = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox' && !el.checked) return;
      if (el.value === '') return;
      params.append(el.name, el.value);
    });
    var url = action + (params.toString() ? (action.indexOf('?') > -1 ? '&' : '?') + params.toString() : '');
    var pane = fp.getAttribute('data-fp-current') || 'root';
    var paneEl = $('[data-fp-pane="' + pane + '"]', fp);
    var tree = $('[data-ft]', fp);
    var ftNow = null;
    if (tree) $$('[data-ft-panel]', tree).forEach(function (p) { if (!p.hidden) ftNow = p.getAttribute('data-ft-panel'); });
    fpKeep = { pane: pane, ft: pane === 'cat' ? ftNow : null, scroll: paneEl ? paneEl.scrollTop : 0 };
    fpLoading(true);
    load(url, true);
  }
  function fpRestore(fm) {
    var fp = fm.hasAttribute('data-fp') ? fm : $('[data-fp]', fm);
    if (!fp) return;
    fp.classList.remove('is-loading');
    fp.classList.add('is-done');
    setTimeout(function () { fp.classList.remove('is-done'); }, 600);
    if (!fpKeep) { fpShow(fp, 'root', true); return; }
    var keep = fpKeep; fpKeep = null;
    var tree = $('[data-ft]', fp);
    if (tree && keep.pane === 'cat') {
      var want = keep.ft && $('[data-ft-panel="' + keep.ft + '"]', tree) ? keep.ft : (tree.getAttribute('data-ft-start') || 'root');
      showPanel(tree, want);
    }
    fpShow(fp, keep.pane, true);
    var paneEl = $('[data-fp-pane="' + keep.pane + '"]', fp);
    if (paneEl) paneEl.scrollTop = keep.scroll || 0;
  }
  document.addEventListener('click', function (e) {
    var fp = e.target.closest('[data-fp]');
    if (!fp) return;
    var go = e.target.closest('[data-fp-go]');
    if (go) { e.preventDefault(); fpShow(fp, go.getAttribute('data-fp-go')); return; }
    var left = e.target.closest('[data-fp-left]');
    if (left) {
      e.preventDefault();
      if ((fp.getAttribute('data-fp-current') || 'root') !== 'root') { fpShow(fp, 'root'); return; }
      var clear = fp.getAttribute('data-fp-clear');
      // Clear all = filters AND the active category (26 Oct): the URL already points to all products when a category is active
      if (clear && (fp.hasAttribute('data-fp-cat') || $('[data-fp-reset]:not([hidden])', fp))) { fpKeep = { pane: 'root', ft: null, scroll: 0 }; fpLoading(true); load(clear, true); }
      return;
    }
    var reset = e.target.closest('[data-fp-reset]');
    if (reset) {
      e.preventDefault();
      var pane = fp.getAttribute('data-fp-current') || 'root';
      fpKeep = { pane: pane, ft: null, scroll: 0 };
      fpLoading(true);
      load(reset.getAttribute('href'), true);
    }
  });
  document.addEventListener('change', function (e) {
    var fp = e.target.closest('[data-fp]');
    if (!fp || e.target.type !== 'checkbox') return;
    fpBusyRow(e.target);
    if (e.target.hasAttribute('data-fp-all-types')) {
      // "All <category>": clear every type box and reload
      var panel = e.target.closest('[data-ft-panel]');
      if (panel) $$('input[type="checkbox"][name]', panel).forEach(function (i) { i.checked = false; });
      e.target.checked = true;
    }
    fpApply(fp);
  });
  document.addEventListener('input', function (e) {
    var fp = e.target.closest('[data-fp]');
    if (!fp || !e.target.hasAttribute('data-fp-price')) return;
    clearTimeout(fpPriceTimer);
    fpPriceTimer = setTimeout(function () { fpApply(fp); }, 650);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var fp = e.target.closest && e.target.closest('[data-fp]');
    if (fp && e.target.hasAttribute('data-fp-price')) { e.preventDefault(); clearTimeout(fpPriceTimer); fpApply(fp); }
  });
  document.addEventListener('od:modal:open', function (e) {
    if (!e.detail || e.detail.name !== 'filter') return;
    var fp = fpEl();
    if (!fp) return;
    fpShow(fp, 'root', true);
    var tree = $('[data-ft]', fp);
    if (tree) showPanel(tree, tree.getAttribute('data-ft-start') || 'root');
  });

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
  initCats();
  window.addEventListener('resize', (OD.debounce ? OD.debounce(initCats, 120) : initCats));
  fitTitle();
  window.addEventListener('resize', (OD.debounce ? OD.debounce(fitTitle, 120) : fitTitle));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initCats);
  if (mq.addEventListener) mq.addEventListener('change', refreshSticky); else if (mq.addListener) mq.addListener(refreshSticky);
  window.addEventListener('load', refreshSticky);
  document.addEventListener('keydown', function (e) {
    var sort = e.target.closest && e.target.closest('[data-sort-select]');
    if (sort && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sort.click(); }
  });
})();
