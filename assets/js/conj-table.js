/* conj-table.js — 活用表の描画
 *
 * 紙の活用表にできないことを3つやる:
 *   1. どのセルもクリックすれば発音が鳴る
 *   2. 語幹と語尾を色分けして、活用の仕組みを目で見えるようにする
 *   3. 「綴りは違うが音は同じ」セルに印を付ける
 *      （chante / chantes / chante / chantent は4つとも同じ音。
 *        これに気づかないまま暗記すると、聞き取りで必ずつまずく）
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var doc = global.document;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- 1つの時制ぶんの列 ---------- */

  function renderTense(verb, tenseKey, opts) {
    opts = opts || {};
    var r = FR.conj.get(verb, tenseKey, opts);
    if (!r) return null;

    var box = el('div', 'conj-tense');

    var head = el('div', 'conj-tense-name');
    head.appendChild(el('span', null, r.tense.ja));
    head.appendChild(el('span', 'fr-name', r.tense.fr));
    box.appendChild(head);

    var homo = FR.conj.homophoneGroups(r.forms);
    var homoIndex = {};
    homo.forEach(function (group, gi) {
      group.forEach(function (i) { homoIndex[i] = gi; });
    });

    var ul = el('ul', 'conj-rows');

    r.forms.forEach(function (form, i) {
      if (!form) return;
      var pronoun = r.pronouns[i];
      var spoken = r.tense.key === 'imperatif'
        ? form
        : (/'$/.test(pronoun) ? pronoun + form : pronoun + ' ' + form);
      // 接続法の "que" は表示だけで、発音にも含めてよい

      var li = el('li');
      li.dataset.fr = spoken;
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-label', spoken + ' を発音');
      if (homoIndex[i] !== undefined) li.classList.add('homo');

      li.appendChild(el('span', 'conj-pron', r.tense.key === 'imperatif' ? pronoun : pronoun));

      var formCell = el('span', 'conj-form');
      var parts = FR.conj.split(verb, tenseKey, i);
      if (parts.ending) {
        formCell.appendChild(el('span', 'st', parts.stem));
        formCell.appendChild(el('span', 'en', parts.ending));
      } else {
        formCell.appendChild(doc.createTextNode(form));
      }
      li.appendChild(formCell);

      var play = el('span', 'conj-play');
      li.appendChild(play);

      ul.appendChild(li);
    });

    box.appendChild(ul);
    return { node: box, homophones: homo, result: r };
  }

  /* ---------- 表全体 ---------- */

  /**
   * 活用表を描画する。
   * @param {string} verb 不定詞
   * @param {string[]} [tenses] 時制のリスト（省略時は直説法現在）
   */
  function render(verb, tenses) {
    var info = FR.conj.info(verb);
    if (!info) {
      var miss = el('div', 'callout warn');
      miss.appendChild(el('div', 'callout-title', '未登録の動詞'));
      miss.appendChild(el('p', null, verb + ' は活用データに登録されていません。'));
      return miss;
    }

    var keys = (tenses && tenses.length ? tenses : ['present'])
      .map(function (t) { return FR.conj.normalizeTense(t); })
      .filter(Boolean);
    if (!keys.length) keys = ['present'];

    var wrap = el('div', 'conj');
    var settings = FR.store ? FR.store.settings.all() : { showParts: true, showHomophones: true };
    if (settings.showParts) wrap.classList.add('show-parts');
    if (settings.showHomophones) wrap.classList.add('show-homo');

    /* ヘッダ */
    var head = el('div', 'conj-head');

    var title = el('span', 'conj-verb');
    title.textContent = info.inf;
    title.dataset.fr = info.inf;
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    head.appendChild(title);

    var meta = [];
    if (info.ja) meta.push(info.ja);
    meta.push(info.group === 1 ? '第1群' : info.group === 2 ? '第2群' : '第3群');
    if (info.irregular) meta.push('不規則');
    meta.push('助動詞 ' + info.aux);
    head.appendChild(el('span', 'conj-meta', meta.join(' ・ ')));

    var tools = el('div', 'conj-tools');

    var bParts = el('button', 'btn-mini', '語幹と語尾');
    bParts.type = 'button';
    bParts.setAttribute('aria-pressed', String(!!settings.showParts));
    bParts.addEventListener('click', function () {
      var on = wrap.classList.toggle('show-parts');
      bParts.setAttribute('aria-pressed', String(on));
      if (FR.store) FR.store.settings.set('showParts', on);
    });
    tools.appendChild(bParts);

    var bHomo = el('button', 'btn-mini', '同じ音');
    bHomo.type = 'button';
    bHomo.setAttribute('aria-pressed', String(!!settings.showHomophones));
    bHomo.addEventListener('click', function () {
      var on = wrap.classList.toggle('show-homo');
      bHomo.setAttribute('aria-pressed', String(on));
      if (FR.store) FR.store.settings.set('showHomophones', on);
    });
    tools.appendChild(bHomo);

    var bPlay = FR.iconize(el('button', 'btn-mini', '通して聞く'), 'play', 11);
    bPlay.type = 'button';
    bPlay.dataset.playAll = '1';
    tools.appendChild(bPlay);

    head.appendChild(tools);
    wrap.appendChild(head);

    /* 本体 */
    var grid = el('div', 'conj-grid');
    var allHomo = [];
    keys.forEach(function (k) {
      var out = renderTense(verb, k);
      if (out) {
        grid.appendChild(out.node);
        if (out.homophones.length) allHomo.push({ tense: out.result.tense, groups: out.homophones, forms: out.result.forms });
      }
    });
    wrap.appendChild(grid);

    /* 脚注 */
    var notes = [];
    if (info.note) notes.push(info.note);

    allHomo.forEach(function (h) {
      h.groups.forEach(function (g) {
        var words = g.map(function (i) { return h.forms[i]; });
        notes.push('同じ音：' + h.tense.ja + ' の ' + words.join(' / ') + ' は、綴りが違っても音は同じ。');
      });
    });

    if (info.aux === 'être') {
      notes.push('複合時制では助動詞に être を取るので、過去分詞が主語と性数一致する（elle est ' + info.pp + 'e）。');
    }

    if (notes.length) {
      var foot = el('div', 'conj-foot');
      notes.forEach(function (n, i) {
        var p = el('div', null, n);
        if (i) p.style.marginTop = '3px';
        foot.appendChild(p);
      });
      wrap.appendChild(foot);
    }

    return wrap;
  }

  /* ---------- 第13章：活用の全体図 ---------- */

  /**
   * 「どの形からどの形が導かれるか」を1枚で示す図。
   * 各ノードをクリックすると、その動詞のその時制の表が下に開く。
   */
  function renderMap(verb) {
    verb = verb || 'chanter';
    var info = FR.conj.info(verb);
    if (!info) info = FR.conj.info('chanter'), verb = 'chanter';

    var wrap = el('div', 'vmap');

    var intro = el('p', null,
      'フランス語の活用は、覚えるべき「もと」が4つしかない。そこから残りは機械的に導ける。' +
      '下の青いカードが「もと」、その右が「そこから作られる時制」。カードを押すと活用表が開く。');
    intro.style.fontSize = '13.5px';
    intro.style.color = 'var(--text-soft)';
    intro.style.margin = '0 0 14px';
    wrap.appendChild(intro);

    var out = el('div');

    function node(kind, label, value, tenseKey) {
      var b = el('button', 'vmap-node' + (kind === 'src' ? ' src' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'k', kind === 'src' ? 'もと' : '導かれる時制'));
      b.appendChild(el('span', 'n', label));
      if (value) b.appendChild(el('span', 'f', value));
      b.addEventListener('click', function () {
        out.textContent = '';
        if (tenseKey) {
          out.appendChild(render(verb, [tenseKey]));
        } else {
          out.appendChild(render(verb, ['present']));
        }
        out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      return b;
    }

    function row(srcNode, derived) {
      var r = el('div', 'vmap-row');
      r.appendChild(srcNode);
      r.appendChild(el('div', 'vmap-arrow', '→'));
      var col = el('div');
      col.style.flex = '2 1 260px';
      col.style.display = 'flex';
      col.style.gap = '8px';
      col.style.flexWrap = 'wrap';
      derived.forEach(function (d) { col.appendChild(d); });
      r.appendChild(col);
      wrap.appendChild(r);
    }

    var pres = FR.conj.get(verb, 'present');

    row(
      node('src', '① 直説法現在', pres ? pres.forms.filter(Boolean).join(' / ') : '', 'present'),
      [
        node('d', '半過去', 'nous ' + (pres && pres.forms[3] ? pres.forms[3] : '') + ' − ons → ' + (info.impfStem || '') + '-', 'imparfait'),
        node('d', '接続法現在', info.subjStem ? ('ils ' + (pres && pres.forms[5] ? pres.forms[5] : '') + ' − ent → ' + info.subjStem + '-') : '（不規則）', 'subjonctif'),
        node('d', '命令法', 'tu / nous / vous の形から', 'imperatif')
      ]
    );

    row(
      node('src', '② 未来語幹', info.futStem + '-'),
      [
        node('d', '単純未来', info.futStem + ' + ai, as, a, ons, ez, ont', 'futur'),
        node('d', '条件法現在', info.futStem + ' + ais, ais, ait, ions, iez, aient', 'conditionnel')
      ]
    );

    row(
      node('src', '③ 過去分詞', info.pp + '（助動詞 ' + info.aux + '）'),
      [
        node('d', '複合過去', info.aux + ' の現在 + ' + info.pp, 'passeCompose'),
        node('d', '大過去', info.aux + ' の半過去 + ' + info.pp, 'plusQueParfait'),
        node('d', '前未来', info.aux + ' の単純未来 + ' + info.pp, 'futurAnterieur'),
        node('d', '条件法過去', info.aux + ' の条件法 + ' + info.pp, 'conditionnelPasse'),
        node('d', '接続法過去', info.aux + ' の接続法 + ' + info.pp, 'subjonctifPasse')
      ]
    );

    row(
      node('src', '④ 単純過去の語幹', '書き言葉専用'),
      [ node('d', '単純過去', '物語・歴史記述で使う', 'passeSimple') ]
    );

    var tip = el('div', 'callout tip');
    tip.appendChild(el('div', 'callout-title', 'ここが要点'));
    var tp = el('p', null,
      '条件法現在は「未来語幹 ＋ 半過去の語尾」でできている。つまり新しく覚えることは何もない。' +
      '同じように、複合時制は5つあるが、変わるのは助動詞の時制だけで、過去分詞は常に同じ。' +
      'この2点を押さえると、覚える量が体感で半分以下になる。');
    tip.appendChild(tp);
    wrap.appendChild(tip);

    wrap.appendChild(out);
    return wrap;
  }

  FR.conjTable = {
    render: render,
    renderMap: renderMap,
    renderTense: renderTense
  };

}(typeof window !== 'undefined' ? window : globalThis));
