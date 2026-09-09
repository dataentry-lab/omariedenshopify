/* od-reels: Omarieden Reels player + Stories viewer (round 8). Loaded after theme.js / od-card.js (window.OD available).
   Reels: sections/od-reels.liquid renders 9:16 tiles + a JSON blob + hidden product cards (snippets/reel-product-card).
   Stories: sections/od-stories.liquid renders the ring row + a JSON blob + hidden product cards.
   Both players are built once, appended to <body>, and reuse the shared quick-add drawer through data-quick-add-open. */
(function () {
  'use strict';
  if (window.__odReelsLoaded) return;
  window.__odReelsLoaded = true;
  const OD = window.OD || (window.OD = {});
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
  const T = Object.assign({ items: '{{ count }} items', look: 'Shop the look', collection: 'Shop the collection', shop: 'Shop now', copied: 'Link copied', close: 'Close', mute: 'Mute', unmute: 'Unmute', share: 'Share', bag: 'Bag', wishlist: 'Wishlist', products: 'Shop this reel', next: 'Next', prev: 'Previous' }, OD.reelsT || {});
  const ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
  };
  const pickSource = (list) => {
    if (!list || !list.length) return null;
    const max = isDesktop() ? 1080 : 720;
    const ok = list.filter((s) => !s.h || s.h <= max).sort((a, b) => (b.h || 0) - (a.h || 0));
    return (ok[0] || list.slice().sort((a, b) => (a.h || 0) - (b.h || 0))[0]).url;
  };
  let muted = true;
  const lock = (yes) => { document.body.classList.toggle('od-rl-lock', yes); document.body.style.overflow = yes ? 'hidden' : ''; };
  const share = async (title, url) => {
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(url); OD.toast && OD.toast(T.copied); } catch (e) { window.prompt(T.share, url); }
  };
  const heartHTML = (p) => p ? '<button type="button" class="od-rl__btn" data-wishlist-toggle data-wishlist-id="' + esc(p.getAttribute('data-product-id')) + '" data-wishlist-handle="' + esc(p.getAttribute('data-handle')) + '" aria-label="' + esc(T.wishlist) + '"><img src="' + esc((OD.assets && OD.assets.wishlist) || '') + '" alt=""></button>' : '';
  const paintHearts = (root) => { OD.wlPaint && OD.wlPaint(root); };

  /* =====================================================================
     Reels player
     ===================================================================== */
  let rl = null;
  function buildPlayer() {
    if (rl) return rl;
    rl = document.createElement('div');
    rl.className = 'od-rl';
    rl.setAttribute('role', 'dialog'); rl.setAttribute('aria-modal', 'true'); rl.setAttribute('aria-label', 'Reels');
    rl.innerHTML =
      '<div class="od-rl__top"><button type="button" class="od-rl__btn" data-rl-mute aria-label="' + esc(T.unmute) + '">' + ICON.muted + '</button><button type="button" class="od-rl__btn" data-rl-close aria-label="' + esc(T.close) + '">' + ICON.close + '</button></div>' +
      '<div class="od-rl__stage">' +
        '<div class="od-rl__arrows"><button type="button" class="od-rl__btn" data-rl-prev aria-label="' + esc(T.prev) + '">' + ICON.up + '</button><button type="button" class="od-rl__btn" data-rl-next aria-label="' + esc(T.next) + '">' + ICON.down + '</button></div>' +
        '<div class="od-rl__frame"><div class="od-rl__scroll" data-rl-scroll></div></div>' +
        '<div class="od-rl__panel" data-rl-panel></div>' +
      '</div>';
    document.body.appendChild(rl);
    on($('[data-rl-close]', rl), 'click', closeReels);
    on($('[data-rl-mute]', rl), 'click', () => setMuted(!muted));
    on($('[data-rl-prev]', rl), 'click', () => goTo(R.index - 1));
    on($('[data-rl-next]', rl), 'click', () => goTo(R.index + 1));
    on(rl, 'click', (e) => {
      const t = e.target;
      if (t.closest('[data-rl-share]')) { const d = R.reels[R.index]; share(d.caption || document.title, d.shareUrl); return; }
      if (t.closest('[data-rl-bag]')) { OD.openModal && OD.openModal('cart'); return; }
      if (t.closest('[data-rl-tap]')) { toggleVideo(); return; }
    });
    on(document, 'keydown', (e) => {
      if (!rl.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeReels();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goTo(R.index + 1);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goTo(R.index - 1);
      if (e.key === 'm' || e.key === 'M') setMuted(!muted);
    });
    const scroll = $('[data-rl-scroll]', rl);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting && en.intersectionRatio >= .6) activate(parseInt(en.target.getAttribute('data-rl-index'), 10)); });
    }, { root: scroll, threshold: [.6] });
    R.io = io;
    window.addEventListener('popstate', () => { if (rl.classList.contains('is-open') && !(history.state && history.state.odReels)) closeReels(true); });
    return rl;
  }
  const R = { reels: [], index: 0, section: null, io: null };

  function itemHTML(d, i, products) {
    const src = pickSource(d.video);
    const media = src
      ? '<video playsinline loop preload="metadata"' + (d.poster ? ' poster="' + esc(d.poster) + '"' : '') + ' data-src="' + esc(src) + '" muted></video>'
      : '<img src="' + esc(d.image || d.poster || '') + '" alt="">';
    const meta = (d.caption ? esc(d.caption) : '') + (products.length > 1 ? (d.caption ? ' <small>· ' : '<small>') + esc(T.items.replace('{{ count }}', products.length).replace('__N__', products.length)) + '</small>' : '');
    let shop = '';
    if (products.length) shop = '<div class="od-rl__cards" data-rl-cards></div>';
    else if (d.shop === 'collection' && d.collection) shop = '<a class="od-rl__cta" href="' + esc(d.collection.url) + '">' + esc(T.collection) + '<small>' + esc(d.collection.title) + '</small></a>';
    else if (d.shop === 'link' && d.link) shop = '<a class="od-rl__cta" href="' + esc(d.link.url) + '">' + esc(d.link.label || T.shop) + '</a>';
    return '<div class="od-rl__item" data-rl-index="' + i + '" data-rl-id="' + esc(d.id) + '">' + media +
      '<div class="od-rl__shade"></div><div class="od-rl__tap" data-rl-tap></div>' +
      '<div class="od-rl__soundhint">' + ICON.pause + '</div>' +
      '<div class="od-rl__side">' + heartHTML(products[0]) + '<button type="button" class="od-rl__btn" data-rl-share aria-label="' + esc(T.share) + '">' + ICON.share + '</button><button type="button" class="od-rl__btn" data-rl-bag aria-label="' + esc(T.bag) + '">' + ICON.bag + '</button></div>' +
      (meta ? '<div class="od-rl__meta">' + meta + '</div>' : '') +
      '<div class="od-rl__dots">' + R.reels.map((_, k) => '<span' + (k === i ? ' class="is-active"' : '') + '></span>').join('') + '</div>' +
      shop + '</div>';
  }
  function productsFor(section, id) {
    const box = $('[data-reel-products="' + id + '"], [data-slide-products="' + id + '"]', section);
    return box ? $$('[data-rl-card]', box) : [];
  }
  function openReels(section, index) {
    buildPlayer();
    let data = [];
    try { data = JSON.parse($('[data-reels-data]', section).textContent); } catch (e) { return; }
    if (!data.length) return;
    R.reels = data; R.section = section; R.index = -1;
    const scroll = $('[data-rl-scroll]', rl);
    scroll.innerHTML = data.map((d, i) => itemHTML(d, i, productsFor(section, d.id))).join('');
    $$('.od-rl__item', scroll).forEach((item, i) => {
      const cards = $('[data-rl-cards]', item);
      if (cards) productsFor(section, data[i].id).forEach((c) => cards.appendChild(c.cloneNode(true)));
      R.io.observe(item);
    });
    paintHearts(scroll);
    rl.classList.add('is-open');
    lock(true);
    setMuted(muted, true);
    try { history.pushState({ odReels: 1 }, '', location.pathname + location.search + '#reel-' + data[Math.max(0, index)].id); } catch (e) { /* noop */ }
    goTo(Math.max(0, Math.min(index || 0, data.length - 1)), true);
  }
  function closeReels(fromHistory) {
    if (!rl || !rl.classList.contains('is-open')) return;
    $$('video', rl).forEach((v) => { try { v.pause(); } catch (e) { /* noop */ } });
    rl.classList.remove('is-open');
    lock(false);
    $('[data-rl-scroll]', rl).innerHTML = '';
    $('[data-rl-panel]', rl).innerHTML = '';
    if (!fromHistory && history.state && history.state.odReels) { try { history.back(); } catch (e) { /* noop */ } }
  }
  function goTo(i, instant) {
    const items = $$('.od-rl__item', rl);
    if (!items.length) return;
    i = Math.max(0, Math.min(i, items.length - 1));
    items[i].scrollIntoView({ block: 'start', behavior: instant ? 'auto' : 'smooth' });
    if (instant) activate(i);
  }
  function activate(i) {
    if (i === R.index) return;
    R.index = i;
    const items = $$('.od-rl__item', rl);
    items.forEach((item, k) => {
      const v = $('video', item);
      if (!v) return;
      if (k === i) {
        if (!v.getAttribute('src')) v.src = v.getAttribute('data-src');
        v.muted = muted;
        v.play().catch(() => { v.muted = true; muted = true; setMuted(true, true); v.play().catch(() => {}); });
        item.classList.remove('is-paused');
      } else { v.pause(); if (Math.abs(k - i) > 1 && v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } }
    });
    // preload the next one
    const nv = items[i + 1] && $('video', items[i + 1]);
    if (nv && !nv.getAttribute('src')) { nv.src = nv.getAttribute('data-src'); nv.load(); }
    $$('.od-rl__item .od-rl__dots', rl).forEach((dots) => $$('span', dots).forEach((s, k) => s.classList.toggle('is-active', k === i)));
    const prev = $('[data-rl-prev]', rl), next = $('[data-rl-next]', rl);
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === items.length - 1;
    // desktop panel
    const panel = $('[data-rl-panel]', rl);
    const d = R.reels[i];
    const products = productsFor(R.section, d.id);
    let html = '';
    if (products.length) html = '<p class="od-rl__panel-title">' + esc(T.products) + '</p>' + products.map((p) => p.outerHTML).join('');
    else if (d.shop === 'collection' && d.collection) html = '<a class="od-rl__cta" href="' + esc(d.collection.url) + '">' + esc(T.collection) + '</a>';
    else if (d.shop === 'link' && d.link) html = '<a class="od-rl__cta" href="' + esc(d.link.url) + '">' + esc(d.link.label || T.shop) + '</a>';
    panel.innerHTML = html;
    try { history.replaceState({ odReels: 1 }, '', location.pathname + location.search + '#reel-' + d.id); } catch (e) { /* noop */ }
  }
  function setMuted(m, silent) {
    muted = m;
    const b = $('[data-rl-mute]', rl);
    if (b) { b.innerHTML = m ? ICON.muted : ICON.sound; b.setAttribute('aria-label', m ? T.unmute : T.mute); }
    $$('video', rl).forEach((v) => { v.muted = m; });
    if (!silent && !m) { const v = $$('.od-rl__item', rl)[R.index] && $('video', $$('.od-rl__item', rl)[R.index]); v && v.play().catch(() => {}); }
  }
  function toggleVideo() {
    const item = $$('.od-rl__item', rl)[R.index];
    const v = item && $('video', item);
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); item.classList.remove('is-paused'); } else { v.pause(); item.classList.add('is-paused'); }
  }

  /* section: tiles, hover preview, mobile dots, deep link */
  function initReelsSection(section) {
    if (section._odReels) return;
    section._odReels = true;
    on(section, 'click', (e) => {
      const t = e.target.closest('[data-reel-open]');
      if (t) { e.preventDefault(); openReels(section, parseInt(t.getAttribute('data-reel-open'), 10)); }
    });
    if (section.getAttribute('data-hover-play') === 'true' && window.matchMedia('(hover: hover)').matches) {
      $$('.od-reels__tile', section).forEach((tile) => {
        const v = $('[data-reel-preview]', tile);
        if (!v) return;
        on(tile, 'mouseenter', () => { tile.classList.add('is-previewing'); v.play().catch(() => {}); });
        on(tile, 'mouseleave', () => { tile.classList.remove('is-previewing'); v.pause(); });
      });
    }
    const row = $('[data-reels-row]', section), dots = $('[data-reels-dots]', section);
    if (row && dots) {
      const tiles = $$('.od-reels__tile', row);
      dots.innerHTML = tiles.map((_, i) => '<span' + (i === 0 ? ' class="is-active"' : '') + '></span>').join('');
      on(row, 'scroll', () => {
        const w = tiles[0] ? tiles[0].offsetWidth + 10 : 1;
        const i = Math.round(Math.abs(row.scrollLeft) / w);
        $$('span', dots).forEach((s, k) => s.classList.toggle('is-active', k === i));
      }, { passive: true });
    }
    const m = location.hash.match(/^#reel-([A-Za-z0-9_-]+)$/);
    if (m) { const idx = $$('[data-reel-open]', section).findIndex((t) => t.id === 'reel-' + m[1]); if (idx > -1) setTimeout(() => openReels(section, idx), 300); }
  }

  /* =====================================================================
     Stories viewer
     ===================================================================== */
  let sv = null;
  const S = { stories: [], si: 0, li: 0, section: null, timer: null, start: 0, remaining: 0, paused: false, holdT: null, held: false, touch: null };
  const SEEN_KEY = 'od_stories_seen';
  const seenGet = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } };
  const seenSet = (o) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) { /* noop */ } };
  const markSeen = (story, li) => { const o = seenGet(); o[story.id] = Math.max(o[story.id] || 0, li + 1); seenSet(o); paintSeen(S.section); };
  function paintSeen(section) {
    if (!section) return;
    const o = seenGet();
    let data = [];
    try { data = JSON.parse($('[data-stories-data]', section).textContent); } catch (e) { return; }
    $$('[data-story-open]', section).forEach((b) => {
      const st = data.find((x) => x.id === b.getAttribute('data-story-open'));
      b.classList.toggle('is-seen', !!(st && st.slides.length && (o[st.id] || 0) >= st.slides.length));
    });
  }
  function buildViewer() {
    if (sv) return sv;
    sv = document.createElement('div');
    sv.className = 'od-sv';
    sv.setAttribute('role', 'dialog'); sv.setAttribute('aria-modal', 'true'); sv.setAttribute('aria-label', 'Stories');
    sv.innerHTML =
      '<button type="button" class="od-rl__btn od-sv__arrow od-sv__arrow--prev" data-sv-prev aria-label="' + esc(T.prev) + '">' + ICON.left + '</button>' +
      '<div class="od-sv__frame" data-sv-frame>' +
        '<div class="od-sv__media" data-sv-media></div><div class="od-sv__shade od-sv__shade--top"></div><div class="od-sv__shade"></div>' +
        '<div class="od-sv__bars" data-sv-bars></div>' +
        '<div class="od-sv__head"><img data-sv-cover alt=""><span data-sv-label></span><button type="button" class="od-rl__btn" data-sv-close aria-label="' + esc(T.close) + '">' + ICON.close + '</button></div>' +
        '<div class="od-sv__tap" data-sv-tap><span data-sv-left></span><span data-sv-right></span></div>' +
        '<button type="button" class="od-rl__btn od-sv__mute" data-sv-mute hidden aria-label="' + esc(T.unmute) + '">' + ICON.muted + '</button>' +
        '<div data-sv-foot></div>' +
      '</div>' +
      '<button type="button" class="od-rl__btn od-sv__arrow od-sv__arrow--next" data-sv-next aria-label="' + esc(T.next) + '">' + ICON.right + '</button>';
    document.body.appendChild(sv);
    on($('[data-sv-close]', sv), 'click', closeStories);
    on($('[data-sv-prev]', sv), 'click', () => storyStep(-1));
    on($('[data-sv-next]', sv), 'click', () => storyStep(1));
    on($('[data-sv-mute]', sv), 'click', () => { muted = !muted; const v = $('video', $('[data-sv-media]', sv)); if (v) v.muted = muted; const b = $('[data-sv-mute]', sv); b.innerHTML = muted ? ICON.muted : ICON.sound; });
    // tap zones with hold-to-pause; touch swipes
    const tap = $('[data-sv-tap]', sv);
    on(tap, 'pointerdown', (e) => {
      S.held = false; S.touch = { x: e.clientX, y: e.clientY, t: Date.now() };
      S.holdT = setTimeout(() => { S.held = true; pauseStory(true); }, 220);
    });
    const endTouch = (e) => {
      clearTimeout(S.holdT);
      const t = S.touch; S.touch = null;
      if (S.held) { pauseStory(false); S.held = false; return; }
      if (!t) return;
      const dx = e.clientX - t.x, dy = e.clientY - t.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { storyStep(dx < 0 ? 1 : -1); return; }
      if (dy > 80 && Math.abs(dy) > Math.abs(dx)) { closeStories(); return; }
      if (e.target.closest('[data-sv-left]')) slideStep(-1); else slideStep(1);
    };
    on(tap, 'pointerup', endTouch);
    on(tap, 'pointercancel', () => { clearTimeout(S.holdT); if (S.held) { pauseStory(false); S.held = false; } S.touch = null; });
    on(document, 'keydown', (e) => {
      if (!sv.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeStories();
      if (e.key === 'ArrowRight') slideStep(1);
      if (e.key === 'ArrowLeft') slideStep(-1);
      if (e.key === ' ') { e.preventDefault(); pauseStory(!S.paused); }
    });
    on(document, 'visibilitychange', () => { if (sv.classList.contains('is-open')) pauseStory(document.hidden); });
    window.addEventListener('popstate', () => { if (sv.classList.contains('is-open') && !(history.state && history.state.odStories)) closeStories(true); });
    return sv;
  }
  function openStories(section, storyId) {
    buildViewer();
    let data = [];
    try { data = JSON.parse($('[data-stories-data]', section).textContent); } catch (e) { return; }
    const visible = $$('[data-story-open]', section).map((b) => b.getAttribute('data-story-open'));
    data = data.filter((s) => visible.includes(s.id) && s.slides && s.slides.length);
    if (!data.length) return;
    S.stories = data; S.section = section;
    S.si = Math.max(0, data.findIndex((s) => s.id === storyId));
    const seen = seenGet()[data[S.si].id] || 0;
    S.li = seen >= data[S.si].slides.length ? 0 : seen;
    sv.classList.add('is-open');
    lock(true);
    try { history.pushState({ odStories: 1 }, '', location.pathname + location.search + '#story'); } catch (e) { /* noop */ }
    showSlide();
  }
  function closeStories(fromHistory) {
    if (!sv || !sv.classList.contains('is-open')) return;
    clearTimeout(S.timer); S.timer = null;
    const v = $('video', sv); if (v) { try { v.pause(); } catch (e) { /* noop */ } }
    sv.classList.remove('is-open');
    $('[data-sv-media]', sv).innerHTML = ''; $('[data-sv-foot]', sv).innerHTML = '';
    lock(false);
    if (!fromHistory && history.state && history.state.odStories) { try { history.back(); } catch (e) { /* noop */ } }
  }
  function storyStep(dir) {
    const n = S.si + dir;
    if (n < 0) { S.li = 0; showSlide(); return; }
    if (n >= S.stories.length) { closeStories(); return; }
    S.si = n; S.li = 0; showSlide();
  }
  function slideStep(dir) {
    const st = S.stories[S.si];
    const n = S.li + dir;
    if (n < 0) { if (S.si > 0) { S.si -= 1; S.li = S.stories[S.si].slides.length - 1; showSlide(); } else { S.li = 0; showSlide(); } return; }
    if (n >= st.slides.length) { storyStep(1); return; }
    S.li = n; showSlide();
  }
  function showSlide() {
    clearTimeout(S.timer); S.timer = null; S.paused = false;
    const st = S.stories[S.si];
    const sl = st.slides[S.li];
    const media = $('[data-sv-media]', sv);
    const src = pickSource(sl.video);
    media.innerHTML = src
      ? '<video playsinline preload="auto"' + (sl.poster ? ' poster="' + esc(sl.poster) + '"' : '') + ' src="' + esc(src) + '"' + (muted ? ' muted' : '') + '></video>'
      : '<img src="' + esc(sl.image || '') + '" alt="">';
    $('[data-sv-mute]', sv).hidden = !src;
    $('[data-sv-cover]', sv).src = st.cover || '';
    $('[data-sv-cover]', sv).style.visibility = st.cover ? '' : 'hidden';
    $('[data-sv-label]', sv).textContent = st.label || '';
    // bars
    const bars = $('[data-sv-bars]', sv);
    bars.innerHTML = st.slides.map((_, k) => '<div class="od-sv__bar' + (k < S.li ? ' is-done' : '') + '"><i></i></div>').join('');
    // footer: banner or cards
    const foot = $('[data-sv-foot]', sv);
    let html = '';
    if (sl.kind === 'banner' && (sl.heading || sl.text || sl.button)) {
      html = '<div class="od-sv__banner od-sv__banner--' + esc(sl.align || 'bottom') + '" style="color:' + esc(sl.textColor || '#fcf8f2') + '">' +
        (sl.heading ? '<h3>' + esc(sl.heading) + '</h3>' : '') + (sl.text ? '<p>' + esc(sl.text) + '</p>' : '') +
        (sl.button && sl.link ? '<a href="' + esc(sl.link) + '">' + esc(sl.button) + '</a>' : '') + '</div>';
    } else if (sl.kind === 'product' || sl.kind === 'look') {
      const cards = productsFor(S.section, sl.id);
      if (cards.length) html = '<div class="od-sv__cards">' + cards.map((c) => c.outerHTML).join('') + '</div>';
    }
    foot.innerHTML = html;
    // progress
    const dur = src ? 0 : (sl.seconds || 6) * 1000;
    const bar = $$('.od-sv__bar i', bars)[S.li];
    S.start = Date.now(); S.remaining = dur;
    if (src) {
      const v = $('video', media);
      v.muted = muted;
      const tick = () => { if (!v.duration) return; bar.style.width = Math.min(100, v.currentTime / v.duration * 100) + '%'; };
      on(v, 'timeupdate', tick);
      on(v, 'ended', () => { markSeen(st, S.li); slideStep(1); });
      v.play().catch(() => { v.muted = true; muted = true; v.play().catch(() => {}); });
    } else {
      bar.style.transition = 'none'; bar.style.width = '0%';
      requestAnimationFrame(() => { bar.style.transition = 'width ' + dur + 'ms linear'; bar.style.width = '100%'; });
      S.timer = setTimeout(() => { markSeen(st, S.li); slideStep(1); }, dur);
    }
    const prev = $('[data-sv-prev]', sv), next = $('[data-sv-next]', sv);
    if (prev) prev.disabled = S.si === 0 && S.li === 0;
    if (next) next.disabled = false;
  }
  function pauseStory(p) {
    const st = S.stories[S.si]; if (!st) return;
    const sl = st.slides[S.li];
    const v = $('video', $('[data-sv-media]', sv));
    const bar = $$('.od-sv__bar i', sv)[S.li];
    if (p && !S.paused) {
      S.paused = true;
      if (v) v.pause();
      else { clearTimeout(S.timer); S.timer = null; S.remaining = Math.max(0, S.remaining - (Date.now() - S.start)); const w = getComputedStyle(bar).width; bar.style.transition = 'none'; bar.style.width = w; }
    } else if (!p && S.paused) {
      S.paused = false;
      if (v) v.play().catch(() => {});
      else { S.start = Date.now(); requestAnimationFrame(() => { bar.style.transition = 'width ' + S.remaining + 'ms linear'; bar.style.width = '100%'; }); S.timer = setTimeout(() => { markSeen(st, S.li); slideStep(1); }, S.remaining); }
    }
  }
  function initStoriesSection(section) {
    if (section._odStories) return;
    section._odStories = true;
    on(section, 'click', (e) => { const b = e.target.closest('[data-story-open]'); if (b) { e.preventDefault(); openStories(section, b.getAttribute('data-story-open')); } });
    paintSeen(section);
  }

  /* ---------- boot ---------- */
  function boot() {
    $$('[data-od-reels]').forEach(initReelsSection);
    $$('[data-od-stories]').forEach(initStoriesSection);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
  document.addEventListener('shopify:section:unload', () => { closeReels(); closeStories(); });
  OD.reels = { open: openReels, close: closeReels };
  OD.stories = { open: openStories, close: closeStories };
})();
