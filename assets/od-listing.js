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
    // 16 Nov 2026: only while the Category pane is the one on screen, otherwise the root title "Filter" was replaced by "Category" on open
    if (fpT && fpT.getAttribute('data-fp-current') === 'cat') {
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
  /* stay inside a collection (19 Nov 2026, snippets/stay-nav): on a category page the boxes / popup rows are the SIBLINGS of that category,
     which Liquid cannot check one by one (it only sees the current category's products). The level above is exact, so what was shown
     there is remembered for the visit (sessionStorage) and used here: siblings that were not there are removed, counts are added. */
  var STAY_KEY = 'od_stay_rows';
  function stayMem() { try { return JSON.parse(sessionStorage.getItem(STAY_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function staySync() {
    var scopes = $$('[data-stay]');
    if (!scopes.length) return;
    var mem = stayMem(), changed = false;
    var filtered = /[?&]filter\./.test(window.location.search);
    scopes.forEach(function (sc) {
      var all = sc.getAttribute('data-stay-all') || '';
      var rows = $$('[data-stay-row]', sc);
      var inPopup = sc.hasAttribute('data-ft-panel');
      if (sc.getAttribute('data-stay-exact') === '1') {
        if (filtered) return;
        var m = {};
        rows.forEach(function (r) { var c = $('.od-cat__n, .od-ft__count', r); m[r.getAttribute('data-stay-row')] = c ? c.textContent.trim() : ''; });
        mem[all] = m; changed = true;
        return;
      }
      var known = mem[all];
      if (!known) return;
      rows.forEach(function (r) {
        var href = r.getAttribute('data-stay-row');
        var cur = r.classList.contains('is-active') || r.classList.contains('is-current');
        if (!Object.prototype.hasOwnProperty.call(known, href)) { if (!cur) r.remove(); return; }
        if (filtered || cur || !known[href] || $('.od-cat__n, .od-ft__count', r)) return;
        var el = document.createElement(inPopup ? 'small' : 'span');
        el.className = inPopup ? 'od-ft__count' : 'od-cat__n';
        el.textContent = known[href];
        var first = inPopup ? $('span', r) : null;
        if (first && first.nextSibling) r.insertBefore(el, first.nextSibling); else r.appendChild(el);
      });
    });
    if (changed) { try { sessionStorage.setItem(STAY_KEY, JSON.stringify(mem)); } catch (e) {} }
  }
  function reinit(root) {
    staySync();
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
      fpSaleSync(url);
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
    var a = e.target.closest('[data-listing-cats] a, [data-filter-form] a.od-ft__row, [data-filter-form] a.od-ft__back, [data-filter-form] a._resetBtn_rmug7_149, [data-listing-ajax] a');
    if (!a || !sameListing(a.href)) return;
    e.preventDefault();
    if (a.closest('[data-fp]')) {
      // popup: category links reload the listing behind and reopen the tree on the new category (types level when it has one)
      var fpA = a.closest('[data-fp]');
      fpKeep = { pane: 'cat', ft: a.hasAttribute('data-fp-cat') ? 'types' : null, scroll: 0 };
      fpBusyRow(a);
      // 19 Nov 2026: rows that open another level of the same collection (stay inside, data-fp-drill) get the loading panel too
      if (a.hasAttribute('data-fp-cat') || a.hasAttribute('data-fp-drill')) fpSkeletonLevel(fpA, ((a.querySelector('span') || a).textContent || '').trim());
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
    // list search: opening a list by hand starts with an empty box and the ticked rows first
    if (!instant && !isRoot) $$('[data-fp-search]', target).forEach(function (b) { var qi = $('[data-fp-q]', b); if (qi) qi.value = ''; fqRun(b, true); });
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
    fpKeep = { pane: pane, ft: pane === 'cat' ? ftNow : null, scroll: paneEl ? paneEl.scrollTop : 0, qs: fqSnapshot(fp) };
    fpLoading(true);
    load(url, true);
  }
  function fpRestore(fm) {
    var fp = fm.hasAttribute('data-fp') ? fm : $('[data-fp]', fm);
    if (!fp) return;
    fp.classList.remove('is-loading');
    fp.classList.add('is-done');
    setTimeout(function () { fp.classList.remove('is-done'); }, 600);
    var tree = $('[data-ft]', fp);
    // 19 Nov 2026: the Category tree is always put on a panel after a re-render (it used to stay empty when the change came from another pane, e.g. a Sale or Brand tick)
    if (!fpKeep) { if (tree) showPanel(tree, tree.getAttribute('data-ft-start') || 'root'); fpShow(fp, 'root', true); fqRestore(fp, null); return; }
    var keep = fpKeep; fpKeep = null;
    if (tree) {
      var want = keep.pane === 'cat' && keep.ft && $('[data-ft-panel="' + keep.ft + '"]', tree) ? keep.ft : (tree.getAttribute('data-ft-start') || 'root');
      showPanel(tree, want);
    }
    fpShow(fp, keep.pane, true);
    fqRestore(fp, keep.qs || null);
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
  /* Sale group, manual mode (19 Nov 2026). Shopify does not return the tag filter on translated languages (Arabic),
     so the popup prints plain sale:NN boxes there; ticks, summary, Reset and chips are painted here from the URL. */
  function fpSaleSync(url) {
    var fp = fpEl();
    if (!fp) return;
    var pane = $('[data-fp-sale-manual]', fp);
    if (!pane) return;
    var u;
    try { u = new URL(url || window.location.href, window.location.href); } catch (e) { return; }
    var act = u.searchParams.getAll('filter.p.tag');
    var picked = [];
    $$('input[name="filter.p.tag"]', pane).forEach(function (i) {
      i.checked = act.indexOf(i.value) > -1;
      if (i.checked) picked.push({ value: i.value, label: i.getAttribute('data-sale-label') || i.value });
    });
    var sum = $('[data-fp-sale-sum]', fp);
    if (sum) {
      sum.textContent = picked.length ? picked.map(function (p) { return p.label; }).join(', ') : (sum.getAttribute('data-t-all') || '');
      sum.classList.toggle('is-set', !!picked.length);
    }
    if (!picked.length) return;
    var rs = $('[data-fp-reset]', fp); if (rs) rs.hidden = false;
    var left = $('[data-fp-left]', fp); if (left) left.classList.add('is-act');
    var box = $('[data-listing-active]', listing);
    if (!box) return;
    $$('[data-sale-chip]', box).forEach(function (c) { c.remove(); });
    picked.forEach(function (p) {
      var nu = new URL(u.toString());
      nu.searchParams.delete('filter.p.tag');
      act.forEach(function (v) { if (v !== p.value) nu.searchParams.append('filter.p.tag', v); });
      var a = document.createElement('a');
      a.className = 'od-chipx';
      a.setAttribute('data-sale-chip', '');
      a.href = nu.pathname + nu.search;
      var t = document.createElement('span'); t.className = 'od-chipx__t'; t.textContent = p.label;
      var x = document.createElement('span'); x.className = 'od-chipx__x'; x.setAttribute('aria-hidden', 'true'); x.textContent = '×';
      a.appendChild(t); a.appendChild(x);
      box.insertBefore(a, $('.od-listing__clear', box));
    });
    box.hidden = false;
  }
  fpSaleSync();
  document.addEventListener('DOMContentLoaded', function () { fpSaleSync(); staySync(); initCats(); });
  staySync();
  document.addEventListener('od:modal:open', function (e) {
    if (!e.detail || e.detail.name !== 'filter') return;
    var fp = fpEl();
    if (!fp) return;
    fpShow(fp, 'root', true);
    var tree = $('[data-ft]', fp);
    if (tree) showPanel(tree, tree.getAttribute('data-ft-start') || 'root');
    fpPins = {};
    $$('[data-fp-q]', fp).forEach(function (qi) { qi.value = ''; });
    fqAll(fp, true);
  });

  /* ===================== list search inside the filter popup (16 Nov 2026) =====================
     Markup: snippets/filter-list-search.liquid, printed above any value list longer than 12 (Brand, Colour, Type ...).
     Live on every key. Order: starts with > a word starts with > contains > close match (typos); ties go to the bigger product count.
     Spaces, dots, apostrophes, "&", "+" and accents are ignored ("saulee" = SAU LEE, "pe nation" = P.E Nation, "alemais" = ALEMAIS with accent).
     Typos allowed: none up to 2 letters, 1 up to 5, 2 up to 9, then 25% of the length.
     Empty box: the rows that were ticked when the list was opened come first (fpPins), the rest keep Shopify's order.
     The typed text survives the re-render that follows a tick (fpKeep.qs). The input has no name, so fpApply never sends it. */
  var fpPins = {};
  function fqEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fqFlat(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function fqFold(s) { return fqFlat(s).replace(/[\u064b-\u0655\u0670\u0640]/g, '').replace(/[\u0623\u0625\u0622]/g, '\u0627').replace(/\u0629/g, '\u0647'); }
  function fqNorm(s) { return fqFold(s).replace(/[^a-z0-9\u0600-\u06ff]+/g, ''); }
  function fqLev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j, t;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  function fqAllow(len) { return len <= 2 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : Math.floor(len * 0.25); }
  /* 0 starts with, 1 a word starts with, 2 contains, 3 + typos = close match, null = no match */
  function fqScore(name, q) {
    var nb = fqNorm(name);
    if (!nb) return null;
    var ws = fqFold(name).split(/[^a-z0-9\u0600-\u06ff]+/).filter(Boolean), i, L;
    if (nb.indexOf(q) === 0) return 0;
    for (i = 0; i < ws.length; i++) if (ws[i].indexOf(q) === 0) return 1;
    if (nb.indexOf(q) > -1) return 2;
    var a = fqAllow(q.length);
    if (!a) return null;
    var d = 99;
    for (L = Math.max(1, q.length - 1); L <= q.length + 1; L++) {
      d = Math.min(d, fqLev(q, nb.slice(0, L)));
      for (i = 0; i < ws.length; i++) d = Math.min(d, fqLev(q, ws[i].slice(0, L)));
    }
    return d <= a ? 3 + d : null;
  }
  function fqScope(bar) { return bar.closest('[data-ft-panel]') || bar.closest('[data-fp-pane]'); }
  function fqKey(scope) { return scope.hasAttribute('data-ft-panel') ? 'ft:' + scope.getAttribute('data-ft-panel') : 'p:' + scope.getAttribute('data-fp-pane'); }
  function fqRows(scope) { return $$('.od-fp__row', scope).filter(function (r) { return !r.classList.contains('od-fp__row--all'); }); }
  function fqBox(r) { return $('input[type="checkbox"]', r); }
  function fqVal(r) { var i = fqBox(r); return i ? i.name + '=' + i.value : ''; }
  function fqRun(bar, repin) {
    var scope = fqScope(bar);
    if (!scope) return;
    var rows = fqRows(scope);
    if (!rows.length) return;
    rows.forEach(function (r, i) {
      if (r.hasAttribute('data-fq-i')) return;
      var vl = $('.od-fp__vl', r), vc = $('.od-fp__vc', r);
      r.setAttribute('data-fq-i', i);
      r.setAttribute('data-fq-l', vl ? vl.textContent.replace(/\s+/g, ' ').trim() : '');
      r.setAttribute('data-fq-c', vc ? (parseInt(vc.textContent, 10) || 0) : 0);
    });
    var key = fqKey(scope);
    if (repin || !fpPins[key]) fpPins[key] = rows.filter(function (r) { var b = fqBox(r); return b && b.checked; }).map(fqVal);
    var pins = fpPins[key];
    var input = $('[data-fp-q]', bar);
    var raw = input ? input.value.replace(/\s+/g, ' ').trim() : '';
    var q = fqNorm(raw);
    var list = rows.map(function (r) {
      var l = r.getAttribute('data-fq-l');
      return { r: r, l: l, i: +r.getAttribute('data-fq-i'), c: +r.getAttribute('data-fq-c'), s: q ? fqScore(l, q) : 0, pin: pins.indexOf(fqVal(r)) > -1 };
    });
    // close matches (typos) only show when nothing matches properly, otherwise "the" would also list CHE
    if (q && list.some(function (x) { return x.s !== null && x.s < 3; })) list.forEach(function (x) { if (x.s !== null && x.s >= 3) x.s = null; });
    var shown = list.filter(function (x) { return x.s !== null; });
    if (q) shown.sort(function (a, b) { return a.s - b.s || b.c - a.c || a.i - b.i; });
    else shown.sort(function (a, b) { return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || a.i - b.i; });
    var parent = rows[0].parentNode, exact = 0, tClose = bar.getAttribute('data-t-close') || '', fr = fqFlat(raw);
    list.forEach(function (x) { x.r.hidden = x.s === null; });
    shown.forEach(function (x) {
      parent.appendChild(x.r);
      var vl = $('.od-fp__vl', x.r);
      if (!vl) return;
      var html = fqEsc(x.l);
      if (q && x.s < 3) {
        exact++;
        var f = fqFlat(x.l), at = (fr && f.length === x.l.length) ? f.indexOf(fr) : -1;
        if (at > -1) html = fqEsc(x.l.slice(0, at)) + '<mark>' + fqEsc(x.l.slice(at, at + fr.length)) + '</mark>' + fqEsc(x.l.slice(at + fr.length));
      } else if (q) {
        html += '<span class="od-fp__close">' + fqEsc(tClose) + '</span>';
      }
      if (vl.getAttribute('data-fq-h') !== html) { vl.innerHTML = html; vl.setAttribute('data-fq-h', html); }
    });
    var all = $('.od-fp__row--all', scope);
    if (all) all.hidden = !!q;
    var hint = $('[data-fp-q-hint]', bar), none = bar.nextElementSibling && bar.nextElementSibling.hasAttribute('data-fp-q-none') ? bar.nextElementSibling : null;
    var msg = '';
    if (!q) msg = (bar.getAttribute('data-t-all') || '').replace('__n__', rows.length);
    else if (exact === 1) msg = bar.getAttribute('data-t-one') || '';
    else if (exact > 1) msg = (bar.getAttribute('data-t-many') || '').replace('__n__', exact);
    else if (shown.length) msg = bar.getAttribute('data-t-closest') || '';
    if (hint) hint.textContent = msg;
    if (none) {
      none.hidden = !(q && !shown.length);
      if (!none.hidden) none.textContent = (bar.getAttribute('data-t-none') || '').replace('__q__', raw);
    }
    var x = $('[data-fp-q-clear]', bar);
    if (x) x.hidden = !(input && input.value);
  }
  function fqAll(fp, repin) { $$('[data-fp-search]', fp).forEach(function (b) { fqRun(b, repin); }); }
  function fqSnapshot(fp) {
    // typed text per list + which one has the cursor, kept across the re-render after a tick
    var out = { v: {}, focus: null };
    $$('[data-fp-search]', fp).forEach(function (b) {
      var scope = fqScope(b), i = $('[data-fp-q]', b);
      if (!scope || !i) return;
      if (i.value) out.v[fqKey(scope)] = i.value;
      if (document.activeElement === i) out.focus = fqKey(scope);
    });
    return out;
  }
  function fqRestore(fp, snap) {
    $$('[data-fp-search]', fp).forEach(function (b) {
      var scope = fqScope(b), i = $('[data-fp-q]', b);
      if (!scope || !i) return;
      var k = fqKey(scope);
      if (snap && snap.v[k]) i.value = snap.v[k];
      fqRun(b, false);
      if (snap && snap.focus === k) { try { i.focus({ preventScroll: true }); var n = i.value.length; i.setSelectionRange(n, n); } catch (err) {} }
    });
  }
  document.addEventListener('input', function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute('data-fp-q')) return;
    var bar = e.target.closest('[data-fp-search]');
    if (!bar) return;
    fqRun(bar, false);
    var pane = bar.closest('[data-fp-pane]');
    if (pane) pane.scrollTop = 0;
  });
  document.addEventListener('click', function (e) {
    var x = e.target.closest && e.target.closest('[data-fp-q-clear]');
    if (!x) return;
    e.preventDefault();
    var bar = x.closest('[data-fp-search]'), i = bar && $('[data-fp-q]', bar);
    if (!i) return;
    i.value = '';
    fqRun(bar, false);
    i.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.hasAttribute || !e.target.hasAttribute('data-fp-q')) return;
    // Enter must not submit the form (submit = close the popup): it ticks the first result
    e.preventDefault();
    var bar = e.target.closest('[data-fp-search]'), scope = bar && fqScope(bar);
    if (!scope || !e.target.value.trim()) return;
    var first = fqRows(scope).filter(function (r) { var b = fqBox(r); return !r.hidden && b && !b.disabled; })[0];
    if (first) fqBox(first).click();
  });

  /* ===================== infinite scroll with skeleton cards ===================== */
  var lmIo = null;
  var lmLoading = false;
  /* sold-out colours at the end (22 Nov 2026): a sold-out colour card of a product that still has another colour in
     stock is printed with the class od-card--late and hidden in its place (od-listing.css). Once the last page of the
     listing is in the grid, every such card is moved to the very end and shown. A filter / sort / category reload
     replaces the grid, so it starts again by itself. */
  function lateFlush() {
    var g = grid();
    if (!g) return;
    var late = $$('.od-card--late:not(.is-late-shown)', g);
    if (!late.length) return;
    var frag = document.createDocumentFragment();
    late.forEach(function (c) { c.classList.add('is-late-shown'); c.classList.add('od-fade-in'); frag.appendChild(c); });
    g.appendChild(frag);
  }
  function observeLoadMore() {
    if (lmIo) { lmIo.disconnect(); lmIo = null; }
    var s = $('[data-load-more]', listing);
    if (!s || !s.getAttribute('data-next-url') || !('IntersectionObserver' in window)) { lateFlush(); return; }
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
          if (!s.getAttribute('data-next-url')) { lmIo.disconnect(); lateFlush(); }
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
