/* od-account.js - My Account page (sections/main-account.liquid)
   Tabs: [data-acct-tab="orders|wishlists|profile|address"] (desktop column + mobile bar) show the matching
   [data-acct-panel], update the title and the URL hash (pushState, back/forward + hashchange handled).
   Order drawers open through theme.js (data-open-modal="order-<id>"), nothing to do here.
   Load More: fetches the paginate next page, appends its order cards + drawers, moves the link on. */
(function () {
  'use strict';
  var root = document.querySelector('[data-account]');
  if (!root) return;

  var TABS = ['orders', 'wishlists', 'profile', 'address'];
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-acct-tab]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-acct-panel]'));
  var title = root.querySelector('[data-acct-title]');
  var current = '';

  function fromHash() {
    var h = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    return TABS.indexOf(h) > -1 ? h : 'orders';
  }

  function show(name, push) {
    if (TABS.indexOf(name) === -1) name = 'orders';
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-acct-panel') !== name; });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-acct-tab') === name;
      var desktop = t.classList.contains('_tab__link_dllx9_30');
      t.classList.toggle('_active_dllx9_71', on && desktop);
      t.classList.toggle('_active_16lzy_77', on && !desktop);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
      if (on && title) title.textContent = t.getAttribute('data-acct-label') || t.textContent.trim();
    });
    root.setAttribute('data-acct-current', name);
    if (push && name !== current) {
      try { window.history.pushState({ acct: name }, '', '#' + name); } catch (e) { window.location.hash = name; }
    }
    current = name;
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-acct-tab]');
    if (!t || !root.contains(t)) return;
    e.preventDefault();
    show(t.getAttribute('data-acct-tab'), true);
    // mobile: bring the panel title into view when switching from the bottom bar
    if (window.innerWidth <= 768 && title && !t.classList.contains('_tab__link_dllx9_30')) {
      var top = title.getBoundingClientRect().top + window.pageYOffset - 140;
      if (window.pageYOffset > top) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  });

  window.addEventListener('popstate', function () { show(fromHash(), false); });
  window.addEventListener('hashchange', function () { var h = fromHash(); if (h !== current) show(h, false); });
  show(fromHash(), false);

  /* ---------- Load More (paginate next page) ---------- */
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-acct-more]');
    if (!a || !root.contains(a)) return;
    e.preventDefault();
    if (a.classList.contains('is-loading')) return;
    var href = a.getAttribute('href') || '';
    var url = href.split('#')[0];
    if (!url) return;
    a.classList.add('is-loading');
    a.setAttribute('aria-busy', 'true');
    fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var list = root.querySelector('[data-acct-orders]');
        var drawers = root.querySelector('[data-acct-drawers]');
        var cards = doc.querySelectorAll('[data-acct-orders] > [data-acct-order]');
        var newDrawers = doc.querySelectorAll('[data-acct-drawers] > *');
        Array.prototype.forEach.call(cards, function (c) {
          if (root.querySelector('[data-acct-order="' + c.getAttribute('data-acct-order') + '"]')) return;
          list.insertBefore(document.adoptNode(c), a);
        });
        Array.prototype.forEach.call(newDrawers, function (d) {
          var name = d.getAttribute('data-modal') || d.getAttribute('data-modal-backdrop');
          if (name && root.querySelector('[data-modal="' + name + '"]') && d.hasAttribute('data-modal')) return;
          if (name && root.querySelector('[data-modal-backdrop="' + name + '"]') && d.hasAttribute('data-modal-backdrop')) return;
          drawers.appendChild(document.adoptNode(d));
        });
        var next = doc.querySelector('[data-acct-more]');
        if (next && next.getAttribute('href') && next.getAttribute('href').split('#')[0] !== url) {
          a.setAttribute('href', next.getAttribute('href'));
        } else {
          a.remove();
        }
      })
      .catch(function () { window.location.href = href; })
      .then(function () { a.classList.remove('is-loading'); a.removeAttribute('aria-busy'); });
  });
})();
