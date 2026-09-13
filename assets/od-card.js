/* od-card: product card behaviour (image carousel with round arrows + dots, colour dots)
   and the shared quick-add drawer (desktop side drawer / mobile bottom sheet,
   snippets/quick-add-drawer.liquid). Also a JS card renderer (OD.cardHTML / OD.cardsHTML) for
   search / wishlist / cart-trending cards. Loaded after theme.js (window.OD available).
   Round 9: one card per colour (OD.cardPerColour), photos per colour on cards and in the quick view
   (same rule as the product page: variant image, else alt text = colour or "colour - ...", no match = shared photo). */
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
  const MAX_IMAGES = 6;
  const isColourName = (name) => { const n = String(name || '').trim().toLowerCase(); return n === String(OD.colorOptionName || 'Color').trim().toLowerCase() || /^(colou?r|اللون|لون)$/.test(n); };
  const optVal = (v, i) => v['option' + i];
  /* alt text -> colour (product page rule): equals the colour, or starts with the colour + separator (space - | : ,) */
  const altColour = (alt, values) => {
    const a = String(alt || '').trim().toLowerCase();
    if (!a) return null;
    return values.find((c) => { const cl = String(c).trim().toLowerCase(); return cl && (a === cl || (a.indexOf(cl) === 0 && /^[\s\-|:,]/.test(a.slice(cl.length)))); }) || null;
  };

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
      (data.options || []).forEach((o, i) => { if (o && (o.name === data.color || isColourName(o.name)) && colorIndex === 0) { colorIndex = i + 1; color = (o.values && o.values[0]) || ''; } });
    }
    const s = { data, index: 0, colorIndex, color, perColour: !!data.colour };
    card._od = s;
    // a per-colour card (or one with the media list) shows that colour's photos
    if (data.colour && data.media && data.media.length) s.data.images = imagesFor(s, data.colour);
    return s;
  }
  /* variants of a colour, the colour's variant image (media id), the photos of a colour */
  const variantsOf = (s, colour) => (s.colorIndex && colour ? s.data.variants.filter((v) => optVal(v, s.colorIndex) === colour) : s.data.variants);
  const linkVariant = (s, colour) => { const list = variantsOf(s, colour); return list.find((v) => v.available) || list[0] || null; };
  const variantMediaId = (s, colour) => { const v = variantsOf(s, colour).find((x) => x.media_id != null); return v ? v.media_id : null; };
  function imagesFor(s, colour) {
    const M = s.data.media;
    if (!M || !M.length || !s.colorIndex || !colour) return s.data.images;
    const vm = variantMediaId(s, colour);
    let list = [];
    if (vm != null) { const m = M.find((x) => String(x.id) === String(vm)); if (m) list.push(m); else { const v = variantsOf(s, colour).find((x) => x.image); if (v) list.push({ id: vm, src: v.image, alt: '', colour }); } }
    list = list.concat(M.filter((m) => m.colour === colour && String(m.id) !== String(vm)), M.filter((m) => !m.colour));
    if (!list.length) list = M.slice();
    return list.slice(0, MAX_IMAGES).map((m) => ({ id: m.id, src: m.src, alt: m.alt || s.data.title || '', colour: m.colour || null }));
  }

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
  function rebuildDots(card) {
    const s = state(card);
    const n = s.data.images.length;
    const dots = $('[data-card-dots]', card);
    if (dots) { dots.innerHTML = Array.from({ length: n }, (_, i) => '<span' + (i === s.index ? ' class="is-active"' : '') + '></span>').join(''); dots.hidden = n < 2; }
    $$('[data-card-prev], [data-card-next]', card).forEach((b) => { b.hidden = n < 2; });
  }
  /* colour dot clicked (round 9): swap the photos inside the card to that colour, its link / quick view preselect the
     colour's variant, sold-out state and price follow the colour */
  function setColor(card, value) {
    const s = state(card);
    if (value) s.color = value;
    card.setAttribute('data-color-value', s.color);
    if (!s.colorIndex || !s.color) return;
    const hasMedia = !!(s.data.media && s.data.media.length);
    if (hasMedia) {
      s.data.images = imagesFor(s, s.color);
      s.index = 0;
      const img = $('[data-card-image]', card);
      const first = s.data.images[0];
      if (img && first && img.getAttribute('src') !== first.src) { img.removeAttribute('srcset'); img.src = first.src; }
      const h = $('[data-card-image-hover]', card);
      if (h) { h.classList.remove('is-on'); if (s.data.images[1]) h.src = s.data.images[1].src; else h.remove(); }
      rebuildDots(card);
    } else {
      // no media list: fall back to the colour's variant image
      const v = variantsOf(s, s.color).find((x) => x.image);
      const img = $('[data-card-image]', card);
      if (img && v) { img.removeAttribute('srcset'); img.src = v.image; }
    }
    const lv = linkVariant(s, s.color);
    $$('[data-card-image-link], [data-card-name-link]', card).forEach((a) => {
      const base = a.getAttribute('data-card-url') || (s.data.url || a.getAttribute('href') || '').split('?')[0];
      if (lv && base) a.setAttribute('href', base + '?variant=' + lv.id);
    });
    const available = variantsOf(s, s.color).some((v) => v.available);
    card.classList.toggle('is-sold-out', !available);
    const plus = $('[data-card-quickadd]', card), so = $('[data-card-soldout]', card);
    if (plus && so) { plus.hidden = !available; so.hidden = available; }
    const price = $('[data-card-price]', card), cmp = $('[data-card-compare]', card);
    if (price && lv && lv.price != null) { price.innerHTML = money(lv.price); price.classList.toggle('od-card__price--sale', !!(lv.compare_at_price && lv.compare_at_price > lv.price)); }
    if (cmp && lv) { const onSale = lv.compare_at_price && lv.compare_at_price > lv.price; cmp.hidden = !onSale; if (onSale) cmp.innerHTML = money(lv.compare_at_price); }
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

  /* quick view gallery (round 9): photos per colour like the product page, honouring OD.galleryColorMode
     filter = only that colour's photos (+ shared), sync = all photos, jump to the colour's first photo and the swatch follows
     the gallery, off = all photos, jump to the variant image only */
  function buildGallery() {
    const wrap = $('[data-qa-slides]', qa);
    if (!wrap) return;
    const s = Q.s;
    const M = s.data.media;
    const mode = OD.galleryColorMode || 'filter';
    let images, start = 0;
    if (M && M.length && s.colorIndex && Q.color) {
      if (mode === 'filter') images = imagesFor(s, Q.color);
      else {
        images = M.slice(0, 12);
        const vm = variantMediaId(s, Q.color);
        let i = vm != null ? images.findIndex((m) => String(m.id) === String(vm)) : -1;
        if (i < 0 && mode === 'sync') i = images.findIndex((m) => m.colour === Q.color);
        start = Math.max(0, i);
      }
    } else {
      images = s.data.images.slice();
      // selected colour's image first
      if (s.colorIndex && Q.color) {
        const v = s.data.variants.find((x) => optVal(x, s.colorIndex) === Q.color && x.image);
        if (v) { const i = images.findIndex((im) => im.src === v.image); if (i > 0) images.unshift(images.splice(i, 1)[0]); else if (i < 0) images.unshift({ src: v.image, alt: s.data.title }); }
      }
    }
    wrap.innerHTML = images.map((im) => '<div class="swiper-slide od-qa__slide" data-media-id="' + esc(im.id != null ? im.id : '') + '" data-colour="' + esc(im.colour || '') + '"><a href="' + esc(s.data.url) + '"><img src="' + esc(im.src) + '" alt="' + esc(im.alt || s.data.title) + '" loading="lazy"></a></div>').join('');
    const gallery = $('[data-qa-gallery]', qa);
    gallery.classList.toggle('is-single', images.length < 2);
    if (Q.swiper) { try { Q.swiper.destroy(true, false); } catch (e) { /* noop */ } Q.swiper = null; }
    const el = $('[data-qa-swiper]', qa);
    if (window.Swiper && el && images.length > 1) {
      Q.swiper = new window.Swiper(el, {
        slidesPerView: 2, spaceBetween: 2, watchOverflow: true, initialSlide: start,
        navigation: { nextEl: $('[data-qa-next]', qa), prevEl: $('[data-qa-prev]', qa) },
        pagination: { el: $('[data-qa-pagination]', qa), clickable: true, bulletClass: 'od-qa__bullet', bulletActiveClass: 'is-active' }
      });
      if (mode === 'sync' && M && M.length && s.colorIndex) {
        Q.swiper.on('slideChange', () => {
          const slide = $$('.swiper-slide', wrap)[Q.swiper.activeIndex];
          const c = slide && slide.getAttribute('data-colour');
          if (c && c !== Q.color) selectColour(c, true);
        });
      }
    }
  }
  function selectColour(value, fromGallery) {
    Q.color = value;
    $$('[data-qa-swatch]', qa).forEach((b) => { const sel = b.getAttribute('data-qa-swatch') === value; b.classList.toggle('is-selected', sel); b.setAttribute('aria-pressed', String(sel)); });
    const lbl = $('[data-qa-colour-label]', qa);
    if (lbl) lbl.textContent = Q.t('colour').replace('__NAME__', Q.color);
    if (!fromGallery) buildGallery();
    buildSizes();
    // mirror on the card (its photos, link and dot follow the colour)
    if (Q.card) { const main = $$('[data-card-swatch]', Q.card).find((b) => (b.getAttribute('data-value') || b.title) === Q.color); if (main && !main.classList.contains(SWATCH_SEL)) main.click(); }
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
      if (sw) { e.preventDefault(); selectColour(sw.getAttribute('data-qa-swatch'), false); return; }
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
    if (sw) { pin(card); setColor(card, sw.getAttribute('data-value') || sw.title); } // theme.js toggles the selected dot, od-card swaps the photos
  });

  function init(root) {
    $$('[data-od-card]', root || document).forEach((card) => { state(card); paintDots(card); });
  }
  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', () => init()); else init();
  OD.initCards = init;
  OD.openQuickAdd = openQuickAdd;

  /* ---------- JSON blob for JS-rendered cards (from /products/{handle}.js or the predictive search JSON) so the quick-add works there too ---------- */
  /* option value i (0-based) of a raw variant: option1..3, else options[], else the title "Red / M" (predictive search variants) */
  const variantOpt = (v, i) => { if (!v) return undefined; const d = v['option' + (i + 1)]; if (d != null) return d; if (v.options && v.options[i] != null) return v.options[i]; const t = String(v.title || ''); return t ? t.split(' / ')[i] : undefined; };
  const colourIndexOf = (p) => { const opts = p.options || []; let i = opts.findIndex((o) => isColourName(typeof o === 'string' ? o : (o && o.name))); if (i < 0) i = opts.findIndex((o) => (typeof o === 'string' ? o : (o && o.name)) === (OD.colorOptionName || 'Color')); return i; };
  function normOptions(p) {
    const opts = (p.options || []).map((o) => (typeof o === 'string' ? { name: o, values: [] } : { name: o.name, values: (o.values || []).slice() }));
    opts.forEach((o, i) => { if (!o.values.length && Array.isArray(p.variants)) o.values = Array.from(new Set(p.variants.map((v) => variantOpt(v, i)).filter(Boolean))); });
    return opts;
  }
  const mediaSrc = (m) => (m ? (m.src || (m.preview_image && m.preview_image.src) || (typeof m === 'string' ? m : '')) : '');
  /* media list with a colour per photo (variant image, else alt text rule); without a media list the variant images stand in */
  function normMedia(p, opts, ci) {
    const values = ci > -1 ? opts[ci].values : [];
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const vColour = (v) => (ci > -1 ? variantOpt(v, ci) : null);
    const list = [];
    if (Array.isArray(p.media) && p.media.length) {
      p.media.forEach((m) => {
        if (m.media_type && m.media_type !== 'image') return;
        const src = mediaSrc(m); if (!src) return;
        const byVariant = variants.find((v) => v.featured_media && String(v.featured_media.id) === String(m.id));
        list.push({ id: m.id, src, alt: m.alt || '', colour: byVariant ? vColour(byVariant) : altColour(m.alt, values) });
      });
    } else {
      const seen = {};
      variants.forEach((v) => {
        const fi = v.featured_image || v.featured_media || null;
        const src = fi ? (fi.src || (fi.preview_image && fi.preview_image.src) || (typeof fi === 'string' ? fi : '')) : '';
        if (!src || seen[src]) return;
        seen[src] = true;
        list.push({ id: (fi && fi.id) || 'v' + v.id, src, alt: (fi && fi.alt) || '', colour: vColour(v) });
      });
      const main = p.featured_image ? (p.featured_image.src || p.featured_image.url || (typeof p.featured_image === 'string' ? p.featured_image : '')) : '';
      if (main && !seen[main]) list.unshift({ id: 'main', src: main, alt: '', colour: null });
      (p.images || []).forEach((src, i) => { const u = typeof src === 'string' ? src : (src && src.src); if (u && !seen[u]) { seen[u] = true; list.push({ id: 'i' + i, src: u, alt: '', colour: null }); } });
    }
    return list.slice(0, 12);
  }
  /* prices: cents (products/{handle}.js) or "120.00" strings (predictive search) -> cents */
  const cents = (x) => (x == null || x === '' ? null : (typeof x === 'number' ? x : Math.round(parseFloat(String(x).replace(/[^\d.]/g, '')) * 100) || 0));
  function jsonFromProduct(p, colour, colourVariant) {
    if (!p || !Array.isArray(p.variants)) return '';
    const opts = normOptions(p);
    const ci = colourIndexOf(p);
    const colorName = ci > -1 ? opts[ci].name : (OD.colorOptionName || 'Color');
    const single = p.variants.length === 1 && /default title/i.test(p.variants[0].title || '');
    const media = normMedia(p, opts, ci);
    const data = {
      id: p.id, handle: p.handle, title: p.title, url: p.url || ((OD.rootUrl || '/') + 'products/' + p.handle), vendor: p.vendor || '', price: cents(p.price), compare_at_price: cents(p.compare_at_price),
      options: opts, color: colorName, colour: colour || null, colour_variant: colourVariant || null,
      images: (p.images && p.images.length ? p.images : media.map((m) => m.src)).slice(0, 6).map((src) => ({ src: typeof src === 'string' ? src : (src.src || ''), alt: p.title })),
      media,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, option1: variantOpt(v, 0), option2: variantOpt(v, 1), option3: variantOpt(v, 2), available: !!v.available, price: cents(v.price), compare_at_price: cents(v.compare_at_price), image: v.featured_image ? (v.featured_image.src || v.featured_image) : null, media_id: v.featured_media ? v.featured_media.id : (v.featured_image && v.featured_image.id ? v.featured_image.id : null), qty: 0, tracked: false })),
      description: String(p.description || p.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
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

  /* ---------- JS-rendered cards (search overlay, wishlist page + drawer, cart trending) ----------
     cardHTML(p, colour): one card; with a colour it is that colour's card (its photos, link ?variant=, sold-out state).
     cardsHTML(p): one card per colour when OD.cardPerColour is on (wishlist drawer keeps calling cardHTML: one per product). */
  const ARROW_PREV = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ARROW_NEXT = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  OD.cardHTML = function (p, colour) {
    const opts = normOptions(p);
    const ci = colourIndexOf(p);
    const values = ci > -1 ? opts[ci].values : [];
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const vColour = (v) => (ci > -1 ? variantOpt(v, ci) : null);
    if (colour && values.indexOf(colour) < 0) colour = null;
    const selected = colour || values[0] || '';
    const url = (p.url || ((OD.rootUrl || '/') + 'products/' + p.handle)).split('?')[0];
    let cardUrl = url, img = p.featured_image || (p.image && p.image.src) || p.image || (OD.assets && OD.assets.fallback) || '';
    if (img && typeof img === 'object') img = img.src || img.url || '';
    let available = variants.length ? variants.some((v) => v.available) : !!p.available;
    let price = cents(p.price), compare = cents(p.compare_at_price), images = [], lv = null;
    if (colour) {
      const mine = variants.filter((v) => vColour(v) === colour);
      lv = mine.find((v) => v.available) || mine[0] || null;
      if (lv) { cardUrl = url + '?variant=' + lv.id; if (lv.price != null) price = cents(lv.price); compare = cents(lv.compare_at_price); }
      available = mine.some((v) => v.available);
      const fake = { data: { media: normMedia(p, opts, ci), variants: variants.map((v) => ({ ['option' + (ci + 1)]: vColour(v), available: !!v.available, image: v.featured_image ? (v.featured_image.src || v.featured_image) : null, media_id: v.featured_media ? v.featured_media.id : (v.featured_image && v.featured_image.id ? v.featured_image.id : null) })), images: [] }, colorIndex: ci + 1 };
      images = imagesFor(fake, colour);
      if (images.length) img = images[0].src;
    } else {
      // one card per product: all photos (same list as the JSON "images"), so dots / arrows / hover swap work here too
      const all = p.images && p.images.length ? p.images : normMedia(p, opts, ci).map((m) => m.src);
      images = all.slice(0, MAX_IMAGES).map((src) => ({ src: typeof src === 'string' ? src : (src && src.src) || '' })).filter((x) => x.src);
      if (images.length && !img) img = images[0].src;
    }
    const priceTxt = price != null ? (OD.formatMoney ? OD.formatMoney(price) : String(price / 100)) : '';
    const onSale = typeof compare === 'number' && typeof price === 'number' && compare > price;
    const swatches = values.map((v) => '<button type="button" title="' + esc(v) + '" aria-label="' + esc(v) + '" aria-pressed="' + (v === selected) + '" class="_swatch_13l1w_280 od-card__dot ' + (v === selected ? SWATCH_SEL : '') + ' " style="background: ' + esc(OD.swatchColor ? OD.swatchColor(v, p.swatches) : String(v).toLowerCase()) + ';" data-card-swatch data-value="' + esc(v) + '"></button>').join('');
    const json = jsonFromProduct(p, colour, lv ? lv.id : null);
    const badges = available ? OD.badgeHTML(OD.badgesFor(p, 2)) : '';
    const soldOut = OD.badges && OD.badges.soldOut !== false ? '<span class="od-card__soldout" data-card-soldout' + (available ? ' hidden' : '') + '>' + esc((OD.badges && OD.badges.soldOutLabel) || 'Sold out') + '</span>' : '';
    const many = images.length > 1;
    return '<div class="_new_in_trend_card_13l1w_130 od-card' + (OD.rtl ? ' od-card--rtl' : '') + (available ? '' : ' is-sold-out') + '" data-product-card' + (json ? ' data-od-card' : '') + ' data-handle="' + esc(p.handle) + '" data-product-id="' + esc(p.id) + '" data-color-index="' + (ci + 1) + '" data-color-value="' + esc(selected) + '"' + (colour ? ' data-card-colour="' + esc(colour) + '"' : '') + '>' +
      '<div class="od-card__media">' +
      '<a href="' + esc(cardUrl) + '" class="od-card__link" data-card-image-link data-card-url="' + esc(url) + '" aria-label="' + esc(p.title) + '"><img class="od-card__img" alt="' + esc(p.title) + '" src="' + esc(img) + '" loading="lazy" data-card-image></a>' +
      '<div class="od-card__top"><div class="od-card__top-start" data-card-badges>' + badges + '</div><div class="od-card__top-end"><div class="_globalImg_1tf1q_38 _wishlistIcon_13l1w_356 od-card__wish" data-wishlist-toggle data-wishlist-handle="' + esc(p.handle) + '" data-wishlist-id="' + esc(p.id) + '" role="button" tabindex="0"><img alt="" src="' + ((OD.assets && OD.assets.wishlist) || '') + '"></div></div></div>' +
      (json ? '<button type="button" class="od-card__arrow od-card__arrow--prev" data-card-prev' + (many ? '' : ' hidden') + ' aria-label="prev">' + ARROW_PREV + '</button><button type="button" class="od-card__arrow od-card__arrow--next" data-card-next' + (many ? '' : ' hidden') + ' aria-label="next">' + ARROW_NEXT + '</button><div class="od-card__dots" data-card-dots aria-hidden="true"' + (many ? '' : ' hidden') + '>' + images.map((_, i) => '<span' + (i === 0 ? ' class="is-active"' : '') + '></span>').join('') + '</div>' : '') +
      (json ? '<button type="button" class="od-card__plus" data-card-quickadd aria-haspopup="dialog"' + (available ? '' : ' hidden') + ' aria-label="' + esc((qa && qa.getAttribute('aria-label')) || 'Quick add') + '">' + BAG_ICON + '</button>' + soldOut : (available ? '' : soldOut)) +
      '</div>' +
      '<div class="od-card__body">' +
      (p.vendor ? '<p class="od-card__brand"><a class="od-brand-link" href="' + OD.vendorUrl(p.vendor) + '">' + esc(p.vendor) + '</a></p>' : '') +
      '<div class="od-card__row"><p class="od-card__name"><a href="' + esc(cardUrl) + '" data-card-name-link>' + esc(p.title) + '</a></p>' +
      '<div class="od-card__prices"><p class="od-card__price' + (onSale ? ' od-card__price--sale' : '') + '" data-card-price>' + (OD.SAR || '') + priceTxt + '</p><p class="od-card__price od-card__price--compare" data-card-compare' + (onSale ? '' : ' hidden') + '>' + (onSale ? money(compare) : '') + '</p></div></div>' +
      (swatches ? '<div class="od-card__colours"><div class="' + (OD.rtl ? '_new_in_trend_card__colorsRtl_13l1w_139' : '_new_in_trend_card__colorsLtr_13l1w_139') + ' od-card__swatches">' + swatches + '</div></div>' : '') +
      '</div>' + json + '</div>';
  };
  OD.cardsHTML = function (p) {
    if (OD.cardPerColour === false || !p) return [OD.cardHTML(p)];
    const opts = normOptions(p);
    const ci = colourIndexOf(p);
    const values = ci > -1 ? opts[ci].values : [];
    if (values.length < 2) return [OD.cardHTML(p)];
    return values.map((v) => OD.cardHTML(p, v));
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
