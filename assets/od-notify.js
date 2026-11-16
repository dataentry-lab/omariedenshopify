/* od-notify: "Notify me" on a sold-out size (16 Nov 2026).
   Markup: snippets/notify-box.liquid ([data-nm]) inside a scope ([data-nm-scope] = the product page root or the quick view drawer),
   a [data-nm-go] button, the normal buy button(s) marked [data-nm-buy], optional [data-nm-signin].
   theme.js (product page paint) and od-card.js (quick view) call OD.nmPaint(scope, on, {variantId, handle, size}).
   The request goes to the Cloudflare program in 9_Automations/notify-me (OD.notify.url + /subscribe); it saves the request,
   sends the two emails and watches the stock. Nothing is written to Shopify. Loaded BEFORE theme.js on purpose. */
(function () {
  'use strict';
  var OD = window.OD || (window.OD = {});
  var cfg = OD.notify;
  if (!cfg || !cfg.url) return;
  var T = cfg.t || {};
  var KEY = 'od_notify';
  function saved() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function remember(id, email) { try { var s = saved(); s[String(id)] = email; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function q(el, sel) { return el ? el.querySelector(sel) : null; }
  function all(el, sel) { return el ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []; }
  function show(el, on) { if (el) el.hidden = !on; }
  function put(text, token, value) { return String(text || '').split(token).join(value); }

  OD.nmPaint = function (scope, on, ctx) {
    var box = q(scope, '[data-nm]');
    if (!box) return;
    var go = q(scope, '[data-nm-go]');
    var signin = q(scope, '[data-nm-signin]');
    var buys = all(scope, '[data-nm-buy]');
    if (!on || !ctx || !ctx.variantId) {
      scope.__nm = null;
      show(box, false); show(go, false); show(signin, false);
      buys.forEach(function (b) { b.hidden = false; });
      return;
    }
    scope.__nm = ctx;
    var id = String(ctx.variantId);
    var done = saved()[id];
    var email = cfg.email || '';
    var text = (ctx.size ? put(T.soldSize, '__SIZE__', ctx.size) : T.soldPiece) + ' ' + (email ? put(T.askSigned, '__EMAIL__', email) : T.askGuest);
    var tEl = q(box, '[data-nm-text]');
    if (tEl) tEl.textContent = text;
    var err = q(box, '[data-nm-err]');
    if (err && err.getAttribute('data-for') !== id) err.hidden = true;
    show(q(box, '[data-nm-ask]'), !done);
    show(q(box, '[data-nm-done]'), !!done);
    if (done) { var dt = q(box, '[data-nm-done-text]'); if (dt) dt.textContent = put(T.doneText, '__EMAIL__', done); }
    show(box, true);
    show(go, !done);
    show(signin, !done && !email);
    buys.forEach(function (b) { b.hidden = true; });
  };

  function fail(box, msg, id) {
    var err = q(box, '[data-nm-err]');
    if (!err) return;
    err.textContent = msg || T.error || '';
    err.setAttribute('data-for', String(id));
    err.hidden = false;
  }

  async function submit(scope) {
    var ctx = scope.__nm, box = q(scope, '[data-nm]'), go = q(scope, '[data-nm-go]');
    if (!ctx || !box || scope.__nmBusy) return;
    var input = q(box, '[data-nm-email]');
    var email = String(cfg.email || (input ? input.value : '') || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fail(box, T.emailError, ctx.variantId); if (input) input.focus(); return; }
    var hp = q(box, '[data-nm-hp]');
    scope.__nmBusy = true;
    if (go) { if (OD.setLoading) OD.setLoading(go, true); else go.disabled = true; }
    var out = null;
    try {
      var r = await fetch(String(cfg.url).replace(/\/+$/, '') + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, variantId: String(ctx.variantId), handle: ctx.handle, locale: OD.locale || 'en', website: hp ? hp.value : '' })
      });
      out = await r.json();
    } catch (e) { out = null; }
    scope.__nmBusy = false;
    if (go) { if (OD.setLoading) OD.setLoading(go, false); else go.disabled = false; }
    if (out && out.ok) {
      remember(ctx.variantId, email);
      if (scope.__nm && String(scope.__nm.variantId) === String(ctx.variantId)) OD.nmPaint(scope, true, scope.__nm);
      return;
    }
    var code = out && out.error;
    fail(box, code === 'email' ? T.emailError : code === 'available' ? T.available : code === 'rate' ? T.rate : T.error, ctx.variantId);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nm-go]');
    if (!b) return;
    e.preventDefault();
    var scope = b.closest('[data-nm-scope]');
    if (scope) submit(scope);
  });
  // Enter in the email field asks for the alert (the field sits inside the product form: it must not add to the bag)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var i = e.target.closest && e.target.closest('[data-nm-email]');
    if (!i) return;
    e.preventDefault();
    var scope = i.closest('[data-nm-scope]');
    if (scope) submit(scope);
  });
  document.addEventListener('input', function (e) {
    var i = e.target.closest && e.target.closest('[data-nm-email]');
    if (!i) return;
    var err = q(i.closest('[data-nm]'), '[data-nm-err]');
    if (err) err.hidden = true;
  });
})();
