/* od-card: product card behaviour (image carousel with round arrows + dots, colour dots)
   and the shared quick-add drawer (desktop side drawer / mobile bottom sheet,
   snippets/quick-add-drawer.liquid). Also a JS card renderer (OD.cardHTML) for
   search / wishlist / cart-trending cards. Loaded after theme.js (window.OD available). */
(function () {
  'use strict';
  const OD = window.OD || (window.OD = {});
  const $ = OD.$ || ((s, c) => (c || document).querySelector(s));
  const $$ = OD.$$ || ((s, c) => Array.from((c || document).querySelectorAll(s)));
  const on = OD.on || ((el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt));
  const SWATCH_SEL = '_swatchSelected_13l1w_301';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (cents) => (OD.SAR || '') + (OD.formatMoney ? OD.formatMoney(cents) : String(cents / 100));
  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  /* ---------- per-card state ---------- */
  function state(card) {
    if (card._od) return card._od;
    let data = { options: [], color: '', single: true, images: [], variants: [] };
    const json = $('[data-card-json]', card);
    if (json) { try { data = Object.assign(data, JSON.parse(json.textContent)); } catch (e) { /* keep defaults */ } }
    data.images = (data.images || []).map((i) => (typeof i === 'string' ? { src: i, alt: '' } : i));
    const img = $('[data-card-image]', card);
    if (!data.images.length && img) data.images = [{ src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' }];
    let colorIndex = parseInt(card.getAttribute('data-color-index') || '-1', 10); // 1-based, 0 = no colour option
    let color = card.getAttribute('data-color-value') || '';
    if (colorIndex < 0) { // element without the card attributes (e.g. cart "Trending now"): derive from the JSON
      colorIndex = 0;
      (data.options || []).forEach((o, i) => { if (o && o.name === data.color) { colorIndex = i + 1; color = (o.values && o.values[0]) || ''; } });
    }
    const s = { data, index: 0, colorIndex, color };
    card._od = s;
    return s;
  }
  const optVal = (v, i) => v['option' + i];

  /* ---------- card images ---------- */
  function showImage(card, i) {
    const s = state(card);
    const n = s.data.images.length;
    if (!n) return;
    s.index = ((i % n) + n) % n;
    const img = $('[data-card-image]', card);
    const src = s.data.images[s.index].src;
    if (img && img.getAttribute('src') !== src) { img.removeAttribute('srcset'); img.src = src; }
    paintDots(card);
  }
  function paintDots(card, forced) {
    const s = state(card);
    const idx = typeof forced === 'number' ? forced : s.index;
    $$('[data-card-dots] > span', card).forEach((d, i) => d.classList.toggle('is-active', i === idx));
  }
  function syncIndexToSrc(card, src) {
    const s = state(card);
    const i = src ? s.data.images.findIndex((x) => x.src === src) : -1;
    if (i >= 0) { s.index = i; paintDots(card); }
  }
  function setColor(card, value) {
    const s = state(card);
    if (value) s.color = value;
    card.setAttribute('data-color-value', s.color);
  }

  /* =====================================================================
     Quick-add drawer (shared)
     ===================================================================== */
  const qa = $('[data-quick-add]');
  const Q = {
    card: null, s: null, variantId: null, color: '', swiper: null, dragY: null,
    t(name) { return qa ? (qa.getAttribute('data-t-' + name) || '') : ''; }
  };

  function variantsForColor() {
    const s = Q.s;
    if (!s.colorIndex || !Q.color) return s.data.variants;
    return s.data.variants.filter((v) => optVal(v, s.colorIndex) === Q.color);
  }
  function sizeLabel(v) {
    const parts = [];
    for (let i = 1; i <= 3; i++) { const val = optVal(v, i); if (val != null && val !== '' && i !== Q.s.colorIndex) parts.push(val); }
    return parts.join(' / ') || v.title;
  }
  function currentVariant() {
    return Q.s.data.variants.find((v) => String(v.id) === String(Q.variantId)) || null;
  }

  function buildGallery() {
    const wrap = $('[data-qa-slides]', qa);
    if (!wrap) return;
    const s = Q.s;
    let images = s.data.images.slice();
    // selected colour's image first
    if (s.colorIndex && Q.color) {
      const v = s.data.variants.find((x) => optVal(x, s.colorIndex) === Q.color && x.image);
      if (v) { const i = images.findIndex((im) => im.src === v.image); if (i > 0) images.unshift(images.splice(i, 1)[0]); else if (i < 0) images.unshift({ src: v.image, alt: s.data.title }); }
    }
    wrap.innerHTML = images.map((im) => '<div class="swiper-slide od-qa__slide"><a href="' + esc(s.data.url) + '"><img src="' + esc(im.src) + '" alt="' + esc(im.alt || s.data.title) + '" loading="lazy"></a></div>').join('');
    const gallery = $('[data-qa-gallery]', qa);
    gallery.classList.toggle('is-single', images.length < 2);
    if (Q.swiper) { try { Q.swiper.destroy(true, false); } catch (e) { /* noop */ } Q.swiper = null; }
    const el = $('[data-qa-swiper]', qa);
    if (window.Swiper && el && images.length > 1) {
      Q.swiper = new window.Swiper(el, {
        slidesPerView: 2, spaceBetween: 2, watchOverflow: true,
        navigation: { nextEl: $('[data-qa-next]', qa), prevEl: $('[data-qa-prev]', qa) },
        pagination: { el: $('[data-qa-pagination]', qa), clickable: true, bulletClass: 'od-qa__bullet', bulletActiveClass: 'is-active' }
      });
    }
  }

  function buildColours() {
    const box = $('[data-qa-colours]', qa);
    const s = Q.s;
    const opt = s.colorIndex ? s.data.options[s.colorIndex - 1] : null;
    if (!box) return;
    if (!opt || !opt.values || !opt.values.length) { box.hidden = true; return; }
    box.hidden = false;
    $('[data-qa-colour-label]', qa).textContent = Q.t('colour').replace('__NAME__', Q.color);
    $('[data-qa-swatches]', qa).innerHTML = opt.values.map((v) => '<button type="button" class="od-qa__swatch' + (v === Q.color ? ' is-selected' : '') + '" data-qa-swatch="' + esc(v) + '" title="' + esc(v) + '" aria-label="' + esc(v) + '" aria-pressed="' + (v === Q.color) + '" style="background: ' + esc(OD.swatchColor ? OD.swatchColor(v, Q.s && Q.s.data && Q.s.data.swatches) : String(v).toLowerCase()) + ';"></button>').join('');
  }

  function buildSizes() {
    const wrap = $('[data-qa-sizes-wrap]', qa);
    const grid = $('[data-qa-sizes]', qa);
    const note = $('[data-qa-note]', qa);
    const s = Q.s;
    Q.variantId = null;
    if (note) { note.textContent = ''; note.classList.remove('is-error'); }
    if (s.data.single || !grid) {
      if (wrap) wrap.hidden = true;
      const v = s.data.variants.find((x) => x.available) || s.data.variants[0];
      Q.variantId = v ? v.id : null;
      paintPrice();
      return;
    }
    wrap.hidden = false;
    const list = variantsForColor();
    grid.innerHTML = list.map((v) => {
      const label = sizeLabel(v);
      return '<button type="button" class="od-qa__size' + (v.available ? '' : ' is-soldout') + (label.length > 4 ? ' is-wide' : '') + '" data-qa-size data-variant-id="' + v.id + '" aria-pressed="false"' + (v.available ? '' : ' aria-disabled="true"') + ' title="' + esc(v.title) + (v.available ? '' : ' - ' + esc(Q.t('sold-out'))) + '">' + esc(label) + '</button>';
    }).join('');
    const first = list.find((v) => v.available);
    if (first) selectSize($('[data-qa-size][data-variant-id="' + first.id + '"]', grid));
    else paintPrice();
  }
  function selectSize(btn) {
    if (!btn || btn.classList.contains('is-soldout')) return;
    $$('[data-qa-size]', qa).forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('is-selected'); btn.setAttribute('aria-pressed', 'true');
    Q.variantId = btn.getAttribute('data-variant-id');
    const note = $('[data-qa-note]', qa);
    const v = currentVariant();
    if (note) {
      note.classList.remove('is-error');
      note.textContent = (v && v.tracked && v.qty > 0 && v.qty < 5) ? Q.t('low') : '';
    }
    paintPrice();
  }
  function paintPrice() {
    const v = currentVariant();
    const price = v ? v.price : Q.s.data.price;
    const p = $('[data-qa-price]', qa);
    const ap = $('[data-qa-atc-price]', qa);
    const compare = v ? v.compare_at_price : Q.s.data.compare_at_price;
    if (p) p.innerHTML = money(price) + (compare && compare > price ? ' <s>' + money(compare) + '</s>' : '');
    if (ap) ap.innerHTML = money(price);
    const atc = $('[data-qa-atc]', qa);
    const label = $('[data-qa-atc-label]', qa);
    const soldOut = v ? !v.available : false;
    if (atc) atc.classList.toggle('is-soldout', soldOut);
    if (label) label.textContent = soldOut ? Q.t('sold-out') : Q.t('add');
  }

  function setDetails(open) {
    const box = $('[data-qa-details]', qa);
    const btn = $('[data-qa-more]', qa);
    if (!box || !btn) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? Q.t('less') : Q.t('more');
    if (open) {
      box.style.height = box.scrollHeight + 'px';
      box.setAttribute('data-open', '');
      const done = () => { if (box.hasAttribute('data-open')) box.style.height = 'auto'; box.removeEventListener('transitionend', done); };
      box.addEventListener('transitionend', done);
      qa.classList.add('is-expanded');
    } else {
      box.style.height = box.scrollHeight + 'px';
      box.removeAttribute('data-open');
      requestAnimationFrame(() => { box.style.height = '0px'; });
      qa.classList.remove('is-expanded');
    }
  }

  function fill(card) {
    const s = state(card);
    Q.card = card; Q.s = s; Q.color = s.color;
    const d = s.data;
    const title = $('[data-qa-title]', qa);
    if (title) { title.textContent = d.title || ''; title.href = d.url || '#'; }
    const brand = $('[data-qa-brand]', qa);
    if (brand) { brand.textContent = d.vendor || ''; brand.href = d.vendor && OD.vendorUrl ? OD.vendorUrl(d.vendor) : '#'; brand.hidden = !d.vendor; }
    const desc = $('[data-qa-description]', qa);
    if (desc) desc.textContent = d.description || '';
    const rm = $('[data-qa-read-more]', qa);
    if (rm) rm.href = d.url || '#';
    const bb = $('[data-qa-badges]', qa);
    if (bb) bb.innerHTML = OD.badgeHTML ? OD.badgeHTML(d.badges || []) : '';
    const matAcc = $('[data-qa-material-acc]', qa);
    const mat = $('[data-qa-material]', qa);
    if (matAcc) { matAcc.hidden = !d.material; if (mat) mat.textContent = d.material || ''; }
    // reset details + accordions
    const box = $('[data-qa-details]', qa);
    const more = $('[data-qa-more]', qa);
    if (box) { box.style.height = '0px'; box.removeAttribute('data-open'); }
    if (more) { more.setAttribute('aria-expanded', 'false'); more.textContent = Q.t('more'); }
    qa.classList.remove('is-expanded');
    const body = $('[data-qa-body]', qa);
    if (body) body.scrollTop = 0;
    buildGallery();
    buildColours();
    buildSizes();
  }

  function openQuickAdd(card) {
    if (!qa) return;
    fill(card);
    qa.classList.toggle('od-qa--sheet', isMobile());
    if (OD.openModal) OD.openModal('quick-add');
    setTimeout(() => { if (Q.swiper) Q.swiper.update(); }, 500);
  }
  function closeQuickAdd() { if (OD.closeModal) OD.closeModal('quick-add'); }

  async function addFromDrawer(btn) {
    let id = Q.variantId;
    if (!id) {
      const note = $('[data-qa-note]', qa);
      if (note) { note.textContent = Q.t('select-size'); note.classList.add('is-error'); }
      return;
    }
    const v = currentVariant();
    if (v && !v.available) return;
    OD.setLoading ? OD.setLoading(btn, true) : (btn.disabled = true);
    try {
      if (OD.addToCart) await OD.addToCart(id, 1); // the cart drawer opens on od:cart:add and closes this one
      if (OD.openModals && OD.openModals.has('quick-add')) closeQuickAdd();
    } catch (err) {
      OD.toast && OD.toast(err.message || (OD.t && OD.t.cartError) || 'Error', 'error');
    }
    OD.setLoading ? OD.setLoading(btn, false) : (btn.disabled = false);
  }

  /* ---------- drawer events ---------- */
  if (qa) {
    on(qa, 'click', (e) => {
      const t = e.target;
      const size = t.closest('[data-qa-size]');
      if (size) { e.preventDefault(); selectSize(size); return; }
      const sw = t.closest('[data-qa-swatch]');
      if (sw) {
        e.preventDefault();
        Q.color = sw.getAttribute('data-qa-swatch');
        $$('[data-qa-swatch]', qa).forEach((b) => { const sel = b === sw; b.classList.toggle('is-selected', sel); b.setAttribute('aria-pressed', String(sel)); });
        $('[data-qa-colour-label]', qa).textContent = Q.t('colour').replace('__NAME__', Q.color);
        buildGallery(); buildSizes();
        // mirror on the card
        if (Q.card) { const main = $$('[data-card-swatch]', Q.card).find((b) => (b.getAttribute('data-value') || b.title) === Q.color); if (main) main.click(); }
        return;
      }
      const atc = t.closest('[data-qa-atc]');
      if (atc) { e.preventDefault(); addFromDrawer(atc); return; }
      const more = t.closest('[data-qa-more]');
      if (more) { e.preventDefault(); setDetails(more.getAttribute('aria-expanded') !== 'true'); return; }
      const acc = t.closest('[data-accordion-toggle]');
      if (acc) { const box = $('[data-qa-details]', qa); if (box && box.hasAttribute('data-open')) box.style.height = 'auto'; }
    });
    // bottom sheet: drag down on the header to close
    const head = $('[data-qa-head]', qa);
    const handle = $('[data-qa-handle]', qa);
    [head, handle].forEach((el) => {
      if (!el) return;
      on(el, 'touchstart', (e) => { Q.dragY = e.touches[0].clientY; qa.style.transition = 'none'; }, { passive: true });
      on(el, 'touchmove', (e) => {
        if (Q.dragY == null || !qa.classList.contains('od-qa--sheet')) return;
        const dy = Math.max(0, e.touches[0].clientY - Q.dragY);
        qa.style.transform = 'translateY(' + dy + 'px)';
      }, { passive: true });
      on(el, 'touchend', (e) => {
        if (Q.dragY == null) return;
        const dy = (e.changedTouches[0].clientY - Q.dragY);
        qa.style.transition = ''; qa.style.transform = '';
        Q.dragY = null;
        if (dy > 80) closeQuickAdd();
      });
    });
    on(document, 'od:modal:open', (e) => { if (e.detail && e.detail.name !== 'quick-add' && OD.openModals && OD.openModals.has('quick-add')) closeQuickAdd(); });
    on(window, 'resize', () => { if (OD.openModals && OD.openModals.has('quick-add')) qa.classList.toggle('od-qa--sheet', isMobile()); });
  }

  /* ---------- desktop hover image swap (Net-a-Porter): crossfade to image 2, back on leave ---------- */
  const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function hoverImg(card) {
    let h = $('[data-card-image-hover]', card);
    const s = state(card);
    if (!h && s.data.images.length > 1) {
      h = document.createElement('img');
      h.className = 'od-card__img od-card__img--hover';
      h.alt = ''; h.setAttribute('aria-hidden', 'true'); h.setAttribute('data-card-image-hover', '');
      h.src = s.data.images[1].src;
      const link = $('[data-card-image-link]', card);
      (link || $('.od-card__media', card) || card).appendChild(h);
    }
    return h;
  }
  on(document, 'mouseover', (e) => {
    if (!canHover()) return;
    const media = e.target.closest && e.target.closest('.od-card__media');
    if (!media || media._odHover) return;
    const card = media.closest('[data-od-card]');
    if (!card) return;
    media._odHover = true;
    const s = state(card);
    s.pinned = false;
    if (s.index === 0 && s.data.images.length > 1) {
      const h = hoverImg(card);
      if (h) { const show = () => { if (media._odHover && !s.pinned) { h.classList.add('is-on'); s.hovering = true; paintDots(card, 1); } }; if (h.complete) show(); else h.addEventListener('load', show, { once: true }); }
    }
  });
  on(document, 'mouseout', (e) => {
    const media = e.target.closest && e.target.closest('.od-card__media');
    if (!media || !media._odHover) return;
    if (e.relatedTarget && media.contains(e.relatedTarget)) return;
    media._odHover = false;
    const card = media.closest('[data-od-card]');
    if (!card) return;
    const s = state(card);
    const h = $('[data-card-image-hover]', card);
    if (h) h.classList.remove('is-on');
    s.hovering = false;
    if (s.pinned) { s.pinned = false; showImage(card, 0); } else paintDots(card);
  });
  function pin(card) { const s = state(card); s.pinned = true; s.hovering = false; const h = $('[data-card-image-hover]', card); if (h) h.classList.remove('is-on'); }

  /* adding to cart from the wishlist drawer: close the wishlist so the cart drawer is visible */
  on(document, 'od:cart:add', () => { if (OD.openModals && OD.openModals.has('wishlist') && OD.closeModal) OD.closeModal('wishlist'); });

  /* ---------- card events ---------- */
  on(document, 'click', (e) => {
    const opener = e.target.closest('[data-quick-add-open]');
    if (opener) {
      const src = opener.closest('[data-qa-source]') || opener.closest('[data-od-card]');
      if (src && $('[data-card-json]', src)) { e.preventDefault(); e.stopPropagation(); openQuickAdd(src); return; }
    }
    const card = e.target.closest('[data-od-card]');
    if (!card) return;
    const t = e.target;
    /* arrows count from the image the eye sees: while the hover swap shows image 2, "next" goes to image 3 */
    const seen = (c) => { const s = state(c); return s.hovering && s.index === 0 ? 1 : s.index; };
    if (t.closest('[data-card-prev]')) { e.preventDefault(); e.stopPropagation(); const i = seen(card) - 1; pin(card); showImage(card, i); return; }
    if (t.closest('[data-card-next]')) { e.preventDefault(); e.stopPropagation(); const i = seen(card) + 1; pin(card); showImage(card, i); return; }
    if (t.closest('[data-card-quickadd]')) { e.preventDefault(); e.stopPropagation(); openQuickAdd(card); return; }
    const sw = t.closest('[data-card-swatch]');
    if (sw) { pin(card); setColor(card, sw.getAttribute('data-value') || sw.title); syncIndexToSrc(card, sw.getAttribute('data-image')); } // theme.js already swapped the image
  });

  function init(root) {
    $$('[data-od-card]', root || document).forEach((card) => { state(card); paintDots(card); });
  }
  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', () => init()); else init();
  OD.initCards = init;
  OD.openQuickAdd = openQuickAdd;

  /* ---------- JSON blob for JS-rendered cards (from /products/{handle}.js) so the quick-add works there too ---------- */
  function jsonFromProduct(p) {
    if (!p || !Array.isArray(p.variants)) return '';
    const colorName = OD.colorOptionName || 'Color';
    const opts = (p.options || []).map((o) => (typeof o === 'string' ? { name: o, values: [] } : { name: o.name, values: o.values || [] }));
    opts.forEach((o, i) => { if (!o.values.length) o.values = Array.from(new Set(p.variants.map((v) => v['option' + (i + 1)]).filter(Boolean))); });
    const single = p.variants.length === 1 && /default title/i.test(p.variants[0].title || '');
    const data = {
      title: p.title, url: p.url || ((OD.rootUrl || '/') + 'products/' + p.handle), vendor: p.vendor || '', price: p.price, compare_at_price: p.compare_at_price || null,
      options: opts, color: colorName, single,
      images: (p.images || []).slice(0, 6).map((src) => ({ src: typeof src === 'string' ? src : (src.src || ''), alt: p.title })),
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, option1: v.option1, option2: v.option2, option3: v.option3, available: !!v.available, price: v.price, compare_at_price: v.compare_at_price || null, image: v.featured_image ? (v.featured_image.src || v.featured_image) : null, qty: 0, tracked: false })),
      description: String(p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
      material: null,
      badges: OD.badgesFor ? OD.badgesFor(p, 2) : [],
      available: p.variants.some((v) => v.available)
    };
    return '<script type="application/json" data-card-json>' + JSON.stringify(data).replace(/<\//g, '<\\/') + '</script>';
  }

  /* ---------- badges for JS-rendered cards (same rules as snippets/product-badges.liquid, from /products/{handle}.js) ---------- */
  const BAG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  OD.badgesFor = function (p, limit) {
    const cfg = OD.badges; limit = limit || 2;
    if (!cfg || !p) return [];
    if (Array.isArray(p.badges)) return p.badges.slice(0, limit);
    const out = [];
    const tags = (p.tags || []).map((t) => String(t).toLowerCase().trim());
    const hay = '|' + tags.join('|') + '|';
    const price = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
    const cmp = typeof p.compare_at_price === 'number' ? p.compare_at_price : parseFloat(p.compare_at_price) || 0;
    (cfg.rules || []).forEach((r) => {
      if (out.length >= limit || !r || r.type === 'none') return;
      let hit = false, label = r.label;
      if (r.type === 'tags') hit = String(r.match || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean).some((x) => hay.indexOf('|' + x + '|') > -1);
      else if (r.type === 'new' && p.published_at) hit = (Date.now() - new Date(p.published_at).getTime()) / 864e5 <= (cfg.newDays || 30);
      else if (r.type === 'sale' && cmp > price) { hit = true; if (cfg.saleStyle === 'percent') label = '-' + Math.round((cmp - price) * 100 / cmp) + '%'; }
      if (hit && label) out.push({ label, bg: r.bg, text: r.text });
    });
    return out;
  };
  OD.badgeHTML = function (list) {
    return (list || []).map((b) => '<span class="od-card__badge" style="background-color:' + esc(b.bg || '#551c25') + ';color:' + esc(b.text || '#fff') + ';">' + esc(b.label) + '</span>').join('');
  };

  /* ---------- JS-rendered cards (search overlay, wishlist page + drawer, cart trending) ---------- */
  OD.cardHTML = function (p) {
    const img = p.featured_image || (p.image && p.image.src) || p.image || (OD.assets && OD.assets.fallback) || '';
    const price = p.price != null ? (typeof p.price === 'number' ? (OD.formatMoney ? OD.formatMoney(p.price) : String(p.price / 100)) : String(p.price).replace(/[^\d.,]/g, '')) : '';
    const url = p.url || ((OD.rootUrl || '/') + 'products/' + p.handle);
    const color = p.options ? p.options.find((o) => /colou?r|لون/i.test((o && o.name) || o)) : null;
    const values = color && color.values ? color.values : [];
    const swatches = values.map((v, i) => '<button type="button" title="' + esc(v) + '" aria-label="' + esc(v) + '" aria-pressed="' + (i === 0) + '" class="_swatch_13l1w_280 od-card__dot ' + (i === 0 ? SWATCH_SEL : '') + ' " style="background: ' + esc(OD.swatchColor ? OD.swatchColor(v, p.swatches) : String(v).toLowerCase()) + ';" data-card-swatch data-value="' + esc(v) + '"></button>').join('');
    const json = jsonFromProduct(p);
    const available = Array.isArray(p.variants) ? p.variants.some((v) => v.available) : !!p.available;
    const badges = available ? OD.badgeHTML(OD.badgesFor(p, 2)) : '';
    const soldOut = !available && OD.badges && OD.badges.soldOut !== false ? '<span class="od-card__soldout">' + esc((OD.badges && OD.badges.soldOutLabel) || 'Sold out') + '</span>' : '';
    return '<div class="_new_in_trend_card_13l1w_130 od-card' + (OD.rtl ? ' od-card--rtl' : '') + (available ? '' : ' is-sold-out') + '" data-product-card' + (json ? ' data-od-card' : '') + ' data-handle="' + esc(p.handle) + '" data-product-id="' + esc(p.id) + '">' +
      '<div class="od-card__media">' +
      '<a href="' + esc(url) + '" class="od-card__link" data-card-image-link aria-label="' + esc(p.title) + '"><img class="od-card__img" alt="' + esc(p.title) + '" src="' + esc(img) + '" loading="lazy" data-card-image></a>' +
      '<div class="od-card__top"><div class="od-card__top-start" data-card-badges>' + badges + '</div><div class="od-card__top-end"><div class="_globalImg_1tf1q_38 _wishlistIcon_13l1w_356 od-card__wish" data-wishlist-toggle data-wishlist-handle="' + esc(p.handle) + '" data-wishlist-id="' + esc(p.id) + '" role="button" tabindex="0"><img alt="" src="' + ((OD.assets && OD.assets.wishlist) || '') + '"></div></div></div>' +
      (json && available ? '<button type="button" class="od-card__plus" data-card-quickadd aria-haspopup="dialog" aria-label="' + esc((qa && qa.getAttribute('aria-label')) || 'Quick add') + '">' + BAG_ICON + '</button>' : soldOut) +
      '</div>' +
      '<div class="od-card__body">' +
      (p.vendor ? '<p class="od-card__brand"><a class="od-brand-link" href="' + OD.vendorUrl(p.vendor) + '">' + esc(p.vendor) + '</a></p>' : '') +
      '<div class="od-card__row"><p class="od-card__name"><a href="' + esc(url) + '">' + esc(p.title) + '</a></p>' +
      '<div class="od-card__prices"><p class="od-card__price">' + (OD.SAR || '') + price + '</p></div></div>' +
      (swatches ? '<div class="od-card__colours"><div class="' + (OD.rtl ? '_new_in_trend_card__colorsRtl_13l1w_139' : '_new_in_trend_card__colorsLtr_13l1w_139') + ' od-card__swatches">' + swatches + '</div></div>' : '') +
      '</div>' + json + '</div>';
  };

  /* =====================================================================
     Wishlist drawer (header heart / side menu "My Wishlist")
     ===================================================================== */
  const wl = $('[data-wishlist-drawer]');
  const productCache = {};
  async function fetchProduct(handle) {
    if (productCache[handle]) return productCache[handle];
    try {
      const r = await fetch((OD.rootUrl || '/') + 'products/' + handle + '.js', { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const p = await r.json();
      productCache[handle] = p;
      return p;
    } catch (e) { return null; }
  }
  let wlRendering = null;
  async function renderWishlist() {
    if (!wl || !OD.wlGet) return;
    const grid = $('[data-wl-grid]', wl), empty = $('[data-wl-empty]', wl), count = $('[data-wl-count]', wl);
    const list = OD.wlGet().slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    if (count) count.textContent = '(' + list.length + ')';
    if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    // keep cards that are still wished; only fetch the new ones
    const have = {};
    $$('[data-product-card]', grid).forEach((c) => { const h = c.getAttribute('data-handle'); if (list.some((i) => i.handle === h)) have[h] = c; else c.remove(); });
    const missing = list.filter((i) => !have[i.handle]);
    if (!missing.length) return;
    missing.forEach(() => { const sk = document.createElement('div'); sk.className = 'od-skel od-skel--card'; sk.setAttribute('data-wl-skel', ''); grid.appendChild(sk); });
    const token = wlRendering = {};
    const products = await Promise.all(missing.map((i) => fetchProduct(i.handle)));
    if (token !== wlRendering) return;
    $$('[data-wl-skel]', grid).forEach((s) => s.remove());
    const frag = document.createElement('div');
    frag.innerHTML = products.filter(Boolean).map((p) => OD.cardHTML(Object.assign({}, p, { url: (OD.rootUrl || '/') + 'products/' + p.handle }))).join('');
    // newest first
    Array.from(frag.children).reverse().forEach((c) => grid.insertBefore(c, grid.firstChild));
    OD.wlPaint && OD.wlPaint(grid);
    init(grid);
  }
  function openWishlist(fromMenu) {
    if (!wl) return;
    wl.classList.toggle('od-wl--from-menu', !!fromMenu);
    if (OD.openModals && OD.openModals.has('menu') && OD.closeModal) OD.closeModal('menu');
    renderWishlist();
    OD.openModal && OD.openModal('wishlist');
  }
  if (wl) {
    on(document, 'click', (e) => {
      const o = e.target.closest('[data-open-wishlist]');
      if (o) { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); openWishlist(o.hasAttribute('data-wl-from-menu')); return; }
      const back = e.target.closest('[data-wl-back]');
      if (back) { e.preventDefault(); OD.closeModal('wishlist'); if (wl.classList.contains('od-wl--from-menu') && OD.openModal) setTimeout(() => OD.openModal('menu'), 50); }
    }, true);
    on(document, 'od:wishlist', () => { if (OD.openModals && OD.openModals.has('wishlist')) renderWishlist(); });
    on(document, 'od:modal:open', (e) => { if (e.detail && e.detail.name === 'wishlist') renderWishlist(); });
  }
  OD.openWishlist = openWishlist;
})();
