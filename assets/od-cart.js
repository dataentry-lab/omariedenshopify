/* od-cart.js — Cart drawer ("Shopping Bag") behaviour. Loaded after theme.js, uses window.OD helpers.
   - opens on header bag icon click (except on /cart) and after every add to cart (od:cart:add)
   - quantity / remove / move-to-wishlist through the AJAX cart API
   - re-renders itself with the Section Rendering API (?sections=cart-drawer) */
(function () {
  'use strict';
  const OD = window.OD;
  if (!OD) return;
  const $ = OD.$, $$ = OD.$$, on = OD.on;
  const SECTION = 'cart-drawer';

  const drawer = () => $('[data-cart-drawer]');
  const inner = () => $('[data-cart-drawer-content]');
  const isCartPage = () => document.body.classList.contains('template-cart') || (OD.cartUrl && window.location.pathname.replace(/\/$/, '') === OD.cartUrl.replace(/\/$/, ''));

  /* ---------- trending swiper (1 card per view inside the 480px panel) ---------- */
  function initSwiper(root) {
    if (typeof Swiper === 'undefined') return;
    $$('[data-cartd-swiper]', root).forEach((el) => {
      if (el.swiper) return;
      const wrap = el.parentElement;
      new Swiper(el, {
        slidesPerView: 1,
        spaceBetween: 16,
        speed: 300,
        watchOverflow: true,
        navigation: { nextEl: wrap.querySelector('.trending-swiper-button-next-custom'), prevEl: wrap.querySelector('.trending-swiper-button-prev-custom') }
      });
      el.classList.add('swiper-backface-hidden');
    });
  }

  /* ---------- client-side render from cart JSON (add.js / change.js / cart.js) ----------
     Instant: the drawer never waits for the Section Rendering API any more; that only runs later as a background sync. */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = (name) => { const d = drawer(); return d ? (d.getAttribute(name) || '') : ''; };
  const money = (cents) => (OD.SAR || '') + OD.formatMoney(cents);
  function sized(src, w) {
    if (!src) return attr('data-icon-fallback');
    src = String(src).replace(/^\/\//, 'https://');
    if (/[?&]width=/.test(src)) return src;
    return src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }
  function itemHTML(item) {
    const colorName = attr('data-color-name'), sizeName = attr('data-size-name');
    const opts = !item.product_has_only_default_variant && Array.isArray(item.options_with_values) ? item.options_with_values : [];
    const optsHTML = opts.length ? '<div class="_checkoutCard__right__details__info__textConfig_1tn6c_156 od-cartd-item__options">' + opts.map((o) => {
      const label = o.name === sizeName ? attr('data-t-size') : (o.name === colorName ? attr('data-t-color') : o.name);
      return '<p><span>' + esc(label) + ':</span><span>' + esc(o.value) + '</span></p>';
    }).join('') + '</div>' : '';
    const was = item.original_line_price > item.final_line_price ? '<p class="_checkoutCard__right__details__price_1tn6c_95 _strikeThrough_1tn6c_34 od-cartd-item__was">' + money(item.original_line_price) + '</p>' : '';
    return '<div class="_checkoutCard_1tn6c_70 od-cartd-item" data-cartd-item data-key="' + esc(item.key) + '">' +
      '<a class="_globalImg_1tf1q_38 _checkoutCard__pImg_1tn6c_77 od-cartd-item__img" href="' + esc(item.url) + '"><img alt="' + esc(item.product_title) + '" src="' + esc(sized(item.image, 300)) + '" loading="lazy"></a>' +
      '<div class="_checkoutCard__right_1tn6c_82 od-cartd-item__right">' +
        '<div class="_checkoutCard__right__details_1tn6c_88 od-cartd-item__details">' +
          '<div class="_checkoutCard__right__details__info_1tn6c_115 od-cartd-item__info">' +
            '<div class="_checkoutCard__right__details__info__text_1tn6c_122 od-cartd-item__text"><p>' + esc(item.vendor) + '</p><p><a href="' + esc(item.url) + '" class="od-cartd-item__link">' + esc(item.product_title) + '</a></p></div>' + optsHTML +
          '</div>' +
          '<div class="od-cartd-item__prices"><p class="_checkoutCard__right__details__price_1tn6c_95 null">' + money(item.final_line_price) + '</p>' + was + '</div>' +
        '</div>' +
        '<div class="_incDec_58mpv_55 od-cartd-qty" dir="ltr">' +
          '<button type="button" class="_globalImg_1tf1q_38 _incDec__icon_58mpv_99 od-cartd-qty__btn" data-cartd-change data-key="' + esc(item.key) + '" data-qty="' + (item.quantity - 1) + '" aria-label="' + esc(attr('data-t-decrease')) + '"><img alt="" src="' + esc(attr('data-icon-minus')) + '" width="16" height="16"></button>' +
          '<div class="_incDec__q_58mpv_80" aria-live="polite">' + item.quantity + '</div>' +
          '<button type="button" class="_globalImg_1tf1q_38 _incDec__icon_58mpv_99 od-cartd-qty__btn" data-cartd-change data-key="' + esc(item.key) + '" data-qty="' + (item.quantity + 1) + '" aria-label="' + esc(attr('data-t-increase')) + '"><img alt="" src="' + esc(attr('data-icon-plus')) + '" width="16" height="16"></button>' +
        '</div>' +
        '<div class="_checkoutCard__right__icons_1tn6c_175 od-cartd-item__actions">' +
          '<button type="button" class="undefined _border_9vfph_30 _iconWithText_9vfph_36 od-cartd-item__wl" data-cartd-wishlist data-key="' + esc(item.key) + '" data-handle="' + esc(item.handle) + '" data-product-id="' + esc(item.product_id) + '"><div class="_globalImg_1tf1q_38 _iconWithText__icon_9vfph_45"><img alt="" src="' + esc(attr('data-icon-wishlist')) + '" width="16" height="16"></div><p>' + esc(attr('data-t-wishlist')) + '</p></button>' +
          '<button type="button" class="undefined _border_9vfph_30 _iconWithText_9vfph_36 od-cartd-item__trash" data-cartd-change data-key="' + esc(item.key) + '" data-qty="0" aria-label="' + esc(attr('data-t-remove')) + '"><div class="_globalImg_1tf1q_38 _iconWithText__icon_9vfph_45"><img alt="" src="' + esc(attr('data-icon-trash')) + '" width="16" height="16"></div></button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  let lastCart = null;
  function render(cart) {
    const box = inner();
    if (!box || !cart || !Array.isArray(cart.items)) return false;
    lastCart = cart;
    const items = $('[data-cartd-items]', box), bag = $('[data-cartd-bag]', box), empty = $('[data-cartd-empty]', box), foot = $('[data-cartd-footer]', box), skel = $('[data-cartd-skeleton]', box);
    if (skel) skel.hidden = true;
    const n = cart.item_count || 0;
    if (items) items.innerHTML = cart.items.map(itemHTML).join('');
    if (bag) bag.hidden = n === 0;
    if (empty) empty.hidden = n > 0;
    if (foot) foot.hidden = n === 0;
    const c = $('[data-cart-drawer-count]', box); if (c) c.textContent = '(' + n + ')';
    const sub = $('[data-cartd-subtotal]', box); if (sub) sub.innerHTML = money(cart.total_price || 0);
    // free shipping bar
    const threshold = parseInt(attr('data-threshold'), 10) || 0;
    const text = $('[data-cartd-shipping-text]', box), bar = $('[data-cartd-shipping-bar]', box);
    if (threshold && text && bar) {
      const subtotal = cart.items_subtotal_price || 0;
      const remaining = threshold - subtotal;
      if (remaining <= 0) text.innerHTML = OD.t.shippingUnlocked || '';
      else text.innerHTML = String(OD.t.shippingRemaining || '').replace('{{ amount }}', OD.formatMoney(remaining));
      bar.style.width = Math.min(100, Math.round(subtotal * 100 / threshold)) + '%';
    }
    box.setAttribute('data-cart-item-count', n);
    OD.setCartCount(n);
    OD.wlPaint && OD.wlPaint(box);
    return true;
  }
  async function fetchCart() {
    const r = await fetch(OD.cartUrl + '.js', { cache: 'no-store', headers: { Accept: 'application/json' } });
    return r.json();
  }
  async function sync(showSkeleton) {
    // instant render from cart.js, then a background Section Rendering refresh (prices / translations exactly as Liquid renders them)
    const box = inner();
    const skel = box && $('[data-cartd-skeleton]', box);
    if (showSkeleton && skel && !$('[data-cartd-item]', box)) { skel.hidden = false; const e = $('[data-cartd-empty]', box); if (e) e.hidden = true; }
    try { render(await fetchCart()); } catch (err) { if (skel) skel.hidden = true; }
    scheduleRefresh();
  }
  let refreshTimer = null;
  let pending = 0;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (!pending) refresh(); }, 2500);
  }

  /* ---------- re-render through the Section Rendering API (background sync only) ---------- */
  let refreshing = null;
  let again = false;
  async function refresh() {
    // a refresh requested while one is in flight must run again afterwards (the in-flight one may predate the change)
    if (refreshing) { again = true; return refreshing; }
    const box = inner();
    if (!box || pending) return;
    box.classList.add('is-refreshing');
    let counted = false;
    refreshing = (async () => {
      try {
        const url = window.location.pathname + '?sections=' + SECTION + '&_=' + Date.now();
        const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json, text/html', 'Cache-Control': 'no-cache' } });
        let html = null;
        const type = (r.headers.get('content-type') || '').toLowerCase();
        if (type.indexOf('json') > -1) {
          const json = await r.json();
          html = json[SECTION];
        } else {
          // Mock / non-Shopify server: the endpoint returns a full page; pull the drawer out of it.
          html = await r.text();
        }
        if (html) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const fresh = $('[data-cart-drawer-content]', doc);
          if (fresh) {
            box.innerHTML = fresh.innerHTML;
            const n = parseInt(fresh.getAttribute('data-cart-item-count') || '', 10);
            if (!isNaN(n)) { OD.setCartCount(n); counted = true; }
            initSwiper(box);
            OD.wlPaint && OD.wlPaint(box);
            OD.initCards && OD.initCards(box);
          }
        }
      } catch (err) {
        /* graceful degradation: keep the current content */
      }
      if (!counted) {
        try {
          const cart = await fetch(OD.cartUrl + '.js', { headers: { Accept: 'application/json' } }).then((x) => x.json());
          if (cart && typeof cart.item_count === 'number') {
            OD.setCartCount(cart.item_count);
            const c = $('[data-cart-drawer-count]');
            if (c) c.textContent = '(' + cart.item_count + ')';
          }
        } catch (err) { /* ignore */ }
      }
      box.classList.remove('is-refreshing');
      document.dispatchEvent(new CustomEvent('od:cart:drawer:refresh'));
    })();
    try { await refreshing; } finally { refreshing = null; }
    if (again) { again = false; return refresh(); }
  }

  function open() {
    if (!drawer()) return;
    OD.openModal('cart');
    const close = $('[data-cart-drawer] [data-close-modal]');
    close && setTimeout(() => { try { close.focus({ preventScroll: true }); } catch (e) {} }, 350);
  }

  /* ---------- header bag icon → drawer (not on the cart page itself) ---------- */
  on(document, 'click', (e) => {
    if (!OD.cartUrl || isCartPage() || !drawer()) return;
    const a = e.target.closest('[data-header] a[href="' + OD.cartUrl + '"], [data-header] a[href="' + OD.cartUrl + '/"]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" through
    e.preventDefault();
    open();
    sync(true);
  });

  /* ---------- after add to cart (theme.js dispatches od:cart:add and shows the toast) ---------- */
  on(document, 'od:cart:add', () => {
    if (!drawer()) return;
    if (!isCartPage()) open();
    sync(true);
  });

  /* ---------- line item actions ---------- */
  function collapse(item) {
    if (!item) return;
    item.style.overflow = 'hidden';
    item.style.transition = 'opacity .2s ease, max-height .35s ease, margin .35s ease, padding .35s ease';
    item.style.maxHeight = item.offsetHeight + 'px';
    requestAnimationFrame(() => { item.style.opacity = '0'; item.style.maxHeight = '0px'; item.style.marginTop = '0'; item.style.marginBottom = '0'; item.style.paddingTop = '0'; item.style.paddingBottom = '0'; });
  }
  async function change(key, quantity, el) {
    el && (el.disabled = true);
    const item = el && el.closest('[data-cartd-item]');
    const removing = quantity <= 0;
    if (removing) collapse(item); else item && (item.style.opacity = '.5');
    pending++;
    try {
      const cart = await OD.cartRequest(OD.cartChangeUrl + '.js', { id: key, quantity: Math.max(0, quantity) });
      pending--;
      if (removing && item) { setTimeout(() => render(cart), 320); } else render(cart);
      scheduleRefresh();
    } catch (err) {
      pending--;
      OD.toast(err.message || OD.t.cartError, 'error');
      if (item) { item.style.cssText = ''; }
      el && (el.disabled = false);
    }
  }
  on(document, 'click', async (e) => {
    const root = e.target.closest('[data-cart-drawer]');
    if (!root) return;
    const ch = e.target.closest('[data-cartd-change]');
    if (ch) {
      e.preventDefault();
      change(ch.getAttribute('data-key'), parseInt(ch.getAttribute('data-qty'), 10) || 0, ch);
      return;
    }
    const wl = e.target.closest('[data-cartd-wishlist]');
    if (wl) {
      e.preventDefault();
      const handle = wl.getAttribute('data-handle'), id = wl.getAttribute('data-product-id');
      if (handle && OD.wlHas && !OD.wlHas(handle)) OD.wlToggle(handle, id);
      change(wl.getAttribute('data-key'), 0, wl);
      return;
    }
    const vb = e.target.closest('.od-cartd__viewbag a');
    if (vb) OD.closeModal('cart');
  });

  /* ---------- boot ---------- */
  function boot() {
    const box = inner();
    if (!box) return;
    initSwiper(box);
    OD.wlPaint && OD.wlPaint(box);
    // deep link: /...#cart opens the bag (used by the "bag" links in emails / notifications)
    if (window.location.hash === '#cart' && !isCartPage()) { open(); refresh(); }
  }
  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', boot); else boot();

  OD.cartDrawer = { open, refresh, sync, render, close: () => OD.closeModal('cart') };
})();
