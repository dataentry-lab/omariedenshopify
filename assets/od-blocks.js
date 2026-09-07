/* od-blocks: behaviour for the block library, blog listings and article pages (loaded after theme.js)
   - lightbox for image rows / recap galleries ([data-od-gallery="true"] [data-od-zoom])
   - forms (od-form): AJAX submit of the contact form + customer form (tags), success without reload
   - blog "Load more" button / infinite scroll
   - share buttons (copy link, native share)
   - video cover: click to play (YouTube / Vimeo embed inserted on demand) */
(function () {
  'use strict';
  var OD = window.OD || (window.OD = {});
  var $ = OD.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = OD.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ===================== lightbox ===================== */
  var lb = null, lbItems = [], lbIndex = 0;
  function ensureLightbox() {
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'od-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<button type="button" class="od-lightbox__btn od-lightbox__close" data-lb-close aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button type="button" class="od-lightbox__btn od-lightbox__prev" data-lb-prev aria-label="Previous"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<img alt="">' +
      '<button type="button" class="od-lightbox__btn od-lightbox__next" data-lb-next aria-label="Next"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<span class="od-lightbox__count" data-lb-count></span>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]') || e.target === lb) close();
      else if (e.target.closest('[data-lb-prev]')) show(lbIndex - 1);
      else if (e.target.closest('[data-lb-next]')) show(lbIndex + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(lbIndex + 1);
      if (e.key === 'ArrowLeft') show(lbIndex - 1);
    });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) show(dx < 0 ? lbIndex + 1 : lbIndex - 1); });
    return lb;
  }
  function show(i) {
    var n = lbItems.length;
    if (!n) return;
    lbIndex = ((i % n) + n) % n;
    var img = $('img', lb);
    img.src = lbItems[lbIndex].src;
    img.alt = lbItems[lbIndex].alt || '';
    $('[data-lb-count]', lb).textContent = n > 1 ? (lbIndex + 1) + ' / ' + n : '';
    $('[data-lb-prev]', lb).hidden = n < 2;
    $('[data-lb-next]', lb).hidden = n < 2;
    // preload neighbours
    [lbIndex + 1, lbIndex - 1].forEach(function (k) { var it = lbItems[((k % n) + n) % n]; if (it) { var p = new Image(); p.src = it.src; } });
  }
  function open(items, index) {
    ensureLightbox();
    lbItems = items; show(index || 0);
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function close() { if (!lb) return; lb.classList.remove('is-open'); if (!(OD.openModals && OD.openModals.size)) document.body.style.overflow = ''; }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-od-zoom]');
    if (!t) return;
    var gal = t.closest('[data-od-gallery="true"]');
    if (!gal) return;
    if (t.closest('a')) e.preventDefault();
    e.preventDefault();
    var all = $$('[data-od-zoom]', gal);
    open(all.map(function (el) { return { src: el.getAttribute('data-od-zoom'), alt: el.getAttribute('alt') || '' }; }), all.indexOf(t));
  });
  OD.lightbox = open;

  /* ===================== forms ===================== */
  function tagsFor(form) {
    var tags = [];
    var base = form.getAttribute('data-tag');
    if (base) tags.push(base);
    $$('input[data-tag-prefix]:checked', form).forEach(function (i) { tags.push(i.getAttribute('data-tag-prefix') + i.value); });
    return tags.join(', ');
  }
  function firstLast(name) {
    var parts = String(name || '').trim().split(/\s+/);
    return { first: parts.shift() || '', last: parts.join(' ') };
  }
  async function post(url, params) {
    var r = await fetch(url, { method: 'POST', body: params, credentials: 'same-origin', headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' }, redirect: 'follow' });
    if (/\/challenge/.test(r.url)) throw new Error('challenge');
    if (!r.ok) throw new Error('http');
    return r;
  }
  document.addEventListener('submit', async function (e) {
    var form = e.target.closest('form[data-od-form]');
    if (!form || form._odSubmitting) return;
    // HTML validation first
    var invalid = $$('input, textarea', form).filter(function (i) { return !i.checkValidity(); });
    if (invalid.length) { invalid.forEach(function (i) { i.classList.add('is-touched'); }); return; }
    e.preventDefault();
    form._odSubmitting = true;
    var btn = $('[type="submit"]', form);
    var err = $('[data-od-form-error]', form);
    if (err) { err.hidden = true; err.textContent = ''; }
    OD.setLoading && OD.setLoading(btn, true);
    try {
      var fd = new FormData(form);
      // 1. contact form: emails the store with every field (the default Shopify contact notification)
      await post(form.getAttribute('action') || '/contact', fd);
      // 2. customer form: saves the person in Customers with the tags (email required)
      var email = fd.get('contact[email]');
      if (email) {
        var cf = new FormData();
        var nm = firstLast(fd.get('contact[name]'));
        cf.append('form_type', 'customer');
        cf.append('utf8', '✓');
        cf.append('contact[email]', email);
        cf.append('contact[first_name]', nm.first);
        cf.append('contact[last_name]', nm.last);
        cf.append('contact[tags]', tagsFor(form));
        var consent = $('[data-consent]', form);
        if (!consent || consent.checked) cf.append('contact[accepts_marketing]', 'true');
        try { await post('/contact', cf); } catch (e2) { /* the email already reached the store; ignore */ }
      }
      var tpl = form.parentElement && form.parentElement.querySelector('[data-od-form-success]');
      if (tpl) { form.innerHTML = tpl.innerHTML; } else { form.innerHTML = '<div class="od-formblk__success"><p>' + (form.getAttribute('data-success') || 'Thank you') + '</p></div>'; }
      form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      document.dispatchEvent(new CustomEvent('od:form:success', { detail: { kind: form.getAttribute('data-od-form') } }));
    } catch (ex) {
      form._odSubmitting = false;
      OD.setLoading && OD.setLoading(btn, false);
      if (ex.message === 'challenge') { form._odNative = true; form.submit(); return; }
      if (err) { err.textContent = (OD.t && OD.t.cartError) || 'Something went wrong, please try again.'; err.hidden = false; }
    }
  });
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('form[data-od-form]')) e.target.classList.add('is-touched'); });

  /* ===================== blog: load more / infinite ===================== */
  function initBlog(root) {
    $$('[data-od-blog]', root || document).forEach(function (sec) {
      if (sec._odBlog) return;
      sec._odBlog = true;
      var more = $('[data-od-blog-more]', sec);
      if (!more) return;
      var list = $('[data-od-blog-list]', sec);
      var busy = false;
      function load() {
        var next = more.getAttribute('data-next-url');
        if (!next || busy) return;
        busy = true;
        more.innerHTML = '<div class="od-skel od-skel--line" style="width:120px"></div>';
        fetch(next, { headers: { Accept: 'text/html' } }).then(function (r) { return r.text(); }).then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var nl = $('[data-od-blog-list]', doc), nm = $('[data-od-blog-more]', doc);
          if (nl) Array.prototype.slice.call(nl.children).forEach(function (c) { c.classList.add('od-fade-in'); list.appendChild(c); });
          OD.fadeImages && OD.fadeImages(list);
          if (nm && nm.getAttribute('data-next-url')) { more.setAttribute('data-next-url', nm.getAttribute('data-next-url')); more.innerHTML = nm.innerHTML; }
          else { more.removeAttribute('data-next-url'); more.innerHTML = ''; }
          busy = false;
        }).catch(function () { busy = false; more.innerHTML = ''; });
      }
      sec.addEventListener('click', function (e) { if (e.target.closest('[data-od-blog-more-btn]')) load(); });
      if (sec.getAttribute('data-load') === 'infinite' && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { if (en[0].isIntersecting) load(); }, { rootMargin: '400px' }).observe(more);
      }
    });
  }

  /* ===================== share ===================== */
  document.addEventListener('click', function (e) {
    var copy = e.target.closest('[data-od-share-copy]');
    if (copy) {
      var box = copy.closest('[data-od-share]');
      var url = box ? box.getAttribute('data-url') : window.location.href;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { OD.toast && OD.toast(copy.getAttribute('data-copied') || 'Link copied'); }).catch(function () { window.prompt('', url); });
    }
    var nat = e.target.closest('[data-od-share-native]');
    if (nat && navigator.share) {
      var b2 = nat.closest('[data-od-share]');
      navigator.share({ title: b2.getAttribute('data-title'), url: b2.getAttribute('data-url') }).catch(function () {});
    }
  });
  function initShare(root) { if (navigator.share) $$('[data-od-share-native]', root || document).forEach(function (b) { b.hidden = false; }); }

  /* ===================== video cover ===================== */
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-od-video-play]');
    if (!c) return;
    var frame = c.closest('[data-od-video]');
    var tpl = frame && frame.querySelector('[data-od-video-embed]');
    if (!tpl) return;
    frame.innerHTML = tpl.innerHTML;
  });

  /* editorial cards: dots under the mobile scroll row (round 6) */
  function initCardDots(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.od-acards'), function (row) {
      if (row._odDots) return;
      row._odDots = true;
      var cards = row.querySelectorAll('.od-acard');
      if (cards.length < 2) return;
      var dots = document.createElement('div');
      dots.className = 'od-acards--dots';
      dots.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < cards.length; i++) { var d = document.createElement('span'); if (!i) d.className = 'is-active'; dots.appendChild(d); }
      row.parentNode.insertBefore(dots, row.nextSibling);
      var raf = null;
      function paint() {
        raf = null;
        var w = cards[0].getBoundingClientRect().width + 12;
        var idx = Math.min(cards.length - 1, Math.max(0, Math.round(Math.abs(row.scrollLeft) / w)));
        for (var k = 0; k < dots.children.length; k++) dots.children[k].classList.toggle('is-active', k === idx);
      }
      row.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    });
  }
  function boot(root) { initBlog(root); initShare(root); initCardDots(root); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); }); else boot();
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
})();
