/* Currency display (18 Nov 2026).
   The store charges in SAR only. This file shows GUIDE prices in the shopper's currency:
   every price in the theme is "<span class="_sar_1ef42_1">symbol</span>1,325.00"; when the
   display currency is not SAR the symbol is hidden and the number becomes "BHD 132.900".
   The SAR text is kept on the symbol span (data-od-sar) so it can be put back.
   Also: Ship to + Currency lists in the language drawer (Save button), first-visit country
   detection, and the "charged in SAR" lines in the bag. Settings: Theme settings > Currency display. */
(function () {
  'use strict';
  var OD = window.OD || {};
  var C = OD.currency;
  if (!C) return;

  var SEL = '._sar_1ef42_1';
  var COUNTRY = { SA: 'SAR', AE: 'AED', BH: 'BHD', KW: 'KWD', OM: 'OMR', QA: 'QAR', JO: 'JOD', EG: 'EGP', US: 'USD', GB: 'GBP' };
  var DEC = { BHD: 3, KWD: 3, OMR: 3, JOD: 3, TND: 3, JPY: 0, KRW: 0 };
  var T = C.t || {};
  var doc = document, html = doc.documentElement;

  /* rates: "AED = 0.9793" one per line (parsed in the head script too) */
  if (!C.map) {
    C.map = {};
    String(C.rates || '').split(/\n/).forEach(function (l) {
      var p = l.split('='), k = (p[0] || '').trim().toUpperCase(), v = parseFloat(p[1]);
      if (/^[A-Z]{3}$/.test(k) && v > 0) C.map[k] = v;
    });
  }
  function valid(code) { return code === 'SAR' || !!C.map[code]; }
  function forCountry(iso) { var c = COUNTRY[iso] || 'SAR'; return valid(c) ? c : 'SAR'; }
  function ls(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem(k);
      window.localStorage.setItem(k, v); return true;
    } catch (e) { return v === undefined ? null : false; }
  }
  if (!C.now || !valid(C.now)) {
    var st = ls('od_currency');
    C.now = st && valid(st) ? st : forCountry(C.country);
  }

  function num(txt) { return parseFloat(String(txt).replace(/[^\d.]/g, '')); }
  function fmt(v, code) {
    var d = DEC[code] != null ? DEC[code] : 2;
    /* three-decimal currencies (BHD, KWD, OMR): rounded to two places, written with three ("132.900"), as local price tags are */
    var s = (d === 3 ? v.toFixed(2) + '0' : v.toFixed(d)).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s.join('.');
  }
  function sarLabel(txt) { return String(T.sar || 'SAR {{ amount }}').replace('{{ amount }}', txt); }

  function isStruck(span) {
    var p = span.parentElement;
    if (!p) return false;
    if (p.closest('s, del, [data-product-compare], [data-card-compare], .od-cartd-item__was')) return true;
    return /strikeThrough|--compare/.test(String(p.className || ''));
  }
  function isCompact(span) { return !!span.closest('.od-card, .od-live__card, .od-stl-item, .od-rl, ._priceRow_102j2_123, [data-cur-compact]'); }
  function isSkipped(span) { return !!span.closest('[data-cur-skip], .od-stamp__price, .od-citem__price'); }

  function one(span, code) {
    var tn = span.nextSibling;
    if (!tn || tn.nodeType !== 3) return;
    var txt = tn.data, shown = span.getAttribute('data-od-shown'), sar, rest;
    if (shown != null && shown !== '' && txt.indexOf(shown) === 0) {
      sar = span.getAttribute('data-od-sar');
      rest = txt.slice(shown.length);
    } else {
      var m = /^(\s*)(\d[\d,]*(?:\.\d+)?)/.exec(txt);
      if (!m) return;
      sar = m[2];
      rest = txt.slice(m[0].length);
    }
    var out;
    if (code === 'SAR' || isSkipped(span)) {
      out = sar;
      span.style.display = '';
    } else {
      var v = num(sar) * C.map[code];
      if (!isFinite(v)) return;
      if (isStruck(span)) out = fmt(v, code);
      else out = ((T.about && (C.aboutCards || !isCompact(span))) ? T.about + ' ' : '') + code + ' ' + fmt(v, code);
      span.style.display = 'none';
    }
    if (tn.data !== out + rest) tn.data = out + rest;
    span.setAttribute('data-od-sar', sar);
    span.setAttribute('data-od-shown', out);
  }

  function sarOf(scope, sel) {
    var t = scope.querySelector(sel);
    if (!t) return '';
    var span = t.matches(SEL) ? t : t.querySelector(SEL);
    if (!span) return '';
    var a = span.getAttribute('data-od-sar');
    if (a) return a;
    var tn = span.nextSibling, m = tn && tn.nodeType === 3 ? /^\s*(\d[\d,]*(?:\.\d+)?)/.exec(tn.data) : null;
    return m ? m[1] : '';
  }

  function sync(code) {
    var off = code === 'SAR', i, els;
    els = doc.querySelectorAll('[data-cur-only]');
    for (i = 0; i < els.length; i++) if (els[i].hidden !== off) els[i].hidden = off;
    if (off) return;
    els = doc.querySelectorAll('[data-cur-code]');
    for (i = 0; i < els.length; i++) if (els[i].textContent !== code) els[i].textContent = code;
    els = doc.querySelectorAll('[data-cur-sar-of]');
    for (i = 0; i < els.length; i++) {
      var scope = els[i].closest('[data-cur-scope]') || doc;
      var s = sarOf(scope, els[i].getAttribute('data-cur-sar-of'));
      var label = s ? sarLabel(s) : '';
      if (els[i].textContent !== label) els[i].textContent = label;
    }
  }

  var queued = false, obs = null;
  function pass() {
    queued = false;
    var code = C.now, spans = doc.querySelectorAll(SEL);
    for (var i = 0; i < spans.length; i++) one(spans[i], code);
    sync(code);
    html.classList.remove('od-cur-wait');
  }
  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || window.setTimeout)(pass);
  }
  function watch(on) {
    if (on && !obs && window.MutationObserver) {
      obs = new MutationObserver(schedule);
      obs.observe(doc.body, { childList: true, subtree: true });
    } else if (!on && obs) { obs.disconnect(); obs = null; }
  }

  function set(code, keep) {
    if (!valid(code)) code = 'SAR';
    C.now = code;
    html.setAttribute('data-od-cur', code);
    if (keep) ls('od_currency', code);
    pass();
    watch(code !== 'SAR');
    paintLists();
    try { doc.dispatchEvent(new CustomEvent('od:currency', { detail: { currency: code } })); } catch (e) {}
  }
  OD.setCurrency = function (code) { set(String(code || '').toUpperCase(), true); };
  OD.currencyPass = pass;

  /* ---------- Ship to + Currency lists (language drawer) ---------- */
  var form = null, pendCountry = null, pendCur = null;
  function tick(li, on) {
    var t = li.lastElementChild;
    if (!t) return;
    if (on) t.style.removeProperty('display'); else t.style.setProperty('display', 'none', 'important');
    li.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  function paintLists() {
    if (!form) return;
    var i, els = form.querySelectorAll('[data-country-option]');
    for (i = 0; i < els.length; i++) tick(els[i], els[i].getAttribute('data-country-option') === pendCountry);
    els = form.querySelectorAll('[data-currency-option]');
    for (i = 0; i < els.length; i++) tick(els[i], els[i].getAttribute('data-currency-option') === pendCur);
  }
  function resetLists() { pendCountry = C.country; pendCur = C.now; paintLists(); }
  function initLists() {
    form = doc.querySelector('[data-localization-form]');
    if (!form || !form.querySelector('[data-currency-option]')) { form = null; return; }
    resetLists();
    form.addEventListener('click', function (e) {
      var c = e.target.closest('[data-country-option]');
      var k = e.target.closest('[data-currency-option]');
      var s = e.target.closest('[data-cur-save]');
      if (c) {
        pendCountry = c.getAttribute('data-country-option');
        pendCur = forCountry(pendCountry);
        paintLists();
      } else if (k) {
        pendCur = k.getAttribute('data-currency-option');
        paintLists();
      } else if (s) {
        e.preventDefault();
        ls('od_currency', pendCur);
        ls('od_geo', '1');
        if (pendCountry && pendCountry !== C.country) {
          var inp = form.querySelector('[data-country-input]');
          if (inp) { inp.value = pendCountry; form.submit(); return; }
        }
        set(pendCur, true);
        if (OD.closeModal) OD.closeModal('language');
      }
    });
    doc.addEventListener('od:modal:open', function (e) { if (e.detail && e.detail.name === 'language') resetLists(); });
  }

  /* ---------- first visit: country (and its currency) from the visitor's location ---------- */
  function geo() {
    if (!C.auto) return;
    if (window.Shopify && window.Shopify.designMode) return;
    if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent || '')) return;
    if (ls('od_geo')) return;
    if (!window.fetch) return;
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || OD.rootUrl || '/';
    if (root.slice(-1) !== '/') root += '/';
    fetch(root + 'browsing_context_suggestions.json?country[enabled]=true', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var h = d && d.detected_values && d.detected_values.country && d.detected_values.country.handle;
        if (!ls('od_geo', '1')) return;            /* storage blocked: never switch, so it cannot loop */
        if (!h) return;
        h = String(h).toUpperCase();
        var f = doc.querySelector('[data-localization-form]');
        var opt = f && f.querySelector('[data-country-option="' + h + '"]');
        if (!opt) return;                          /* country is not one the store ships to */
        var picked = ls('od_currency');
        var cur = picked && valid(picked) ? picked : forCountry(h);
        if (!picked) ls('od_currency', cur);
        if (h !== C.country) {
          var inp = f.querySelector('[data-country-input]');
          if (inp) { inp.value = h; f.submit(); return; }
        }
        if (cur !== C.now) set(cur, false);
      })
      .catch(function () {});
  }

  function start() {
    html.setAttribute('data-od-cur', C.now);
    initLists();
    pass();
    watch(C.now !== 'SAR');
    geo();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  window.setTimeout(function () { html.classList.remove('od-cur-wait'); }, 2500);
})();
