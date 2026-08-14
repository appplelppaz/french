/* icons.js — 単色のアイコン
 *
 * 絵文字は色と描き方が端末ごとに違い、抑えた配色の中で浮いてしまうので、
 * 線だけで描いた SVG に統一する。色は currentColor を継ぐ。
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var doc = global.document;
  var NS = 'http://www.w3.org/2000/svg';

  /* 各アイコンは 24×24 のグリッド上のパス。線は 1.6 で統一する。 */
  var PATHS = {
    menu:    ['M3 6h18', 'M3 12h18', 'M3 18h18'],
    close:   ['M6 6l12 12', 'M18 6L6 18'],
    sound:   ['M4 9v6h4l5 4V5L8 9H4z', 'M16.5 8.5a5 5 0 010 7', 'M19 6a8.5 8.5 0 010 12'],
    theme:   ['M12 3a9 9 0 000 18z', 'M12 3a9 9 0 010 18a9 9 0 010-18z'],
    spark:   ['M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z',
              'M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z'],
    book:    ['M12 6.5C10 5 7.5 4.3 4.5 4.3v13C7.5 17.3 10 18 12 19.5',
              'M12 6.5C14 5 16.5 4.3 19.5 4.3v13c-3 0-5.5.7-7.5 2.2',
              'M12 6.5v13'],
    grid:    ['M3.5 4.5h17v15h-17z', 'M3.5 9.5h17', 'M9.5 9.5v10'],
    target:  ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 8a4 4 0 100 8 4 4 0 000-8z', 'M12 11.5a.5.5 0 100 1 .5.5 0 000-1z'],
    star:    ['M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8L12 3.5z'],
    gear:    ['M12 9a3 3 0 100 6 3 3 0 000-6z',
              'M19.4 13.5a7.6 7.6 0 000-3l1.9-1.4-1.9-3.3-2.3.9a7.6 7.6 0 00-2.6-1.5L14.2 2h-3.8l-.3 2.4a7.6 7.6 0 00-2.6 1.5l-2.3-.9-1.9 3.3 1.9 1.4a7.6 7.6 0 000 3l-1.9 1.4 1.9 3.3 2.3-.9a7.6 7.6 0 002.6 1.5l.3 2.4h3.8l.3-2.4a7.6 7.6 0 002.6-1.5l2.3.9 1.9-3.3-1.9-1.4z'],
    play:    ['M7 4.5l12 7.5-12 7.5v-15z'],
    pen:     ['M4 20l4-1 10-10-3-3L5 16l-1 4z', 'M14 6l3 3'],
    check:   ['M4 12.5l5 5L20 6.5'],
    arrow:   ['M5 12h14', 'M13 6l6 6-6 6'],
    search:  ['M11 4a7 7 0 100 14 7 7 0 000-14z', 'M16.2 16.2L21 21']
  };

  var FILLED = { play: 1, star: 1, spark: 1 };

  /**
   * アイコンの SVG 要素を返す。
   * @param {string} name PATHS のキー
   * @param {number} [size] 一辺の px（既定 18）
   */
  function icon(name, size) {
    var svg = doc.createElementNS(NS, 'svg');
    var s = size || 18;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(s));
    svg.setAttribute('height', String(s));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('icon');

    var filled = !!FILLED[name];
    svg.setAttribute('fill', filled ? 'currentColor' : 'none');
    if (!filled) {
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.6');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }

    (PATHS[name] || []).forEach(function (d) {
      var p = doc.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  /** 既存の要素の中身をアイコンに置き換える */
  function setIcon(el, name, size) {
    if (!el) return;
    el.textContent = '';
    el.appendChild(icon(name, size));
  }

  /**
   * 文字の入ったボタンの頭にアイコンを挿す。
   * @returns 渡された要素（そのまま繋げて書けるように）
   */
  function iconize(el, name, size) {
    if (!el) return el;
    el.insertBefore(icon(name, size || 12), el.firstChild);
    el.classList.add('has-ic');
    return el;
  }

  FR.icon = icon;
  FR.setIcon = setIcon;
  FR.iconize = iconize;

}(typeof window !== 'undefined' ? window : globalThis));
