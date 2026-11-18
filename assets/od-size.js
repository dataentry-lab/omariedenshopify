/* Size guide (18 Nov 2026).
   Data lives in Shopify: metaobject "Size chart" (type size_chart: title, brand, kind, table, note, note_ar)
   and the product metafield custom.size_chart that points to one entry. The table is plain text, one line per
   size, columns separated by "|", first line = column titles, first two columns = EU and Label:
       EU | Label | UK | US | Bust (cm) | Waist (cm) | Hips (cm)
       38 | UK 10 | 10 | 6  | 88        | 70         | 96
   The variant's Size value is the brand label ("UK 10"); this file finds its row and
     - writes the EU size on the size boxes (product page + quick view),
     - shows "On the label: UK 10" for the picked size,
     - opens the Size guide drawer with that brand's chart, the picked row highlighted and its details in the
       "Your size" card at the top (tapping another row shows that row in the card, the product is not changed).
   Loaded BEFORE theme.js (OD.sizePaint must exist at the first paint). Strings: OD.sizeT (layout/theme.liquid).
   Quick view reads the chart lazily from /products/<handle>?section_id=od-size-chart. */
(function () {
  'use strict';
  var OD = window.OD = window.OD || {};
  var T = OD.sizeT;
  if (!T) return;
  var doc = document;
  var UNIT = /\(\s*(cm|in|inch|inches)\s*\)\s*$/i;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fill(tpl, map) { return String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return map[k] != null ? map[k] : ''; }); }
  function cells(line) { return line.split('|').map(function (c) { return c.replace(/\s+/g, ' ').trim(); }); }

  function parse(c) {
    if (!c || !c.table) return null;
    var lines = String(c.table).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) return null;
    var cols = cells(lines[0]);
    if (cols.length < 2) return null;
    var rows = [], by = {};
    for (var i = 1; i < lines.length; i++) {
      var cs = cells(lines[i]);
      if (!cs[0] && !cs[1]) continue;
      var row = { eu: cs[0] || cs[1], label: cs[1] || cs[0], cells: cs };
      rows.push(row);
      if (!by[norm(row.label)]) by[norm(row.label)] = row;
    }
    if (!rows.length) return null;
    var units = cols.map(function (h) { var m = UNIT.exec(h); return m ? (m[1].toLowerCase() === 'cm' ? 'cm' : 'in') : null; });
    return { title: c.title || '', brand: c.brand || '', kind: c.kind || '', note: c.note || '', cols: cols, rows: rows, by: by, units: units };
  }
  OD.sizeParse = parse;

  function readJSON(scope) {
    var s = scope.querySelector('script[data-size-chart]');
    if (!s) return null;
    try { return parse(JSON.parse(s.textContent || 'null')); } catch (e) { return null; }
  }
  function chartOf(scope) {
    if (!scope) return null;
    if (scope.__szChart === undefined) scope.__szChart = readJSON(scope);
    return scope.__szChart;
  }
  function setLine(el, row, shown) {
    if (!el) return;
    if (!row || norm(row.eu) === norm(row.label)) { el.hidden = true; return; }
    var b = el.querySelector('[data-sz-lab]');
    if (b) b.textContent = String(shown || row.label).replace(/\s+/g, ' ').trim();
    el.hidden = false;
  }

  /* EU text for a label (used by the Notify me note so it names the size the shopper sees) */
  OD.sizeEU = function (scope, label) {
    var ch = scope && (scope.__szChart || chartOf(scope));
    var row = ch && ch.by[norm(label)];
    return row ? row.eu : label;
  };

  /* ---------- product page: called at the end of theme.js initProduct paint() ---------- */
  OD.sizePaint = function (root, label) {
    var ch = chartOf(root);
    if (!ch) return;
    var wrap = root.querySelector('[data-sz-option]');
    if (!wrap) return;
    var boxes = wrap.querySelectorAll('[data-option-value]');
    for (var i = 0; i < boxes.length; i++) {
      var r = ch.by[norm(boxes[i].getAttribute('data-option-value'))];
      var sq = boxes[i].querySelector('._square_j1gah_39');
      if (r && sq && sq.textContent !== r.eu) sq.textContent = r.eu;
    }
    var row = label != null ? ch.by[norm(label)] : null;
    var lab = wrap.querySelector('[data-option-value-label]');
    if (lab && row) lab.textContent = row.eu;
    setLine(root.querySelector('[data-sz-line]'), row, label);
    var open = root.querySelector('[data-sz-open]');
    if (open) open.hidden = false;
    root.__szSel = row ? norm(row.label) : null;
  };

  /* ---------- quick view: called from od-card.js after the size buttons are built / picked ---------- */
  var ready = {}, waiting = {};
  function lookup(handle) {
    if (!waiting[handle]) {
      var root = OD.rootUrl || '/';
      if (root.slice(-1) !== '/') root += '/';
      waiting[handle] = fetch(root + 'products/' + encodeURIComponent(handle) + '?section_id=od-size-chart', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) {
          var m = /<script[^>]*data-size-chart[^>]*>([\s\S]*?)<\/script>/i.exec(html);
          var ch = null;
          try { ch = m ? parse(JSON.parse(m[1])) : null; } catch (e) { ch = null; }
          ready[handle] = ch;
          return ch;
        })
        .catch(function () { ready[handle] = null; return null; });
    }
    return waiting[handle];
  }
  OD.sizeQA = function (qa, handle) {
    if (!qa || !handle) return;
    qa.__szHandle = handle;
    var line = qa.querySelector('[data-qa-sz-line]'), open = qa.querySelector('[data-qa-sz-open]');
    function apply(ch) {
      if (qa.__szHandle !== handle) return;
      qa.__szChart = ch;
      if (open) open.hidden = !ch;
      if (!ch) { if (line) line.hidden = true; qa.__szSel = null; return; }
      var sel = null, selRaw = null, btns = qa.querySelectorAll('[data-qa-size]');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i], raw = b.getAttribute('data-sz-raw');
        if (raw == null) { raw = b.textContent; b.setAttribute('data-sz-raw', raw); }
        var row = ch.by[norm(raw)];
        if (row) { if (b.textContent !== row.eu) b.textContent = row.eu; b.classList.toggle('is-wide', row.eu.length > 4); }
        if (b.classList.contains('is-selected')) { sel = row || null; selRaw = raw; }
      }
      setLine(line, sel, selRaw);
      qa.__szSel = sel ? norm(sel.label) : null;
    }
    if (handle in ready) { apply(ready[handle]); return; }
    qa.__szChart = null;
    if (open) open.hidden = true;
    if (line) line.hidden = true;
    lookup(handle).then(apply);
  };

  /* ---------- the drawer ---------- */
  var cur = { chart: null, sel: null, own: null, unit: null };
  function conv(txt, from, to) {
    if (from === to) return txt;
    return String(txt).replace(/\d+(?:\.\d+)?/g, function (n) {
      var v = parseFloat(n);
      v = to === 'in' ? v / 2.54 : v * 2.54;
      var s = v.toFixed(1);
      return s.slice(-2) === '.0' ? s.slice(0, -2) : s;
    });
  }
  function unitLabel() { return cur.unit === 'in' ? (T.unit_in || 'in') : (T.unit_cm || 'cm'); }
  function fact(title, value, main) {
    return '<div class="od-szg__fact"><span class="od-szg__eyebrow">' + esc(title) + '</span><span class="' + (main ? 'od-szg__big' : 'od-szg__fv') + '">' + esc(value) + '</span></div>';
  }
  /* "Your size" card: the picked row in large type, with every other column of that row as a small fact */
  function card(ch, r) {
    var same = norm(r.eu) === norm(r.label);
    var h = '<div class="od-szg__facts">' + fact(cur.sel === cur.own ? (T.your_size || '') : (T.size_one || ''), (ch.cols[0] ? ch.cols[0] + ' ' : '') + r.eu, true);
    for (var i = 1; i < ch.cols.length; i++) {
      var v = r.cells[i];
      if (v == null || v === '' || (i === 1 && same)) continue;
      if (ch.units[i]) h += fact(ch.cols[i].replace(UNIT, '').trim(), conv(v, ch.units[i], cur.unit) + ' ' + unitLabel());
      else h += fact(i === 1 ? (T.label_col || ch.cols[i]) : ch.cols[i], v);
    }
    h += '</div>';
    if (!same && T.card_hint) h += '<p class="od-szg__card-hint">' + esc(T.card_hint) + '</p>';
    return h;
  }
  function render() {
    var box = doc.querySelector('[data-modal="size-guide"]');
    var ch = cur.chart;
    if (!box || !ch) return;
    var hasUnits = ch.units.some(Boolean);
    var sub = box.querySelector('[data-szg-sub]');
    if (sub) sub.textContent = [ch.brand, ch.kind].filter(Boolean).join(' · ') || ch.title;
    var ub = box.querySelector('[data-szg-units]');
    if (ub) {
      ub.hidden = !hasUnits;
      var bs = ub.querySelectorAll('[data-szg-unit]');
      for (var u = 0; u < bs.length; u++) bs[u].classList.toggle('is-on', bs[u].getAttribute('data-szg-unit') === cur.unit);
    }
    var h = '<thead><tr>' + ch.cols.map(function (c, i) {
      var t = i === 1 ? (T.label_col || c) : c;
      if (ch.units[i]) t = c.replace(UNIT, '').trim() + ' (' + unitLabel() + ')';
      return '<th scope="col">' + esc(t) + '</th>';
    }).join('') + '</tr></thead><tbody>';
    var picked = null;
    ch.rows.forEach(function (r) {
      var key = norm(r.label), on = cur.sel && key === cur.sel;
      if (on) picked = r;
      h += '<tr data-szg-row="' + esc(key) + '"' + (on ? ' class="is-on"' : '') + '>' + ch.cols.map(function (c, i) {
        var v = r.cells[i] == null ? '' : r.cells[i];
        if (ch.units[i] && v) v = conv(v, ch.units[i], cur.unit);
        return '<td>' + esc(v) + '</td>';
      }).join('') + '</tr>';
    });
    var tb = box.querySelector('[data-szg-table]');
    if (tb) tb.innerHTML = h + '</tbody>';
    var cd = box.querySelector('[data-szg-card]');
    if (cd) {
      if (picked) { cd.innerHTML = card(ch, picked); cd.hidden = false; }
      else { cd.innerHTML = ''; cd.hidden = true; }
    }
    var notes = box.querySelector('[data-szg-notes]'), note = box.querySelector('[data-szg-note]'), nh = box.querySelector('[data-szg-note-h]');
    if (note) note.textContent = ch.note || '';
    if (nh) nh.textContent = (hasUnits ? T.how_to_measure : T.good_to_know) || '';
    if (notes) notes.hidden = !ch.note;
    var scope = box.querySelector('[data-szg-scope]');
    if (scope) { scope.textContent = fill(T.scope, { brand: ch.brand, kind: ch.kind }); scope.hidden = !(ch.brand || ch.kind); }
  }
  OD.sizeGuide = function (chart, sel) {
    if (!chart) return;
    var first = null;
    for (var i = 0; i < chart.units.length; i++) if (chart.units[i]) { first = chart.units[i]; break; }
    cur = { chart: chart, sel: sel || null, own: sel || null, unit: first };
    render();
    if (OD.openModal) OD.openModal('size-guide');
  };

  doc.addEventListener('click', function (e) {
    var u = e.target.closest && e.target.closest('[data-szg-unit]');
    if (u) { cur.unit = u.getAttribute('data-szg-unit'); render(); return; }
    var rw = e.target.closest && e.target.closest('[data-szg-row]');
    if (rw) { cur.sel = rw.getAttribute('data-szg-row'); render(); return; }
    var o = e.target.closest && e.target.closest('[data-sz-open]');
    if (!o) return;
    e.preventDefault();
    var n = o.parentElement, ch = null, sel = null;
    while (n && n !== doc.body) {
      if (n.__szChart) { ch = n.__szChart; sel = n.__szSel; break; }
      if (n.hasAttribute && n.hasAttribute('data-product-root')) { ch = chartOf(n); sel = n.__szSel; break; }
      n = n.parentElement;
    }
    OD.sizeGuide(ch, sel);
  });
})();
