/* markup.js — 章の原稿（Markdown サブセット＋独自記法）を DOM に変換する。
 *
 * 出力はすべて DOM API で組み立てる。innerHTML に文字列を流し込む箇所は無い。
 * AI の生成テキストも同じ経路を通すので、これが安全性の担保になっている。
 *
 * 独自記法
 *   [[Je t'aime.|ジュ・テーム|愛してる。]]   フランス語チップ（クリックで発音）
 *   [[bonjour]]  [[merci||ありがとう]]        カナ・訳は省略可
 *
 *   :::ex 見出し            例文ブロック（1行 = 仏文 | カナ | 和訳）
 *   :::note / :::warn / :::adv / :::tip 見出し   注記ボックス
 *   :::quiz                 練習問題（Q. / A. の行を並べる）
 *   :::vocab 見出し         語彙リスト（1行 = 語 | 品詞 | 意味）
 *   ↑ここまではいずれも ::: の行で閉じる
 *
 *   :::conj chanter présent,futur      活用表（1行完結）
 *   :::drill chanter,parler présent    活用ドリル（1行完結）
 *   :::vmap                            活用の全体図（1行完結）
 *   :::ai-gen 複合過去                 AI 例文生成ボタン（1行完結）
 *   :::ai-ask 質問の例                 AI 質問ボタン（1行完結）
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var doc = global.document;

  var BLOCK_DIRECTIVES = { ex: 1, note: 1, warn: 1, adv: 1, tip: 1, deep: 1, quiz: 1, vocab: 1 };
  var SOLO_DIRECTIVES = { conj: 1, drill: 1, vmap: 1, 'ai-gen': 1, 'ai-ask': 1 };

  /* 見出しの色と左の縦線だけで種別を区別するので、絵文字は使わない */
  var CALLOUT_LABEL = {
    note: { fallback: 'ポイント' },
    warn: { fallback: '要注意' },
    adv:  { fallback: '発展' },
    deep: { fallback: '詳しく' },
    tip:  { fallback: 'コツ' }
  };

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ==================== インライン ==================== */

  // 太字やリンクの中身をもう一度 inline() に渡すため、この関数は再帰する。
  // g フラグ付きの正規表現を使い回すと lastIndex が再帰先で巻き戻され、
  // 外側の走査が同じ位置を延々と読み直して止まらなくなる。呼び出しごとに作り直す。
  var INLINE_SRC = '\\[\\[([^\\]]*?)\\]\\]|\\*\\*([\\s\\S]+?)\\*\\*|`([^`]+?)`|\\[([^\\]]+?)\\]\\(([^)\\s]+?)\\)|\\*([^*\\n]+?)\\*';

  /**
   * フランス語チップを作る。
   * @param {string} fr 読み上げる仏語
   * @param {string} [kana] カナ読み
   * @param {string} [gloss] 和訳
   */
  function frChip(fr, kana, gloss) {
    var span = el('span', 'fr');
    span.dataset.fr = fr;
    span.setAttribute('role', 'button');
    span.setAttribute('tabindex', '0');
    span.setAttribute('aria-label', fr + ' を発音');
    span.appendChild(doc.createTextNode(fr));
    if (kana) span.appendChild(el('span', 'kana', kana));
    if (gloss) span.appendChild(el('span', 'gloss', gloss));
    return span;
  }

  /** インライン記法を解釈して frag に流し込む */
  function inline(text, frag) {
    frag = frag || doc.createDocumentFragment();
    var re = new RegExp(INLINE_SRC, 'g');
    var last = 0, m;

    while ((m = re.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
      last = m.index + m[0].length;

      if (m[1] !== undefined) {              // [[fr|kana|gloss]]
        var parts = m[1].split('|');
        frag.appendChild(frChip(parts[0].trim(), (parts[1] || '').trim(), (parts[2] || '').trim()));
      } else if (m[2] !== undefined) {       // **bold**
        var b = el('strong');
        inline(m[2], b);
        frag.appendChild(b);
      } else if (m[3] !== undefined) {       // `code`
        frag.appendChild(el('code', null, m[3]));
      } else if (m[4] !== undefined) {       // [text](url)
        var a = el('a');
        var href = m[5];
        // javascript: 等のスキームは弾く
        a.href = /^(https?:|mailto:|#)/i.test(href) ? href : '#';
        if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        inline(m[4], a);
        frag.appendChild(a);
      } else if (m[6] !== undefined) {       // *italic*
        var i = el('em');
        inline(m[6], i);
        frag.appendChild(i);
      }
    }
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    return frag;
  }

  /* ==================== ブロック ==================== */

  function slugify(text, used) {
    var base = String(text).trim().toLowerCase()
      .replace(/[\s　]+/g, '-')
      .replace(/[^\wぁ-んァ-ヶ一-龠ー々a-z0-9-]/g, '')
      .replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sec';
    var s = base, i = 2;
    while (used[s]) { s = base + '-' + i++; }
    used[s] = true;
    return s;
  }

  /**
   * パイプ区切りを分割する。ただし [[ … ]] の内側のパイプは区切りとみなさない。
   * これがないと、表のセルに [[仏文|カナ|訳]] を書いた瞬間に列がずれる。
   */
  function splitPipes(text) {
    var out = [], buf = '', depth = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '[' && text[i + 1] === '[') { depth++; buf += '[['; i++; continue; }
      if (c === ']' && text[i + 1] === ']' && depth > 0) { depth--; buf += ']]'; i++; continue; }
      if (c === '|' && depth === 0) { out.push(buf); buf = ''; continue; }
      buf += c;
    }
    out.push(buf);
    return out;
  }

  function parseTableRow(line) {
    var t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return splitPipes(t).map(function (c) { return c.trim(); });
  }
  function isTableDivider(line) {
    return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
  }

  /* ---- 各ディレクティブの描画 ---- */

  function renderEx(title, lines) {
    var box = el('div', 'exblock');
    var items = lines.filter(function (l) { return l.trim(); }).map(function (l) {
      var p = splitPipes(l);
      return { fr: (p[0] || '').trim(), kana: (p[1] || '').trim(), ja: (p[2] || '').trim() };
    });

    var head = el('div', 'exblock-head');
    head.appendChild(el('span', 'ttl', title || '例文'));
    var all = FR.iconize(el('button', 'btn-mini', '通して聞く'), 'play', 11);
    all.type = 'button';
    all.dataset.playAll = '1';
    head.appendChild(all);
    box.appendChild(head);

    var ul = el('ul', 'exlist');
    items.forEach(function (it) {
      var li = el('li');
      li.dataset.fr = it.fr;

      var btn = el('button', 'playbtn');
      btn.type = 'button';
      btn.setAttribute('aria-label', it.fr + ' を発音');
      li.appendChild(btn);

      var body = el('div', 'ex-text');
      var frLine = el('div', 'ex-fr');
      inline(it.fr, frLine);
      body.appendChild(frLine);
      if (it.kana) body.appendChild(el('div', 'ex-kana', it.kana));
      if (it.ja) body.appendChild(el('div', 'ex-ja', it.ja));
      li.appendChild(body);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  function renderCallout(kind, title, lines) {
    var box = el('div', 'callout ' + kind);
    var meta = CALLOUT_LABEL[kind] || { fallback: '' };
    var head = el('div', 'callout-title');
    // 種別（要注意・発展など）を小さく置き、見出しがあればその後ろに続ける
    head.appendChild(el('span', 'callout-kind', meta.fallback));
    if (title) head.appendChild(el('span', 'callout-label', title));
    box.appendChild(head);
    blocks(lines, box, { used: {}, headings: [] });
    return box;
  }

  function renderQuiz(title, lines) {
    var wrap = doc.createDocumentFragment();
    var cur = null;

    function flush() { if (cur) { wrap.appendChild(cur.box); cur = null; } }

    lines.forEach(function (line) {
      var q = line.match(/^\s*Q[.．:：]\s*(.*)$/);
      var a = line.match(/^\s*A[.．:：]\s*(.*)$/);
      if (q) {
        flush();
        var box = el('div', 'quiz');
        var qp = el('div', 'quiz-q');
        inline(q[1], qp);
        box.appendChild(qp);

        var btn = el('button', 'quiz-reveal', '答えを見る');
        btn.type = 'button';
        box.appendChild(btn);

        var ans = el('div', 'quiz-a');
        ans.hidden = true;
        box.appendChild(ans);

        btn.addEventListener('click', function () {
          ans.hidden = !ans.hidden;
          btn.textContent = ans.hidden ? '答えを見る' : '答えを隠す';
        });
        cur = { box: box, ans: ans };
      } else if (a && cur) {
        var p = el('p');
        inline(a[1], p);
        cur.ans.appendChild(p);
      } else if (line.trim() && cur) {
        var p2 = el('p');
        inline(line, p2);
        cur.ans.appendChild(p2);
      }
    });
    flush();

    if (title) {
      var head = el('h3', null, title);
      var frag = doc.createDocumentFragment();
      frag.appendChild(head);
      frag.appendChild(wrap);
      return frag;
    }
    return wrap;
  }

  function renderVocab(title, lines) {
    var box = el('div', 'vocab');
    var head = el('div', 'vocab-head');
    head.appendChild(el('span', null, title || 'この章の語彙'));
    var all = FR.iconize(el('button', 'btn-mini', '通して聞く'), 'play', 11);
    all.type = 'button';
    all.dataset.playAll = '1';
    head.appendChild(all);
    box.appendChild(head);

    var ul = el('ul', 'vocab-list');
    lines.filter(function (l) { return l.trim(); }).forEach(function (l) {
      var p = splitPipes(l);
      var word = (p[0] || '').trim();
      var pos = (p[1] || '').trim();
      var mean = (p[2] || '').trim();

      var li = el('li');
      li.dataset.fr = word;
      var w = el('span', 'vocab-fr', word);
      w.dataset.fr = word;
      w.setAttribute('role', 'button');
      w.setAttribute('tabindex', '0');
      li.appendChild(w);
      if (pos) li.appendChild(el('span', 'vocab-pos', pos));
      if (mean) li.appendChild(el('span', 'vocab-ja', mean));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  function renderSolo(name, args) {
    // 依存モジュールは読み込み順の都合で、描画時点で解決する
    try {
      if (name === 'conj' && FR.conjTable) {
        var a = FR.conj.parseDirective(args);
        return FR.conjTable.render(a.verbs[0], a.tenses);
      }
      if (name === 'drill' && FR.drill) {
        var b = FR.conj.parseDirective(args);
        return FR.drill.embed({ verbs: b.verbs, tenses: b.tenses });
      }
      if (name === 'vmap' && FR.conjTable && FR.conjTable.renderMap) {
        return FR.conjTable.renderMap(args.trim());
      }
      if ((name === 'ai-gen' || name === 'ai-ask') && FR.aiPanel) {
        return FR.aiPanel.embedButton(name, args.trim());
      }
    } catch (e) {
      var err = el('div', 'callout warn');
      err.appendChild(el('div', 'callout-title', '表示できませんでした'));
      err.appendChild(el('p', null, name + ': ' + (e && e.message ? e.message : String(e))));
      return err;
    }
    return null;
  }

  /* ---- 本体 ---- */

  function blocks(lines, parent, ctx) {
    var i = 0;

    function flushList(type, items) {
      var list = el(type);
      items.forEach(function (item) {
        var li = el('li');
        inline(item.text, li);
        if (item.children.length) {
          // 入れ子は素朴に、同じ関数へ委譲する
          blocks(item.children, li, ctx);
        }
        list.appendChild(li);
      });
      parent.appendChild(list);
    }

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      // 空行
      if (!trimmed) { i++; continue; }

      // ディレクティブ
      var dir = trimmed.match(/^:::([a-z-]+)\s*(.*)$/);
      if (dir) {
        var name = dir[1], args = dir[2];

        if (SOLO_DIRECTIVES[name]) {
          var solo = renderSolo(name, args);
          if (solo) parent.appendChild(solo);
          i++;
          continue;
        }

        if (BLOCK_DIRECTIVES[name]) {
          // 入れ子に対応する。:::deep の中に :::ex を置くことがあるので、
          // 深さを数えないと内側の ::: で外側まで閉じてしまう。
          var body = [];
          var depth = 1;
          i++;
          while (i < lines.length) {
            var cur = lines[i].trim();
            if (cur === ':::') {
              depth--;
              if (depth === 0) break;
            } else {
              var inner = cur.match(/^:::([a-z-]+)/);
              if (inner && BLOCK_DIRECTIVES[inner[1]]) depth++;
            }
            body.push(lines[i]);
            i++;
          }
          i++; // 閉じの ::: を読み飛ばす

          if (name === 'ex') parent.appendChild(renderEx(args, body));
          else if (name === 'quiz') parent.appendChild(renderQuiz(args, body));
          else if (name === 'vocab') parent.appendChild(renderVocab(args, body));
          else parent.appendChild(renderCallout(name, args, body));
          continue;
        }
      }

      // ::: で始まるのにここまで来た行（未知のディレクティブ、対応の取れていない閉じ ::: など）は
      // 読み飛ばす。ここで i を進めないと、下の段落処理が即 break して無限ループになる。
      if (trimmed.indexOf(':::') === 0) { i++; continue; }

      // 見出し
      var h = trimmed.match(/^(#{2,4})\s+(.*)$/);
      if (h) {
        var level = h[1].length;
        var node = el('h' + level);
        inline(h[2], node);
        var id = slugify(node.textContent, ctx.used);
        node.id = id;
        ctx.headings.push({ id: id, level: level, text: node.textContent });
        parent.appendChild(node);
        i++;
        continue;
      }

      // 水平線
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        parent.appendChild(el('hr'));
        i++;
        continue;
      }

      // 表
      if (trimmed.indexOf('|') !== -1 && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
        var headCells = parseTableRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim().indexOf('|') !== -1 && lines[i].trim()) {
          rows.push(parseTableRow(lines[i]));
          i++;
        }
        var wrap = el('div', 'table-wrap');
        var table = el('table');
        var thead = el('thead');
        var htr = el('tr');
        headCells.forEach(function (c) {
          var th = el('th');
          inline(c, th);
          htr.appendChild(th);
        });
        thead.appendChild(htr);
        table.appendChild(thead);

        var tbody = el('tbody');
        rows.forEach(function (r) {
          var tr = el('tr');
          r.forEach(function (c) {
            var td = el('td');
            inline(c, td);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        parent.appendChild(wrap);
        continue;
      }

      // 箇条書き（ネスト1段まで）
      var bullet = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (bullet) {
        var ordered = /\d/.test(bullet[2]);
        var items = [];
        var baseIndent = bullet[1].length;
        while (i < lines.length) {
          var bm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (!bm) {
            // 継続行（インデントされた本文）は直前の項目にぶら下げる
            if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
              items[items.length - 1].children.push(lines[i].replace(/^\s{2,}/, ''));
              i++;
              continue;
            }
            break;
          }
          if (bm[1].length > baseIndent && items.length) {
            items[items.length - 1].children.push(lines[i].slice(baseIndent + 2));
            i++;
            continue;
          }
          if (bm[1].length < baseIndent) break;
          items.push({ text: bm[3], children: [] });
          i++;
        }
        flushList(ordered ? 'ol' : 'ul', items);
        continue;
      }

      // 引用
      if (/^>\s?/.test(trimmed)) {
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        var bq = el('blockquote');
        blocks(quote, bq, ctx);
        parent.appendChild(bq);
        continue;
      }

      // 段落（次の空行 or ブロック開始まで）
      var para = [];
      while (i < lines.length) {
        var l = lines[i];
        if (!l.trim()) break;
        if (/^:::/.test(l.trim())) break;
        if (/^#{2,4}\s/.test(l.trim())) break;
        if (/^(\s*)([-*+]|\d+[.)])\s+/.test(l)) break;
        if (/^>\s?/.test(l.trim())) break;
        para.push(l.trim());
        i++;
      }
      if (para.length) {
        var p = el('p');
        if (para[0].indexOf('{lead}') === 0) {
          p.className = 'lead';
          para[0] = para[0].slice(6).trim();
        }
        inline(para.join(' '), p);
        parent.appendChild(p);
      }
    }
  }

  /* ==================== 公開 API ==================== */

  var markup = {
    /**
     * 原稿を DOM に変換する。
     * @param {string} src
     * @returns {{fragment: DocumentFragment, headings: Array<{id:string,level:number,text:string}>}}
     */
    parse: function (src) {
      var ctx = { used: {}, headings: [] };
      var frag = doc.createDocumentFragment();
      var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
      blocks(lines, frag, ctx);
      return { fragment: frag, headings: ctx.headings };
    },

    /** 原稿を要素に描画して、見出し一覧を返す */
    renderInto: function (target, src) {
      var out = markup.parse(src);
      target.textContent = '';
      target.appendChild(out.fragment);
      return out.headings;
    },

    inline: inline,
    frChip: frChip,
    el: el
  };

  /* ---- 発音のイベント委譲（全体で1つだけ張る） ---- */

  function speakFrom(node) {
    var host = node.closest('[data-fr]');
    if (!host || !FR.speech) return;
    var text = host.dataset.fr;
    if (!text) return;

    doc.querySelectorAll('.speaking').forEach(function (n) { n.classList.remove('speaking'); });
    host.classList.add('speaking');
    FR.speech.speak(text, {
      onend: function () { host.classList.remove('speaking'); }
    });
  }

  function playAllIn(container) {
    if (!FR.speech) return;
    var items = Array.prototype.slice.call(container.querySelectorAll('[data-fr]'))
      .filter(function (n) { return n.dataset.fr; });
    // 入れ子（li と その中の span）で二重にならないよう、最も外側だけ拾う
    items = items.filter(function (n) {
      return !items.some(function (o) { return o !== n && o.contains(n); });
    });
    var texts = items.map(function (n) { return n.dataset.fr; });

    FR.speech.speakSequence(texts, {
      onItem: function (idx) {
        items.forEach(function (n) { n.classList.remove('speaking'); });
        if (idx >= 0 && items[idx]) items[idx].classList.add('speaking');
      }
    });
  }

  if (doc) {
    doc.addEventListener('click', function (e) {
      var all = e.target.closest('[data-play-all]');
      if (all) {
        e.preventDefault();
        var host = all.closest('.exblock, .vocab, .conj');
        if (host) playAllIn(host);
        return;
      }
      var play = e.target.closest('.playbtn');
      if (play) { e.preventDefault(); speakFrom(play); return; }
      var chip = e.target.closest('.fr[data-fr], .vocab-fr[data-fr]');
      if (chip) { speakFrom(chip); }
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var chip = e.target.closest && e.target.closest('.fr[data-fr], .vocab-fr[data-fr]');
      if (chip) { e.preventDefault(); speakFrom(chip); }
    });
  }

  markup.playAllIn = playAllIn;
  markup.speakFrom = speakFrom;

  FR.markup = markup;

}(typeof window !== 'undefined' ? window : globalThis));
