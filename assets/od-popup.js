/* od-popup: welcome popup (sections/welcome-popup.liquid). Shows after a delay or on exit intent, once per N days
   (localStorage), submits the customer form with fetch (email + interest tags), optional step 2, success with code. */
(function () {
  'use strict';
  var OD = window.OD || (window.OD = {});
  var pop = document.querySelector('[data-od-popup]');
  if (!pop) return;
  var key = pop.getAttribute('data-key') || 'od_popup';
  var days = parseInt(pop.getAttribute('data-days') || '30', 10);
  var design = pop.getAttribute('data-design') === 'true';
  function seen() { try { var v = localStorage.getItem(key); return v && (Date.now() - parseInt(v, 10)) < days * 864e5; } catch (e) { return false; } }
  function mark() { try { localStorage.setItem(key, String(Date.now())); } catch (e) {} }
  var shown = false;
  function open() {
    if (shown) return;
    if (OD.openModals && OD.openModals.size) { setTimeout(open, 3000); return; }
    shown = true;
    pop.hidden = false;
    requestAnimationFrame(function () { pop.classList.add('is-open'); });
    var f = pop.querySelector('input[type="email"]');
    if (f && window.innerWidth > 767) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 400);
  }
  function close() { pop.classList.remove('is-open'); mark(); setTimeout(function () { pop.hidden = true; }, 300); }
  function step(n) { Array.prototype.forEach.call(pop.querySelectorAll('[data-od-popup-step]'), function (s) { s.hidden = s.getAttribute('data-od-popup-step') !== String(n); }); }

  if (!seen() || design) {
    var delay = parseInt(pop.getAttribute('data-delay') || '6', 10) * 1000;
    setTimeout(open, design ? 800 : delay);
    if (pop.getAttribute('data-exit') === 'true') document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && e.clientY <= 0) open(); });
  }
  pop.addEventListener('click', function (e) {
    if (e.target.closest('[data-od-popup-close]')) { close(); return; }
    var c = e.target.closest('[data-od-popup-copy]');
    if (c && navigator.clipboard) { navigator.clipboard.writeText(c.getAttribute('data-code')).then(function () { OD.toast && OD.toast(c.getAttribute('data-code') + ' copied'); }); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop.classList.contains('is-open')) close(); });

  var form = pop.querySelector('[data-od-popup-form]');
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var tags = form.querySelector('[data-od-popup-tags]');
    var picked = Array.prototype.map.call(form.querySelectorAll('[data-od-popup-interest]:checked'), function (i) { return 'interest:' + i.value; });
    if (tags) tags.value = [tags.getAttribute('data-base')].concat(picked).join(', ');
    var btn = form.querySelector('[type="submit"]');
    var err = form.querySelector('[data-od-popup-error]');
    OD.setLoading && OD.setLoading(btn, true);
    try {
      var r = await fetch(form.getAttribute('action') || '/contact', { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' } });
      if (/\/challenge/.test(r.url)) { form.submit(); return; }
      if (!r.ok) throw new Error('http');
      mark();
      step(pop.getAttribute('data-step2') === 'true' ? 2 : 'done');
    } catch (ex) {
      OD.setLoading && OD.setLoading(btn, false);
      if (err) { err.textContent = (OD.t && OD.t.cartError) || 'Please try again.'; err.hidden = false; }
    }
  });
  var phone = pop.querySelector('[data-od-popup-phone]');
  if (phone) phone.addEventListener('submit', function (e) {
    e.preventDefault();
    // Hook for the SMS app (Klaviyo, Postscript): dispatch the number, then continue
    document.dispatchEvent(new CustomEvent('od:popup:phone', { detail: { phone: phone.phone.value } }));
    step('done');
  });
})();
