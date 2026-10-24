/* Utilidades de interfaz compartidas: crear elementos, modales, avisos, selector de apuesta. */
(function (root) {
  'use strict';
  var CF = root.CF = root.CF || {};
  CF.Games = []; // cada juego se registra acá: { id, name, icon, desc, color, mount(ctx) }

  CF.h = function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    var kids = Array.prototype.slice.call(arguments, 2);
    (function add(list) {
      list.forEach(function (kid) {
        if (kid === null || kid === undefined || kid === false) return;
        if (Array.isArray(kid)) return add(kid);
        el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
      });
    })(kids);
    return el;
  };

  CF.fmt = function (n) { return Number(n).toLocaleString('es-AR'); };
  CF.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  CF.toast = function (msg) {
    var box = document.getElementById('toasts');
    var t = CF.h('div', { class: 'toast' }, msg);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  };

  // modal({title, body, actions:[{label, kind, onClick, close}]}) -> { close }
  CF.modal = function (o) {
    var overlay = CF.h('div', { class: 'modal-overlay' });
    function close() { overlay.remove(); }
    var actions = (o.actions || []).map(function (a) {
      return CF.h('button', {
        class: 'btn ' + (a.kind || ''),
        onClick: function () { var keep = a.onClick ? a.onClick() === false : false; if (a.close !== false && !keep) close(); }
      }, a.label);
    });
    var box = CF.h('div', { class: 'modal', role: 'dialog' },
      o.title ? CF.h('h3', { class: 'neon' }, o.title) : null,
      CF.h('div', { class: 'modal-body' }, o.body),
      CF.h('div', { class: 'modal-actions' }, actions));
    overlay.appendChild(box);
    if (o.dismissible !== false) overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    return { close: close, el: box };
  };

  CF.confirm = function (msg, okLabel) {
    return new Promise(function (resolve) {
      CF.modal({
        body: CF.h('p', null, msg),
        actions: [
          { label: 'Cancelar', kind: 'ghost', onClick: function () { resolve(false); } },
          { label: okLabel || 'Aceptar', kind: 'pink', onClick: function () { resolve(true); } }
        ]
      });
    });
  };

  // askText({title, label, type, value}) -> Promise<string|null>
  CF.askText = function (o) {
    return new Promise(function (resolve) {
      var input = CF.h('input', { class: 'input', type: o.type || 'text', value: o.value || '', placeholder: o.placeholder || '', inputmode: o.inputmode || null, autocomplete: 'off' });
      var m = CF.modal({
        title: o.title,
        body: CF.h('label', { class: 'field' }, CF.h('span', null, o.label || ''), input),
        dismissible: false,
        actions: [
          { label: 'Cancelar', kind: 'ghost', onClick: function () { resolve(null); } },
          { label: o.okLabel || 'Aceptar', kind: 'cyan', onClick: function () { resolve(input.value); } }
        ]
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { resolve(input.value); m.close(); } });
      setTimeout(function () { input.focus(); }, 50);
    });
  };

  // Selector de apuesta con fichas. Devuelve { el, get, set, setDisabled }.
  CF.betPicker = function (o) {
    var cur = o.value;
    var btns = o.bets.map(function (b) {
      return CF.h('button', { class: 'chip-btn' + (b === cur ? ' active' : ''), type: 'button', onClick: function () { set(b); } }, CF.fmt(b));
    });
    var el = CF.h('div', { class: 'bet-picker' },
      CF.h('span', { class: 'bet-label' }, o.label || 'Apuesta'),
      CF.h('div', { class: 'bet-chips' }, btns));
    function set(v) {
      cur = v;
      btns.forEach(function (x, i) { x.classList.toggle('active', o.bets[i] === v); });
      if (CF.SFX) CF.SFX.play('chip');
      if (o.onChange) o.onChange(v);
    }
    return {
      el: el,
      get: function () { return cur; },
      set: set,
      setDisabled: function (d) { btns.forEach(function (b) { b.disabled = !!d; }); el.classList.toggle('disabled', !!d); }
    };
  };
})(typeof self !== 'undefined' ? self : this);
