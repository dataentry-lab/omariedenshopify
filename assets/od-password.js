/* Coming Soon page: popups (Get notified / password) and the notify form (customer form via fetch, phone through a contact form). */
(function () {
  'use strict';
  var root = document.querySelector('[data-od-password]');
  if (!root) return;
  var $ = function (s, c) { return (c || root).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); };
  function open(name) {
    var m = $('[data-pw-modal="' + name + '"]'); if (!m) return;
    m.hidden = false; document.body.style.overflow = 'hidden';
    var f = m.querySelector('input'); if (f) setTimeout(function () { f.focus(); }, 60);
  }
  function closeAll() { $$('[data-pw-modal]').forEach(function (m) { m.hidden = true; }); document.body.style.overflow = ''; }
  root.addEventListener('click', function (e) {
    var o = e.target.closest('[data-pw-open]'); if (o) { open(o.getAttribute('data-pw-open')); return; }
    if (e.target.closest('[data-pw-close]')) closeAll();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  if ($('[data-pw-wrong]')) open('password');

  var notify = $('[data-pw-form="notify"]'), phoneForm = $('[data-pw-form="phone"]');
  if (notify) notify.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('[data-pw-error]', notify); err.hidden = true;
    var email = notify.querySelector('[name="contact[email]"]').value.trim();
    var phone = ($('[data-pw-phone]', notify) || {}).value || '';
    root.classList.add('is-busy');
    var fd = new FormData(notify); fd.delete('phone');
    fetch(notify.getAttribute('action') || '/account', { method: 'POST', body: fd, credentials: 'same-origin', headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        if (/challenge/i.test(html) && /captcha|hcaptcha|g-recaptcha/i.test(html)) { notify.submit(); return; }
        if (phone && phoneForm) {
          $('[data-pw-phone-email]', phoneForm).value = email;
          $('[data-pw-phone-copy]', phoneForm).value = phone;
          fetch(phoneForm.getAttribute('action') || '/contact', { method: 'POST', body: new FormData(phoneForm), credentials: 'same-origin', headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' } }).catch(function () {});
        }
        var m = $('[data-pw-modal="notify"]');
        $('[data-pw-step="form"]', m).hidden = true; $('[data-pw-step="done"]', m).hidden = false;
      })
      .catch(function () { err.textContent = 'Something went wrong, please try again.'; err.hidden = false; })
      .then(function () { root.classList.remove('is-busy'); });
  });
})();
