/* od-cafe: category tabs generated from the menu sections on the page, sticky under the header, jump to section. */
(function () {
  'use strict';
  function build(bar) {
    var nav = bar.querySelector('[data-cafe-tabs-nav]');
    if (!nav) return;
    var secs = Array.prototype.slice.call(document.querySelectorAll('[data-cafe-category]'));
    nav.innerHTML = secs.map(function (s) {
      var seasonal = s.hasAttribute('data-cafe-seasonal');
      return '<a class="od-cafe-tab' + (seasonal ? ' od-cafe-tab--seasonal' : '') + '" href="#' + s.id + '" data-cafe-tab="' + s.id + '">' + (s.getAttribute('data-cafe-label') || '') + '</a>';
    }).join('');
    var tabs = Array.prototype.slice.call(nav.querySelectorAll('[data-cafe-tab]'));
    function headerH() { var h = document.querySelector('[data-header]'); return h ? h.getBoundingClientRect().height : 0; }
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('[data-cafe-tab]');
      if (!a) return;
      e.preventDefault();
      var target = document.getElementById(a.getAttribute('data-cafe-tab'));
      if (!target) return;
      var top = target.getBoundingClientRect().top + window.scrollY - headerH() - bar.getBoundingClientRect().height - 8;
      window.scrollTo({ top: top, behavior: 'smooth' });
      try { history.replaceState(null, '', '#' + target.id); } catch (err) {}
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          tabs.forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-cafe-tab') === en.target.id); });
          var active = nav.querySelector('.is-active');
          if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      secs.forEach(function (s) { io.observe(s); });
    }
    function stick() { bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= headerH() + 1 && window.scrollY > 40); }
    window.addEventListener('scroll', stick, { passive: true });
    stick();
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll('[data-cafe-tabs]'), build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('shopify:section:load', init);
})();
