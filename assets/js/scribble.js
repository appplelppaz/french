/* scribble.js — 手書き練習パッド
 *
 * iPad の Apple Pencil（または指）で綴りを書いて練習するためのキャンバス。
 * Pointer Events だけで実装し、ペンのときは筆圧で線の太さを変える。
 * 「お手本」を押すと、正解の語が薄い下敷きとして出て、なぞって練習できる。
 *
 * 依存なし。FR.scribble.create(getGuide) が要素を返す。
 *   getGuide … お手本として表示する文字列を返す関数（そのときの正解など）
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var doc = global.document;

  var PAD_H = 190;   /* 書く欄の高さ（CSS px） */

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function create(getGuide) {
    var root = el('div', 'scribble');

    var stage = el('div', 'scribble-stage');
    var ghost = el('div', 'scribble-ghost');
    ghost.hidden = true;
    var canvas = doc.createElement('canvas');
    canvas.className = 'scribble-canvas';
    stage.appendChild(ghost);
    stage.appendChild(canvas);
    root.appendChild(stage);

    var bar = el('div', 'scribble-bar');
    var bGuide = el('button', 'btn-mini', 'お手本を表示');
    bGuide.type = 'button';
    var bClear = el('button', 'btn-mini', '消す');
    bClear.type = 'button';
    var hint = el('span', 'scribble-hint', 'Apple Pencil または指で書けます');
    bar.appendChild(bGuide);
    bar.appendChild(bClear);
    bar.appendChild(hint);
    root.appendChild(bar);

    var ctx = canvas.getContext('2d');
    var strokes = [];      /* [{points:[{x,y,w}]}] — リサイズ時に描き直す */
    var live = null;

    function resize() {
      var w = stage.clientWidth;
      if (!w) return;
      var dpr = global.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(PAD_H * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = PAD_H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function ink() {
      /* テーマに追随させる。書くたびに読むほどでもないので、描画時に取得 */
      return getComputedStyle(root).color;
    }

    function drawStroke(s) {
      var pts = s.points;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, pts[0].w / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (var i = 1; i < pts.length; i++) {
        ctx.beginPath();
        ctx.lineWidth = (pts[i - 1].w + pts[i].w) / 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = ctx.fillStyle = ink();
      strokes.forEach(drawStroke);
    }

    /* 筆圧 → 線の太さ。ペン以外（指・マウス）は一定 */
    function widthFor(e) {
      if (e.pointerType === 'pen' && e.pressure > 0) return 1.5 + e.pressure * 4.5;
      return 3;
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: widthFor(e) };
    }

    canvas.addEventListener('pointerdown', function (e) {
      /* パームリジェクションは iPadOS が行うが、Pencil 使用中の指の誤タッチを
         念のため無視する：ペンのストローク中は他の pointerId を受け付けない */
      if (live) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      live = { id: e.pointerId, points: [pos(e)] };
      strokes.push(live);
      ctx.strokeStyle = ctx.fillStyle = ink();
      drawStroke(live);
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!live || e.pointerId !== live.id) return;
      e.preventDefault();
      /* coalesced events があれば全部拾う（Pencil は 240Hz） */
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      list.forEach(function (ev) { live.points.push(pos(ev)); });
      var n = live.points.length;
      var recent = { points: live.points.slice(Math.max(0, n - list.length - 1)) };
      drawStroke(recent);
    });

    function up(e) {
      if (live && e.pointerId === live.id) live = null;
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    bClear.addEventListener('click', function () {
      strokes = [];
      live = null;
      redraw();
    });

    bGuide.addEventListener('click', function () {
      if (ghost.hidden) {
        ghost.textContent = (typeof getGuide === 'function' && getGuide()) || '';
        ghost.hidden = !ghost.textContent;
        bGuide.textContent = ghost.hidden ? 'お手本を表示' : 'お手本を隠す';
      } else {
        ghost.hidden = true;
        bGuide.textContent = 'お手本を表示';
      }
    });

    /* 表示された後にサイズが決まるので、監視して合わせる */
    if (global.ResizeObserver) {
      new ResizeObserver(resize).observe(stage);
    } else {
      global.addEventListener('resize', resize);
      setTimeout(resize, 0);
    }

    return root;
  }

  FR.scribble = { create: create };

}(typeof window !== 'undefined' ? window : globalThis));
