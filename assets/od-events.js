/* od-events: events listing tabs (client-side filter) and the booking step (sections/main-event-booking.liquid).
   Booking: ticket quantities -> one attendee block per ticket (fields from the event) -> add each ticket as its own
   cart line with the answers as line item properties -> Shopify checkout. */
(function () {
  'use strict';
  var OD = window.OD || (window.OD = {});
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (cents) { return (OD.SAR || '') + (OD.formatMoney ? OD.formatMoney(cents) : (cents / 100).toFixed(2)); };

  /* ===================== listing tabs ===================== */
  $$('[data-od-events]').forEach(function (sec) {
    var cards = $$('[data-event]', sec);
    var empty = $('[data-ev-empty]', sec);
    function apply(tab) {
      var n = 0;
      cards.forEach(function (c) {
        var past = c.getAttribute('data-status') === 'past';
        var show = tab === 'all' || (tab === 'past' ? past : !past);
        c.hidden = !show;
        if (show) n++;
      });
      $$('[data-ev-tab]', sec).forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-ev-tab') === tab); });
      if (empty) empty.hidden = n > 0;
      // past events: newest first
      if (tab === 'past') {
        var grid = $('[data-ev-grid]', sec);
        cards.filter(function (c) { return !c.hidden; }).sort(function (a, b) { return (+b.getAttribute('data-start')) - (+a.getAttribute('data-start')); }).forEach(function (c) { grid.appendChild(c); });
      } else {
        var g2 = $('[data-ev-grid]', sec);
        cards.slice().sort(function (a, b) { return (+a.getAttribute('data-start')) - (+b.getAttribute('data-start')); }).forEach(function (c) { g2.appendChild(c); });
      }
    }
    sec.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ev-tab]');
      if (!b) return;
      apply(b.getAttribute('data-ev-tab'));
      try { history.replaceState(null, '', '?tab=' + b.getAttribute('data-ev-tab')); } catch (err) {}
    });
    apply(sec.getAttribute('data-tab') || 'upcoming');
  });

  /* ===================== booking ===================== */
  var bk = $('[data-od-booking]');
  if (!bk) return;
  var data = {};
  try { data = JSON.parse($('[data-booking-json]', bk).textContent); } catch (e) { return; }
  var t = function (k) { return bk.getAttribute('data-t-' + k) || ''; };
  var qty = {};            // variant id -> quantity
  var answers = {};        // ticket key -> { label: value }
  var tickets = $$('[data-bk-ticket]', bk);
  var listEl = $('[data-bk-attendee-list]', bk);
  var attWrap = $('[data-bk-attendees]', bk);
  var errEl = $('[data-bk-error]', bk);

  function variant(id) { return data.variants.find(function (v) { return String(v.id) === String(id); }); }
  function total() { var s = 0; Object.keys(qty).forEach(function (id) { var v = variant(id); if (v) s += v.price * qty[id]; }); return s; }
  function count() { return Object.keys(qty).reduce(function (a, id) { return a + qty[id]; }, 0); }

  function renderTickets() {
    tickets.forEach(function (el) {
      var id = el.getAttribute('data-id');
      var q = qty[id] || 0;
      var max = parseInt(el.getAttribute('data-max') || '20', 10);
      var out = $('[data-bk-qty]', el); if (out) out.textContent = q;
      var minus = $('[data-bk-minus]', el), plus = $('[data-bk-plus]', el);
      if (minus) minus.disabled = q <= 0;
      if (plus) plus.disabled = q >= max;
      el.classList.toggle('is-on', q > 0);
      var left = $('[data-bk-left]', el);
      if (left && max > 0) left.textContent = t('left').replace('__N__', Math.max(0, max - q));
    });
  }
  function fieldHTML(key, f, i, n) {
    var name = 'a[' + key + '][' + i + ']';
    return '<label class="od-field' + (n > 1 && f.type !== 'text' ? ' od-field--half' : '') + '"><span class="od-field__label">' + esc(f.label) + (f.required ? ' *' : '') + '</span><input type="' + f.type + '" name="' + esc(name) + '" data-bk-answer data-label="' + esc(f.label) + '" data-key="' + esc(key) + '"' + (f.required ? ' required' : '') + ' placeholder="' + esc(f.label) + '"></label>';
  }
  function renderAttendees() {
    var html = '';
    var idx = 0;
    tickets.forEach(function (el) {
      var id = el.getAttribute('data-id');
      var v = variant(id);
      for (var k = 0; k < (qty[id] || 0); k++) {
        idx++;
        var key = id + '-' + k;
        html += '<div class="od-att" data-bk-att data-key="' + esc(key) + '">' +
          '<p class="od-blk__eyebrow od-att__title">' + esc(t('ticket').replace('__N__', idx).replace('__T__', v ? v.title : '')) + '</p>' +
          '<div class="od-formblk__grid">' + data.fields.map(function (f, i) { return fieldHTML(key, f, i, data.fields.length); }).join('') + '</div>' +
          (idx > 1 ? '<button type="button" class="od-blk__btn od-blk__btn--link od-att__same" data-bk-same="' + esc(key) + '">' + esc(t('same')) + '</button>' : '') +
        '</div>';
      }
    });
    var wasHidden = attWrap.hidden;
    listEl.innerHTML = html;
    attWrap.hidden = !html;
    // restore typed answers
    $$('[data-bk-answer]', listEl).forEach(function (inp) { var a = answers[inp.getAttribute('data-key')]; if (a && a[inp.getAttribute('data-label')] != null) inp.value = a[inp.getAttribute('data-label')]; });
    if (wasHidden && html && idx === 1) { var f = $('[data-bk-answer]', listEl); }
  }
  function renderSummary() {
    var lines = '';
    Object.keys(qty).forEach(function (id) {
      var v = variant(id);
      if (!v || !qty[id]) return;
      lines += '<div class="od-booking__line"><span>' + esc(v.title) + ' × ' + qty[id] + '</span><span>' + (v.price ? money(v.price * qty[id]) : esc(t('free'))) + '</span></div>';
    });
    $('[data-bk-lines]', bk).innerHTML = lines;
    var tot = total(), n = count();
    $('[data-bk-total]', bk).innerHTML = money(tot);
    var bc = $('[data-bk-bar-count]', bk); if (bc) bc.textContent = n + ' ' + (n === 1 ? 'ticket' : 'tickets');
    var bt = $('[data-bk-bar-total]', bk); if (bt) bt.innerHTML = money(tot);
    $$('[data-bk-checkout]', bk).forEach(function (b) { b.disabled = n === 0; });
    var bar = $('[data-bk-bar]', bk); if (bar) bar.classList.toggle('is-on', n > 0);
  }
  function render() { renderTickets(); renderAttendees(); renderSummary(); }

  bk.addEventListener('click', function (e) {
    var tk = e.target.closest('[data-bk-ticket]');
    if (tk && e.target.closest('[data-bk-plus], [data-bk-minus]')) {
      var id = tk.getAttribute('data-id');
      var max = parseInt(tk.getAttribute('data-max') || '20', 10);
      var q = qty[id] || 0;
      q += e.target.closest('[data-bk-plus]') ? 1 : -1;
      qty[id] = Math.max(0, Math.min(max, q));
      if (!qty[id]) delete qty[id];
      render();
      return;
    }
    var same = e.target.closest('[data-bk-same]');
    if (same) {
      var first = $('[data-bk-att]', listEl);
      var target = same.closest('[data-bk-att]');
      if (first && target) $$('[data-bk-answer]', target).forEach(function (inp) { var src = $('[data-bk-answer][data-label="' + inp.getAttribute('data-label').replace(/"/g, '\\"') + '"]', first); if (src) { inp.value = src.value; inp.dispatchEvent(new Event('input', { bubbles: true })); } });
      return;
    }
    if (e.target.closest('[data-bk-checkout]')) checkout(e.target.closest('[data-bk-checkout]'));
  });
  bk.addEventListener('input', function (e) {
    var inp = e.target.closest('[data-bk-answer]');
    if (!inp) return;
    var key = inp.getAttribute('data-key');
    answers[key] = answers[key] || {};
    answers[key][inp.getAttribute('data-label')] = inp.value;
    inp.classList.add('is-touched');
  });

  function showError(msg) { if (!errEl) return; errEl.textContent = msg; errEl.hidden = !msg; if (msg) errEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  async function checkout(btn) {
    showError('');
    if (!count()) { showError(t('choose')); return; }
    var bad = $$('[data-bk-answer]', listEl).filter(function (i) { return !i.checkValidity(); });
    var terms = $('[data-bk-terms]', bk);
    if (terms && !terms.checked) bad.push(terms);
    if (bad.length) { bad.forEach(function (i) { i.classList.add('is-touched'); }); showError(t('fill')); bad[0].focus(); return; }
    var session = $('[data-bk-sessions] input:checked', bk);
    var items = [];
    tickets.forEach(function (el) {
      var id = el.getAttribute('data-id');
      for (var k = 0; k < (qty[id] || 0); k++) {
        var key = id + '-' + k;
        var props = {};
        if (session) props[data.sessionLabel || 'Session'] = session.value;
        var a = answers[key] || {};
        data.fields.forEach(function (f) { if (a[f.label]) props[f.label] = a[f.label]; });
        props['_ticket'] = (k + 1);
        items.push({ id: parseInt(id, 10), quantity: 1, properties: props });
      }
    });
    OD.setLoading ? OD.setLoading(btn, true) : (btn.disabled = true);
    try {
      var r = await fetch(bk.getAttribute('data-cart-add') + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: items }) });
      var j = await r.json();
      if (!r.ok) throw new Error(j.description || j.message || 'error');
      window.location.href = bk.getAttribute('data-checkout') || '/checkout';
    } catch (err) {
      OD.setLoading ? OD.setLoading(btn, false) : (btn.disabled = false);
      showError(err.message || 'Error');
    }
  }
  render();
})();
