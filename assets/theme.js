/* Omarieden Shopify theme — behaviour layer.
   Re-implements every interaction of the original React app (header, mega menu, modals,
   accordions, swipers, search, cart, wishlist, product variants, collection tools) on plain DOM + Shopify AJAX APIs. */
(function () {
  'use strict';
  const OD = window.OD || {};
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const CLS = {
    headerScrolled: '_headerScrolled_kqzl1_17',
    darkNav: '_darkNav_10uue_37',
    darkNavItem: '_darkItem_10uue_184',
    darkTopItem: '_darkItem_1fb5v_154',
    dropdownActive: '_dropdownIconActive_10uue_180',
    mobileNavShow: '_show_1w9c3_35',
    accOpen: '_open_ve0fr_80',
    backTopVisible: '_visible_wlu9t_60',
    selectOpen: '_open_9l1c3_73',
    treeOpen: '_open_18lju_53',
    swatchSelected: '_swatchSelected_13l1w_301',
    sizeSelected: '_selected_j1gah_66',
    thumbActive: '_active_1cnez_180',
    thumbDisabled: '_ThumbArrowDisabled_1cnez_155'
  };

  /* ---------- money ---------- */
  function formatMoney(cents) {
    const n = (cents / 100).toFixed(2);
    const parts = n.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  const SAR = '<span class="_sar_1ef42_1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39" width="11"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"></path><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"></path></svg></span>';
  OD.formatMoney = formatMoney;
  OD.SAR = SAR;

  /* ---------- data-href navigation (original used <button onClick={navigate}>) ---------- */
  on(document, 'click', (e) => {
    const el = e.target.closest('[data-href]');
    if (!el) return;
    if (e.target.closest('a, button:not([data-href]), [data-wishlist-toggle], [data-card-swatch]')) return;
    const href = el.getAttribute('data-href');
    if (href) window.location.href = href;
  });

  /* ---------- toast (react-hot-toast look: olive pill, top-center) ---------- */
  function toast(message, type) {
    const host = $('[data-od-toaster]');
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.className = 'od-toast-wrap';
    wrap.innerHTML = '<div class="od-toast od-toast--' + (type || 'success') + '" role="status" aria-live="polite"><span class="od-toast__icon">' +
      (type === 'error' ? '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="10" fill="#fff"/><path d="M6 6l8 8M14 6l-8 8" stroke="#bc2027" stroke-width="2" stroke-linecap="round"/></svg>' :
        '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="10" fill="#fff"/><path d="M5.5 10.5l3 3 6-6" stroke="#595b33" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>') +
      '</span><div class="od-toast__msg">' + message + '</div></div>';
    host.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    setTimeout(() => { wrap.classList.remove('is-in'); wrap.classList.add('is-out'); setTimeout(() => wrap.remove(), 400); }, 2200);
  }
  OD.toast = toast;

  /* ---------- header ---------- */
  function initHeader() {
    const header = $('[data-header]');
    if (!header) return;
    const dark = header.getAttribute('data-dark') === 'true';
    const nav = $('[data-nav]', header);
    const icons = $$('img[data-icon-dark]', header);
    let scrolled = false;
    const setIcons = (variant) => icons.forEach((img) => { const s = img.getAttribute('data-icon-' + variant); if (s) img.src = s; });
    const update = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      const should = y > 40;
      if (should === scrolled) return;
      scrolled = should;
      header.classList.toggle(CLS.headerScrolled, scrolled);
      if (dark) {
        setIcons(scrolled ? 'light' : 'dark');
        nav && nav.classList.toggle(CLS.darkNav, !scrolled);
        $$('[data-nav-item]', header).forEach((li) => li.classList.toggle(CLS.darkNavItem, !scrolled));
        $$('._item_1fb5v_139', header).forEach((li) => li.classList.toggle(CLS.darkTopItem, !scrolled));
      }
    };
    on(window, 'scroll', update, { passive: true });
    update();
    // mega menu: dropdown arrow rotates while hovered (menu itself is shown by CSS :hover)
    $$('[data-nav-item]', header).forEach((li) => {
      const icon = $('[data-dropdown-icon]', li);
      on(li, 'mouseenter', () => icon && icon.classList.add(CLS.dropdownActive));
      on(li, 'mouseleave', () => icon && icon.classList.remove(CLS.dropdownActive));
    });
    // mobile nav
    const mobileNav = $('[data-mobile-nav]');
    on(document, 'click', (e) => {
      if (e.target.closest('[data-open-mobile-nav]')) { mobileNav && mobileNav.classList.add(CLS.mobileNavShow); document.body.style.overflow = 'hidden'; }
      if (e.target.closest('[data-close-mobile-nav]')) { mobileNav && mobileNav.classList.remove(CLS.mobileNavShow); document.body.style.overflow = ''; }
      const sub = e.target.closest('[data-open-submenu]');
      if (sub) openModal('submenu-' + sub.getAttribute('data-open-submenu'));
    });
  }

  /* ---------- modals (search / login / language / filter / mobile submenus) ---------- */
  const openModals = new Set();
  function openModal(name) {
    const modal = $('[data-modal="' + name + '"]');
    const backdrop = $('[data-modal-backdrop="' + name + '"]');
    if (!modal) return;
    modal.classList.add(modal.getAttribute('data-show-class'));
    backdrop && backdrop.classList.add(backdrop.getAttribute('data-show-class'));
    openModals.add(name);
    document.body.style.overflow = 'hidden';
    if (name === 'search') { const i = $('[data-search-input]', modal); i && setTimeout(() => i.focus(), 120); }
    document.dispatchEvent(new CustomEvent('od:modal:open', { detail: { name } }));
  }
  function closeModal(name) {
    const modal = $('[data-modal="' + name + '"]');
    const backdrop = $('[data-modal-backdrop="' + name + '"]');
    if (!modal) return;
    modal.classList.remove(modal.getAttribute('data-show-class'));
    backdrop && backdrop.classList.remove(backdrop.getAttribute('data-show-class'));
    openModals.delete(name);
    if (!openModals.size && !($('[data-mobile-nav]') && $('[data-mobile-nav]').classList.contains(CLS.mobileNavShow))) document.body.style.overflow = '';
  }
  OD.openModal = openModal; OD.closeModal = closeModal; OD.toast = toast; OD.$ = $; OD.$$ = $$; OD.on = on; OD.debounce = debounce; OD.CLS = CLS; OD.openModals = openModals;
  on(document, 'click', (e) => {
    const o = e.target.closest('[data-open-modal]');
    if (o) { e.preventDefault(); openModal(o.getAttribute('data-open-modal')); return; }
    const c = e.target.closest('[data-close-modal]');
    if (c) { closeModal(c.getAttribute('data-close-modal')); return; }
    const b = e.target.closest('[data-modal-backdrop]');
    if (b) closeModal(b.getAttribute('data-modal-backdrop'));
  });
  on(document, 'keydown', (e) => { if (e.key === 'Escape') Array.from(openModals).forEach(closeModal); });

  /* ---------- accordions (height-animated, plus/minus icon swap) ---------- */
  function setAccordion(acc, open) {
    const btn = $('[data-accordion-toggle]', acc);
    const content = $('[data-accordion-content]', acc);
    const img = btn && $('img[data-icon-plus]', btn);
    if (!content) return;
    btn && btn.classList.toggle(CLS.accOpen, open);
    if (img) img.src = img.getAttribute(open ? 'data-icon-minus' : 'data-icon-plus');
    if (open) {
      content.style.height = content.scrollHeight + 'px';
      content.style.marginBottom = '16px';
      content.setAttribute('data-accordion-open', '');
      const done = () => { if (content.hasAttribute('data-accordion-open')) content.style.height = 'auto'; content.removeEventListener('transitionend', done); };
      content.addEventListener('transitionend', done);
    } else {
      content.style.height = content.scrollHeight + 'px';
      requestAnimationFrame(() => { content.style.height = '0px'; content.style.marginBottom = '0px'; });
      content.removeAttribute('data-accordion-open');
    }
  }
  on(document, 'click', (e) => {
    const t = e.target.closest('[data-accordion-toggle]');
    if (!t) return;
    if (e.target.closest('a')) return;
    const acc = t.closest('[data-accordion]');
    const content = $('[data-accordion-content]', acc);
    setAccordion(acc, !content.hasAttribute('data-accordion-open'));
  });
  OD.setAccordion = setAccordion;

  /* ---------- category tree toggles (filter drawer) ---------- */
  on(document, 'click', (e) => {
    const t = e.target.closest('[data-tree-toggle]');
    if (!t) return;
    e.preventDefault();
    const row = t.closest('._level1_18lju_60, ._level2_18lju_97');
    const children = row && row.nextElementSibling && row.nextElementSibling.hasAttribute('data-tree-children') ? row.nextElementSibling : null;
    const open = !t.classList.contains(CLS.treeOpen);
    t.classList.toggle(CLS.treeOpen, open);
    if (children) children.hidden = !open;
    const acc = t.closest('[data-accordion]');
    const content = acc && $('[data-accordion-content]', acc);
    if (content && content.hasAttribute('data-accordion-open')) content.style.height = 'auto';
  });

  /* ---------- back to top ---------- */
  OD.setAccordion = setAccordion;
  function initBackToTop() {
    const btn = $('[data-back-to-top]');
    if (!btn) return;
    const update = () => btn.classList.toggle(CLS.backTopVisible, (window.scrollY || 0) > 800);
    on(window, 'scroll', update, { passive: true }); update();
    on(btn, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---------- custom select (sort dropdown, contact topic, FAQ category) ---------- */
  on(document, 'click', (e) => {
    const opt = e.target.closest('[data-select-options] li');
    let box = e.target.closest('[data-select]');
    let list = null;
    if (opt) {
      list = opt.closest('[data-select-options]');
      box = box || (list.parentElement && list.parentElement.querySelector('[data-select]'));
    }
    $$('[data-select].' + CLS.selectOpen).forEach((b) => { if (b !== box) { b.classList.remove(CLS.selectOpen); const l = b.parentElement.querySelector('[data-select-options]'); l && (l.hidden = true); } });
    if (!box) return;
    if (!list) list = box.parentElement.querySelector('[data-select-options]');
    if (opt) {
      const value = opt.getAttribute('data-value') != null ? opt.getAttribute('data-value') : opt.textContent.trim();
      const label = $('[data-select-label]', box);
      if (label) { label.textContent = opt.textContent.trim(); label.classList.remove('_placeholder_9l1c3_76'); label.classList.add('_value_9l1c3_91'); }
      const input = box.parentElement.querySelector('input[type=hidden]');
      if (input) { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); }
      box.classList.remove(CLS.selectOpen); list && (list.hidden = true);
      box.dispatchEvent(new CustomEvent('od:select', { detail: { value, label: opt.textContent.trim() }, bubbles: true }));
      return;
    }
    const open = !box.classList.contains(CLS.selectOpen);
    box.classList.toggle(CLS.selectOpen, open);
    if (list) list.hidden = !open;
  });

  /* ---------- swipers ---------- */
  function initSwipers(root) {
    if (typeof Swiper === 'undefined') return;
    const rtl = !!OD.rtl;
    const CHEVRON = '<svg class="swiper-navigation-icon" width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.38296 20.0762C0.111788 19.805 0.111788 19.3654 0.38296 19.0942L9.19758 10.2796L0.38296 1.46497C0.111788 1.19379 0.111788 0.754138 0.38296 0.482966C0.654131 0.211794 1.09379 0.211794 1.36496 0.482966L10.4341 9.55214C10.8359 9.9539 10.8359 10.6053 10.4341 11.007L1.36496 20.0762C1.09379 20.3474 0.654131 20.3474 0.38296 20.0762Z" fill="currentColor"></path></svg>';
    $$('[data-swiper]', root).forEach((el) => {
      if (el.swiper) return;
      // arrows may sit outside the swiper (wrapper .od-carousel) so they can hang over the container edges
      const nav = (sel) => $(sel, el) || (el.parentElement && el.parentElement.classList.contains('od-carousel') ? $(sel, el.parentElement) : null);
      $$('.swiper-button-prev, .swiper-button-next', el.parentElement && el.parentElement.classList.contains('od-carousel') ? el.parentElement : el).forEach((b) => { if (!b.children.length) b.innerHTML = CHEVRON; });
      const kind = el.getAttribute('data-swiper');
      const common = { speed: 300, spaceBetween: 30 };
      let opts = {};
      if (kind === 'hero') {
        const slides = $$('.swiper-slide', el).length;
        opts = { slidesPerView: 1, loop: slides > 1, autoplay: slides > 1 ? { delay: parseInt(el.getAttribute('data-autoplay') || '5500', 10), disableOnInteraction: false } : false, pagination: { el: $('.swiper-pagination', el), clickable: true } };
      } else if (kind === 'cards') {
        // mobile (round 6): ~2.3 cards so the third peeks in, olive dots under the row (od-carousel CSS)
        opts = { slidesPerView: 5, breakpoints: { 0: { slidesPerView: 2.3, spaceBetween: 10 }, 480: { slidesPerView: 2.3, spaceBetween: 12 }, 768: { slidesPerView: 4 }, 1024: { slidesPerView: 4 }, 1280: { slidesPerView: 5 } },
          navigation: { nextEl: nav('.swiper-button-next'), prevEl: nav('.swiper-button-prev') }, pagination: { el: nav('.swiper-pagination'), clickable: true }, watchOverflow: true };
      } else if (kind === 'product') {
        opts = { slidesPerView: 1, navigation: { nextEl: $('.swiper-button-next', el), prevEl: $('.swiper-button-prev', el) }, pagination: { el: $('.swiper-pagination', el), clickable: true }, watchOverflow: true };
      } else if (kind === 'space') {
        opts = { slidesPerView: 1, loop: true, navigation: { nextEl: $('.swiper-button-next', el), prevEl: $('.swiper-button-prev', el) } };
      } else if (kind === 'looks') {
        const cols = parseInt(el.getAttribute('data-columns') || '3', 10);
        opts = { slidesPerView: 1, spaceBetween: 16, breakpoints: { 0: { slidesPerView: 1 }, 768: { slidesPerView: cols } },
          navigation: { nextEl: $('.swiper-button-next', el), prevEl: $('.swiper-button-prev', el) }, watchOverflow: true };
      } else if (kind === 'trending') {
        // original: 2.5 cards visible on desktop (slide width 289.2px inside the 768px column)
        opts = { slidesPerView: 2.5, spaceBetween: 30, breakpoints: { 0: { slidesPerView: 1.2 }, 768: { slidesPerView: 2 }, 1024: { slidesPerView: 2.5 } },
          navigation: { nextEl: el.parentElement.querySelector('.trending-swiper-button-next-custom'), prevEl: el.parentElement.querySelector('.trending-swiper-button-prev-custom') }, watchOverflow: true };
      }
      const sw = new Swiper(el, Object.assign({}, common, opts));
      if (!rtl) { /* swiper adds swiper-rtl automatically from dir */ }
      el.classList.add('swiper-backface-hidden');
      return sw;
    });
  }
  OD.initSwipers = initSwipers;

  /* ---------- product card helpers (swatch → image) ---------- */
  on(document, 'click', (e) => {
    const sw = e.target.closest('[data-card-swatch]');
    if (!sw) return;
    e.preventDefault(); e.stopPropagation();
    const card = sw.closest('[data-product-card]');
    $$('[data-card-swatch]', card).forEach((b) => { b.classList.remove(CLS.swatchSelected); b.setAttribute('aria-pressed', 'false'); });
    sw.classList.add(CLS.swatchSelected); sw.setAttribute('aria-pressed', 'true');
    const img = $('[data-card-image]', card);
    const src = sw.getAttribute('data-image');
    if (img && src) { img.removeAttribute('srcset'); img.src = src; }
  });

  /* ---------- wishlist (browser storage, per device) ---------- */
  const WL_KEY = 'od_wishlist' + (OD.customerId ? '_' + OD.customerId : '');
  function wlGet() { try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch (e) { return []; } }
  function wlSet(list) { try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) {} document.dispatchEvent(new CustomEvent('od:wishlist', { detail: list })); }
  function wlHas(handle) { return wlGet().some((i) => i.handle === handle); }
  function wlToggle(handle, id) {
    let list = wlGet();
    const has = list.some((i) => i.handle === handle);
    if (has) list = list.filter((i) => i.handle !== handle); else list.push({ handle, id, at: Date.now() });
    wlSet(list);
    toast(has ? OD.t.removedFromWishlist : OD.t.addedToWishlist);
    return !has;
  }
  function wlPaint(root) {
    $$('[data-wishlist-toggle]', root).forEach((el) => {
      const img = $('img', el);
      const active = wlHas(el.getAttribute('data-wishlist-handle'));
      el.classList.toggle('is-active', active);
      if (img) img.src = active ? OD.assets.wishlistFilled : OD.assets.wishlist;
    });
  }
  on(document, 'click', (e) => {
    const t = e.target.closest('[data-wishlist-toggle]');
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    wlToggle(t.getAttribute('data-wishlist-handle'), t.getAttribute('data-wishlist-id'));
    wlPaint(document);
  });
  on(document, 'od:wishlist', () => wlPaint(document));
  OD.wishlist = { get: wlGet, set: wlSet, has: wlHas, toggle: wlToggle, paint: wlPaint };

  /* ---------- cart ---------- */
  async function cartRequest(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.description || data.message || OD.t.cartError);
    return data;
  }
  function setCartCount(n) {
    $$('[data-cart-count]').forEach((el) => (el.textContent = n));
    $$('[data-cart-count-wrap]').forEach((el) => { el.style.setProperty('display', n > 0 ? 'flex' : 'none', 'important'); });
    OD.cartCount = n;
  }
  async function addToCart(variantId, quantity) {
    const data = await cartRequest(OD.cartAddUrl + '.js', { items: [{ id: variantId, quantity: quantity || 1 }] });
    toast(OD.t.addedToCart);
    setCartCount((OD.cartCount || 0) + (quantity || 1));
    // open the cart drawer right away; it re-renders itself and corrects the count
    document.dispatchEvent(new CustomEvent('od:cart:add', { detail: { data } }));
    if (!OD.cartDrawer) {
      try { const cart = await fetch(OD.cartUrl + '.js', { headers: { Accept: 'application/json' } }).then((r) => r.json()); setCartCount(cart.item_count); return cart; } catch (e) { /* ignore */ }
    }
    return data;
  }
  /* button spinner (original site: ._spinner_n0fwu_38 rings) */
  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      if (btn.classList.contains('od-busy')) return;
      btn.classList.add('od-busy');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      const sp = document.createElement('span');
      sp.className = 'od-btn-spinner';
      sp.innerHTML = '<span class="od-btn-spinner__ring"></span>';
      btn.appendChild(sp);
    } else {
      btn.classList.remove('od-busy');
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
      const sp = btn.querySelector('.od-btn-spinner');
      sp && sp.remove();
    }
  }
  OD.addToCart = addToCart; OD.setCartCount = setCartCount; OD.cartRequest = cartRequest; OD.setLoading = setLoading;
  on(document, 'click', async (e) => {
    const b = e.target.closest('[data-add-to-cart]');
    if (!b) return;
    e.preventDefault();
    const id = b.getAttribute('data-variant-id') || (b.form && b.form.querySelector('[name=id]') && b.form.querySelector('[name=id]').value);
    if (!id) return toast(OD.t.cartError, 'error');
    setLoading(b, true);
    try { await addToCart(id, 1); } catch (err) { toast(err.message, 'error'); }
    setLoading(b, false);
  });

  OD.wlToggle = wlToggle; OD.wlHas = wlHas; OD.wlPaint = wlPaint; OD.wlGet = wlGet;
  /* ---------- search overlay (predictive) ---------- */
  function cardHTML(p) {
    const img = p.featured_image || (p.image && p.image.src) || p.image || OD.assets.fallback;
    const price = p.price != null ? (typeof p.price === 'number' ? formatMoney(p.price) : String(p.price).replace(/[^\d.,]/g, '')) : '';
    const color = p.options ? p.options.find((o) => /colou?r|لون/i.test(o.name || o)) : null;
    const values = color && color.values ? color.values : [];
    const swatches = values.map((v, i) => '<button type="button" title="' + v + '" aria-label="' + v + '" aria-pressed="' + (i === 0) + '" class="_swatch_13l1w_280 ' + (i === 0 ? CLS.swatchSelected : '') + ' " style="background: ' + (OD.swatchColor ? OD.swatchColor(v, p.swatches) : String(v).toLowerCase()) + ';"></button>').join('');
    return '<div class="_new_in_trend_card_13l1w_130" data-product-card data-handle="' + p.handle + '">' +
      '<div class="_new_in_trend_card__innercard_13l1w_181">' +
      '<div class="_new_in_trend_card__innercard__wishlist_with_new_13l1w_196"><div class="_globalImg_1tf1q_38 _wishlistIcon_13l1w_356" data-wishlist-toggle data-wishlist-handle="' + p.handle + '" data-wishlist-id="' + p.id + '"><img alt="' + (p.title || '') + '" src="' + OD.assets.wishlist + '"></div><div></div></div>' +
      '<a href="' + (p.url || (OD.rootUrl + 'products/' + p.handle)) + '" class="_globalImg_1tf1q_38 _new_in_trend_card__innercard_thumbnel_13l1w_206" style="display:block"><img alt="' + (p.title || '') + '" src="' + img + '" data-card-image></a></div>' +
      '<div class="' + (OD.rtl ? '_new_in_trend_card__detailsRtl_13l1w_220' : '_new_in_trend_card__detailsLtr_13l1w_215') + ' _new_in_trend_card__product_details_13l1w_224">' +
      '<div class="' + (OD.rtl ? '_new_in_trend_card__colorsRtl_13l1w_139' : '_new_in_trend_card__colorsLtr_13l1w_139') + '">' + swatches + '</div>' +
      '<p class="_new_in_trend_card__product_details__brand_13l1w_231">' + (p.vendor ? '<a class="od-brand-link" href="' + OD.vendorUrl(p.vendor) + '">' + p.vendor + '</a>' : '') + '</p>' +
      '<p class="_new_in_trend_card__product_details__product_name_13l1w_246">' + (p.title || '') + '</p>' +
      '<div class="_priceRow_13l1w_392"><p class="_new_in_trend_card__product_details__product_price_13l1w_260 null">' + SAR + price + '</p></div></div></div>';
  }
  OD.cardHTML = cardHTML;
  /* swatch CSS background for a colour value (round 7): per-product swatches from product-json (Shopify colour/image) win,
     then the theme map "NAME:#hex" or "NAME:#hex,#hex[,#hex]" (split circle), then the name itself as a CSS colour */
  const swatchMap = {};
  String(OD.swatchMap || '').split(/\r?\n/).forEach((line) => { const i = line.indexOf(':'); if (i > 0) swatchMap[line.slice(0, i).trim().toUpperCase()] = line.slice(i + 1).trim(); });
  OD.swatchColor = (value, swatches) => {
    if (swatches && swatches[value]) return swatches[value];
    let out = swatchMap[String(value || '').trim().toUpperCase()] || '';
    if (out.indexOf(',') > -1) {
      const c = out.split(',').map((x) => x.trim()).filter(Boolean);
      out = c.length === 2 ? 'linear-gradient(135deg, ' + c[0] + ' 50%, ' + c[1] + ' 50%)' : 'linear-gradient(135deg, ' + c[0] + ' 33.4%, ' + c[1] + ' 33.4%, ' + c[1] + ' 66.7%, ' + c[2] + ' 66.7%)';
    }
    return out || String(value || '').toLowerCase().replace(/\s+/g, '');
  };
  /* brand -> all products of that vendor (same page as the Brands list, /collections/vendors?q=NAME) */
  OD.vendorUrl = (vendor) => ((OD.rootUrl || '/').replace(/\/$/, '') + '/collections/vendors?q=' + encodeURIComponent(vendor || '').replace(/%20/g, '+'));
  function initSearch() {
    const modal = $('[data-modal="search"]');
    if (!modal) return;
    const input = $('[data-search-input]', modal);
    const clear = $('[data-search-clear]', modal);
    const results = $('[data-search-results]', modal);
    const skeleton = '<div class="_resultContainer_j9u6d_82"><div class="_resultContainer__content_j9u6d_86"><div class="od-skel od-skel--line" style="width:120px"></div><div class="od-skel od-skel--line" style="width:60%"></div><div class="od-skel od-skel--line" style="width:45%"></div><div class="_products_j9u6d_246"><div class="_products__grid_j9u6d_281">' + '<div class="od-skel od-skel--card"></div>'.repeat(4) + '</div></div></div></div>';
    const render = (q, data) => {
      const queries = (data.resources.results.queries || []).slice(0, 10);
      const products = (data.resources.results.products || []).slice(0, 5);
      const hl = (s) => s.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<strong>$1</strong>');
      let html = '<div class="_resultContainer_j9u6d_82"><div class="_resultContainer__content_j9u6d_86">';
      if (queries.length) {
        html += '<div class="_suggestions_j9u6d_200"><h3 class="_suggestions__title_j9u6d_203">' + OD.t.suggestion + '</h3><div class="_suggestions__list_j9u6d_218">' +
          queries.map((s) => '<div class="_suggestions__item_j9u6d_222" data-suggestion="' + s.text.replace(/"/g, '&quot;') + '">' + hl(s.text) + '</div>').join('') + '</div></div>';
      }
      if (products.length) {
        html += '<h3 class="_products__title_j9u6d_265">' + OD.t.products + '</h3><div class="_products_j9u6d_246"><div class="_products__grid_j9u6d_281">' +
          products.map((p) => (OD.cardHTML || cardHTML)({ id: p.id, handle: p.handle, title: p.title, vendor: p.vendor, url: p.url, featured_image: p.featured_image && p.featured_image.url, price: p.price, compare_at_price: p.compare_at_price_max || null, tags: p.tags || [], available: p.available !== false, variants: p.variants && p.variants.length ? p.variants.map((v) => ({ id: v.id, title: v.title, available: v.available !== false, price: v.price })) : undefined, options: [] })).join('') + '</div></div>';
        html += '<button type="button" class="_btn_lnddl_30 _viewAllBtn_j9u6d_377" data-search-submit>' + OD.t.viewResults + '</button>';
      } else if (!queries.length) {
        html += '<p class="_suggestions__title_j9u6d_203">' + OD.t.noResults + '</p>';
      }
      html += '</div></div>';
      results.innerHTML = html;
      $$('[data-wishlist-toggle]', results).length && wlPaint(results);
    };
    const run = debounce(async () => {
      const q = input.value.trim();
      if (clear) clear.style.display = q ? '' : 'none';
      if (!q) { results.hidden = true; results.innerHTML = ''; return; }
      results.hidden = false; results.innerHTML = skeleton;
      try {
        const url = OD.predictiveSearchUrl + '?q=' + encodeURIComponent(q) + '&resources[type]=product,query&resources[limit]=5&resources[limit_scope]=each&resources[options][unavailable_products]=last&resources[options][fields]=title,product_type,variants.title,vendor,tag';
        const data = await fetch(url, { headers: { Accept: 'application/json' } }).then((r) => r.json());
        render(q, data);
      } catch (err) { results.innerHTML = ''; }
    }, 250);
    on(input, 'input', run);
    on(clear, 'click', () => { input.value = ''; run(); input.focus(); });
    on(modal, 'click', (e) => {
      const s = e.target.closest('[data-suggestion]');
      if (s) { input.value = s.getAttribute('data-suggestion'); $('[data-search-form]', modal).submit(); }
      if (e.target.closest('[data-search-submit]')) $('[data-search-form]', modal).submit();
    });
    on(document, 'od:modal:open', (e) => { if (e.detail.name === 'search' && input.value) run(); });
  }

  /* ---------- language drawer ---------- */
  function initLocalization() {
    const form = $('[data-localization-form]');
    if (!form) return;
    on(form, 'click', (e) => {
      const l = e.target.closest('[data-locale-option]');
      const c = e.target.closest('[data-country-option]');
      if (l) { $('[data-locale-input]', form).value = l.getAttribute('data-locale-option'); form.submit(); }
      if (c) { $('[data-country-input]', form).value = c.getAttribute('data-country-option'); form.submit(); }
    });
  }

  /* ---------- collection / search toolbar: moved to assets/od-listing.js (AJAX sort / filter, skeletons, grid toggle, infinite scroll) ---------- */
  function initCollectionTools() {}

  /* ---------- product page ---------- */
  function initProduct() {
    const root = $('[data-product-root]');
    if (!root) return;
    const product = JSON.parse($('[data-product-json]', root).textContent);
    const colorName = root.getAttribute('data-color-option');
    const sizeName = root.getAttribute('data-size-option');
    const optName = (o) => (typeof o === 'string' ? o : o.name);
    const colorIdx = product.options.findIndex((o) => optName(o) === colorName);
    const sizeIdx = product.options.findIndex((o) => optName(o) === sizeName);
    const selected = product.options.map(() => null);
    const initial = product.variants.find((v) => v.id === parseInt(root.getAttribute('data-selected-variant'), 10)) || product.variants.find((v) => v.available) || product.variants[0];
    initial.options.forEach((v, i) => (selected[i] = v));
    const priceEl = $('[data-product-price]', root);
    const compareEl = $('[data-product-compare]', root);
    const idInput = $('[name="id"]', root);
    const addBtn = $('[data-add-to-cart]', root);
    const styleCode = $('[data-style-code]', root);
    const findVariant = () => product.variants.find((v) => v.options.every((o, i) => selected[i] === null || o === selected[i]));
    const paint = () => {
      const v = findVariant();
      $$('[data-option-index]', root).forEach((wrap) => {
        const i = parseInt(wrap.getAttribute('data-option-index'), 10);
        const label = $('[data-option-value-label]', wrap);
        if (label) label.textContent = selected[i] || '';
        $$('[data-option-value]', wrap).forEach((el) => {
          const val = el.getAttribute('data-option-value');
          const active = val === selected[i];
          if (i === colorIdx) { const d = $('div', el); d && d.classList.toggle('_selected_a8uha_45', active); d && d.classList.toggle('undefined', !active); }
          else { const d = $('._wrapper_j1gah_59', el); d && d.classList.toggle(CLS.sizeSelected, active); }
          // availability for size when colour chosen
          if (i === sizeIdx && colorIdx > -1) {
            const exists = product.variants.some((pv) => pv.options[i] === val && pv.options[colorIdx] === selected[colorIdx] && pv.available);
            el.classList.toggle('_disabled_j1gah_71', !exists);
          }
        });
      });
      if (v) {
        idInput && (idInput.value = v.id);
        addBtn && addBtn.setAttribute('data-variant-id', v.id);
        priceEl && (priceEl.innerHTML = SAR + formatMoney(v.price));
        if (compareEl) { compareEl.style.display = v.compare_at_price > v.price ? '' : 'none'; compareEl.innerHTML = SAR + formatMoney(v.compare_at_price || 0); }
        if (addBtn) { addBtn.disabled = !v.available; addBtn.textContent = v.available ? addBtn.getAttribute('data-label-add') : addBtn.getAttribute('data-label-sold'); }
        if (styleCode && v.sku && !styleCode.getAttribute('data-fixed')) styleCode.textContent = v.sku;
        if (colorIdx > -1 && window.odGallery && window.odGallery.setColour) window.odGallery.setColour(selected[colorIdx]);
        if (v.featured_media && window.odGallery && !fromGallery) window.odGallery.goToMedia(v.featured_media.id);
      } else if (addBtn) { addBtn.disabled = true; addBtn.textContent = addBtn.getAttribute('data-label-unavailable'); }
    };
    let fromGallery = false;
    on(root, 'click', (e) => {
      const el = e.target.closest('[data-option-value]');
      if (!el) return;
      e.preventDefault();
      const i = parseInt(el.closest('[data-option-index]').getAttribute('data-option-index'), 10);
      selected[i] = el.getAttribute('data-option-value');
      paint();
    });
    paint();

    /* ---- photos per colour (round 7): a photo belongs to a colour when it is that colour's variant image,
       or its alt text is the colour name (optionally "Colour - description"). No match = shared photo. ---- */
    const galleryMode = colorIdx > -1 && product.options.length ? (OD.galleryColorMode || 'filter') : 'off';
    const colourValues = colorIdx > -1 ? ((typeof product.options[colorIdx] === 'object' && product.options[colorIdx].values) || product.variants.map((pv) => pv.options[colorIdx]).filter((x, k, arr) => arr.indexOf(x) === k)) : [];
    const mediaColour = {};
    (product.media || []).forEach((m) => {
      const byVariant = product.variants.find((pv) => pv.featured_media && pv.featured_media.id === m.id);
      if (byVariant) { mediaColour[m.id] = byVariant.options[colorIdx]; return; }
      const alt = String(m.alt || '').trim().toLowerCase();
      if (!alt) return;
      const hit = colourValues.find((c) => { const cl = String(c).trim().toLowerCase(); return alt === cl || /^[\s\-|:,]/.test(alt.slice(cl.length)) && alt.startsWith(cl); });
      if (hit) mediaColour[m.id] = hit;
    });
    const colourOf = (el) => (el ? mediaColour[el.getAttribute('data-media-id')] || null : null);

    // gallery: thumbnails + swiper + hover zoom
    const gallery = $('[data-swiper="product"]', root);
    const wrapper = gallery && $('.swiper-wrapper', gallery);
    const allSlides = gallery ? $$('.swiper-slide', gallery) : [];
    const thumbs = $$('[data-thumb]', root);
    const scroll = $('[data-thumb-scroll]', root);
    const up = $('[data-thumb-up]', root), down = $('[data-thumb-down]', root);
    const visibleSlides = () => (gallery ? $$('.swiper-slide', gallery) : []);
    const activeMediaId = () => { const s = visibleSlides()[gallery.swiper.activeIndex]; return s ? s.getAttribute('data-media-id') : null; };
    const setActive = (mediaId) => thumbs.forEach((t) => t.classList.toggle(CLS.thumbActive, t.getAttribute('data-media-id') == mediaId));
    const updateArrows = () => {
      if (!scroll) return;
      up && up.classList.toggle(CLS.thumbDisabled, scroll.scrollTop <= 0); up && (up.disabled = scroll.scrollTop <= 0);
      const end = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1;
      down && down.classList.toggle(CLS.thumbDisabled, end); down && (down.disabled = end);
    };
    let currentColour = null;
    const applyFilter = (colour) => {
      if (!gallery || !gallery.swiper || galleryMode !== 'filter' || colour === currentColour) return;
      currentColour = colour;
      const keep = (id) => !mediaColour[id] || mediaColour[id] === colour;
      const kept = allSlides.filter((s) => keep(s.getAttribute('data-media-id')));
      if (!kept.length) return;
      // rebuild the wrapper in the original order with only this colour's photos (plus shared ones)
      allSlides.forEach((s) => { if (s.parentNode === wrapper) wrapper.removeChild(s); });
      kept.forEach((s) => { s.style.transform = ''; wrapper.appendChild(s); });
      thumbs.forEach((t) => { t.style.display = keep(t.getAttribute('data-media-id')) ? '' : 'none'; });
      gallery.swiper.update();
      gallery.swiper.slideTo(0, 0);
      setActive(activeMediaId());
      setTimeout(updateArrows, 50);
    };
    if (gallery) {
      const wait = setInterval(() => {
        if (!gallery.swiper) return; clearInterval(wait);
        gallery.swiper.on('slideChange', () => {
          const id = activeMediaId();
          setActive(id);
          // two-way sync: scrolling onto another colour's photo selects that colour
          if (galleryMode === 'sync' && colorIdx > -1) {
            const c = mediaColour[id];
            if (c && c !== selected[colorIdx]) { selected[colorIdx] = c; fromGallery = true; paint(); fromGallery = false; }
          }
        });
        window.odGallery = {
          goToMedia: (id) => { const i = visibleSlides().findIndex((s) => s.getAttribute('data-media-id') == id); if (i > -1) gallery.swiper.slideTo(i); },
          setColour: applyFilter
        };
        if (colorIdx > -1) applyFilter(selected[colorIdx]);
        const first = findVariant();
        if (first && first.featured_media) window.odGallery.goToMedia(first.featured_media.id);
      }, 50);
      thumbs.forEach((t) => on(t, 'click', () => { const id = t.getAttribute('data-media-id'); window.odGallery && window.odGallery.goToMedia(id); setActive(id); }));
      on(up, 'click', () => { scroll.scrollBy({ top: -120, behavior: 'smooth' }); });
      on(down, 'click', () => { scroll.scrollBy({ top: 120, behavior: 'smooth' }); });
      on(scroll, 'scroll', updateArrows); setTimeout(updateArrows, 300);
      $$('._zoomWrap_1cnez_226', gallery).forEach((wrap) => {
        const img = $('img', wrap);
        on(wrap, 'mousemove', (e) => { const r = wrap.getBoundingClientRect(); img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%'; img.style.transform = 'scale(2)'; });
        on(wrap, 'mouseleave', () => { img.style.transformOrigin = '50% 50%'; img.style.transform = 'scale(1)'; });
      });
    }
    // wishlist button on PDP
    const wb = $('[data-pdp-wishlist]', root);
    if (wb) {
      const paintWb = () => { const img = $('img', wb); img.src = wlHas(product.handle) ? OD.assets.wishlistFilled : OD.assets.wishlist; };
      on(wb, 'click', (e) => { e.preventDefault(); wlToggle(product.handle, product.id); paintWb(); });
      paintWb();
    }
  }

  /* ---------- product recommendations (You might also like) ---------- */
  async function initRecommendations() {
    const box = $('[data-recommendations]');
    if (!box || box.getAttribute('data-performed') === 'true') return;
    try {
      const html = await fetch(box.getAttribute('data-url')).then((r) => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = $('[data-recommendations]', doc);
      if (fresh && fresh.innerHTML.trim()) { box.innerHTML = fresh.innerHTML; initSwipers(box); wlPaint(box); }
    } catch (err) { /* keep fallback */ }
  }

  /* ---------- cart page ---------- */
  function initCartPage() {
    const page = $('[data-cart-page]');
    if (!page) return;
    const refresh = async () => {
      const html = await fetch(window.location.pathname + '?section_id=' + page.getAttribute('data-section-id')).then((r) => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = $('[data-cart-page]', doc);
      if (fresh) { page.innerHTML = fresh.innerHTML; initSwipers(page); wlPaint(page); }
      const cart = await fetch(OD.cartUrl + '.js').then((r) => r.json());
      setCartCount(cart.item_count);
    };
    on(page, 'click', async (e) => {
      const change = e.target.closest('[data-line-change]');
      if (change) {
        const line = change.getAttribute('data-line'); const qty = parseInt(change.getAttribute('data-qty'), 10);
        change.style.opacity = '.5';
        try { await cartRequest(OD.cartChangeUrl + '.js', { line: parseInt(line, 10), quantity: Math.max(0, qty) }); await refresh(); } catch (err) { toast(err.message, 'error'); change.style.opacity = ''; }
        return;
      }
      const move = e.target.closest('[data-move-to-wishlist]');
      if (move) {
        const handle = move.getAttribute('data-handle'), id = move.getAttribute('data-product-id'), line = move.getAttribute('data-line');
        if (!wlHas(handle)) wlToggle(handle, id);
        try { await cartRequest(OD.cartChangeUrl + '.js', { line: parseInt(line, 10), quantity: 0 }); await refresh(); } catch (err) { toast(err.message, 'error'); }
        return;
      }
      const quick = e.target.closest('[data-quick-add]');
      if (quick) { e.preventDefault(); try { await addToCart(quick.getAttribute('data-quick-add'), 1); await refresh(); } catch (err) { toast(err.message, 'error'); } return; }
      const promoBtn = e.target.closest('[data-promo-apply]');
      if (promoBtn) {
        const input = $('[data-promo-input]', page);
        const code = input && input.value.trim();
        if (code) window.location.href = OD.rootUrl.replace(/\/$/, '') + '/discount/' + encodeURIComponent(code) + '?redirect=' + encodeURIComponent(OD.cartUrl);
      }
    });
    on(page, 'input', (e) => { if (e.target.matches('[data-promo-input]')) { const b = $('[data-promo-apply]', page); b && (b.disabled = !e.target.value.trim()); } });
    on(page, 'keydown', (e) => { if (e.target.matches('[data-promo-input]') && e.key === 'Enter') { e.preventDefault(); $('[data-promo-apply]', page).click(); } });
  }

  /* ---------- wishlist page ---------- */
  async function initWishlistPage() {
    const root = $('[data-wishlist-page]');
    if (!root) return;
    const grid = $('[data-wishlist-grid]', root);
    const empty = $('[data-wishlist-empty]', root);
    const count = $('[data-wishlist-count]', root);
    const render = async () => {
      const list = wlGet().sort((a, b) => b.at - a.at);
      count && (count.textContent = '(' + list.length + ')');
      if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
      empty.hidden = true;
      grid.innerHTML = '<div class="od-skel od-skel--card"></div>'.repeat(Math.min(list.length, 6));
      const products = await Promise.all(list.map((i) => fetch(OD.rootUrl + 'products/' + i.handle + '.js').then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      grid.innerHTML = products.filter(Boolean).map((p) => cardHTML({ id: p.id, handle: p.handle, title: p.title, vendor: p.vendor, url: OD.rootUrl + 'products/' + p.handle, featured_image: p.featured_image, price: p.price, options: p.options })).join('');
      wlPaint(grid);
    };
    on(document, 'od:wishlist', render);
    render();
  }

  /* ---------- misc: FAQ search + category tabs, brands A-Z, contact counter, textarea counter ---------- */
  function initMisc() {
    // character counter
    $$('[data-char-counter]').forEach((ta) => {
      const out = $(ta.getAttribute('data-char-counter'));
      const max = ta.maxLength || 200;
      const upd = () => out && (out.textContent = out.getAttribute('data-template').replace('{n}', ta.value.length).replace('{max}', max));
      on(ta, 'input', upd); upd();
    });
    // FAQ
    const faq = $('[data-faq]');
    if (faq) {
      const cards = $$('[data-faq-cat]', faq);
      const groups = $$('[data-faq-group]', faq);
      const search = $('[data-faq-search]', faq);
      const show = (cat) => {
        cards.forEach((c) => c.classList.toggle('_selected_1seg6_37', c.getAttribute('data-faq-cat') === cat));
        cards.forEach((c) => c.classList.toggle('undefined', c.getAttribute('data-faq-cat') !== cat));
        groups.forEach((g) => (g.hidden = g.getAttribute('data-faq-group') !== cat));
        const lbl = $('[data-faq-select] [data-select-label]', faq); if (lbl) { const c = cards.find((x) => x.getAttribute('data-faq-cat') === cat); lbl.textContent = c ? c.textContent.trim() : cat; }
      };
      cards.forEach((c) => on(c, 'click', () => show(c.getAttribute('data-faq-cat'))));
      on($('[data-faq-select]', faq), 'od:select', (e) => show(e.detail.value));
      on(search, 'input', () => {
        const q = search.value.trim().toLowerCase();
        $$('[data-faq-item]', faq).forEach((it) => (it.hidden = q && !it.textContent.toLowerCase().includes(q)));
        groups.forEach((g) => { if (q) g.hidden = !$$('[data-faq-item]:not([hidden])', g).length; });
        if (!q) show(cards.find((c) => c.classList.contains('_selected_1seg6_37')).getAttribute('data-faq-cat'));
      });
    }
    // brands A-Z
    const brands = $('[data-brands]');
    if (brands) {
      const letters = $$('[data-letter]', brands);
      const items = $$('[data-brand]', brands);
      const input = $('[data-brand-search]', brands);
      const clear = $('[data-brand-clear]', brands);
      const heading = $('[data-brands-heading]', brands);
      const apply = () => {
        const letter = (letters.find((l) => l.classList.contains('_active_omffk_73')) || {}).getAttribute ? letters.find((l) => l.classList.contains('_active_omffk_73')).getAttribute('data-letter') : 'all';
        const q = (input ? input.value : '').trim().toLowerCase();
        items.forEach((it) => {
          const name = it.textContent.trim();
          const first = name.charAt(0).toUpperCase();
          const okLetter = letter === 'all' || (letter === '0-9' ? /[0-9]/.test(first) : first === letter);
          it.hidden = !(okLetter && (!q || name.toLowerCase().includes(q)));
        });
        heading && (heading.textContent = letter === 'all' ? heading.getAttribute('data-all') : letter);
        clear && clear.style.setProperty('display', q ? '' : 'none', 'important');
      };
      letters.forEach((l) => on(l, 'click', () => { letters.forEach((x) => x.classList.toggle('_active_omffk_73', x === l)); apply(); }));
      on(input, 'input', apply); on(clear, 'click', () => { input.value = ''; apply(); });
      apply();
    }
    // login popover → Shopify login (new customer accounts show an email code screen)
    const lf = $('[data-login-form]');
    on(lf, 'submit', (e) => { e.preventDefault(); const em = $('[name=email]', lf).value; sessionStorage.setItem('od_login_email', em); window.location.href = OD.loginUrl; });
    // quantity steppers outside cart (generic)
    on(document, 'click', (e) => {
      const s = e.target.closest('[data-qty-step]'); if (!s) return;
      const input = $(s.getAttribute('data-qty-step')); if (!input) return;
      const n = Math.max(1, (parseInt(input.value, 10) || 1) + (s.getAttribute('data-dir') === '-' ? -1 : 1));
      input.value = n; input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ---------- shop the look drawer ---------- */
  on(document, 'click', async (e) => {
    const btn = e.target.closest('[data-stl-add]');
    if (!btn) return;
    const item = btn.closest('[data-stl-item]');
    const input = $('[data-stl-variant]', item);
    const id = input && input.value;
    if (!id) { item.classList.add('is-shake'); setTimeout(() => item.classList.remove('is-shake'), 1200); return; }
    setLoading(btn, true);
    try { await addToCart(id, 1); } catch (err) { toast(err.message, 'error'); }
    setLoading(btn, false);
  });
  on(document, 'od:select', (e) => {
    const item = e.target.closest && e.target.closest('[data-stl-item]');
    if (!item) return;
    const input = $('[data-stl-variant]', item);
    if (input) input.value = e.detail.value;
    const opt = $('[data-select-options] li[data-value="' + e.detail.value + '"]', item);
    const price = $('[data-stl-price]', item);
    if (opt && price && opt.getAttribute('data-price')) price.innerHTML = SAR + formatMoney(parseInt(opt.getAttribute('data-price'), 10));
    item.classList.remove('is-shake');
  });

  /* ---------- boot ---------- */
  OD.initSwipers = initSwipers;

  /* ---------- images fade in when loaded (site-wide, lazy images only) ---------- */
  function fadeImages(root) {
    $$('img[loading="lazy"]:not(.od-img):not([data-card-image-hover])', root || document).forEach((img) => {
      img.classList.add('od-img');
      const done = () => img.classList.add('is-loaded');
      if (img.complete && img.naturalWidth) done();
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
  }
  OD.fadeImages = fadeImages;

  function boot() {
    initHeader();
    initBackToTop();
    initSwipers(document);
    initSearch();
    initLocalization();
    initCollectionTools();
    initProduct();
    initRecommendations();
    initCartPage();
    initWishlistPage();
    initMisc();
    wlPaint(document);
    setCartCount(OD.cartCount || 0);
    fadeImages(document);
    if ('MutationObserver' in window) {
      let queued = false;
      new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fadeImages(document); }); }).observe(document.body, { childList: true, subtree: true });
    }
    // theme editor: re-init swipers when sections are (re)loaded
    document.addEventListener('shopify:section:load', (e) => { initSwipers(e.target); fadeImages(e.target); OD.initCards && OD.initCards(e.target); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
