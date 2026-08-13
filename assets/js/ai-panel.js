/* ai-panel.js — Gemini を使った4つの学習機能の UI
 *
 *   1. 文法質問チャット   … 今読んでいる章の本文を文脈として渡す
 *   2. 例文の自動生成     … その章の文法項目を使った例文を、テーマと難易度を指定して作る
 *   3. 作文添削           … 自分で書いた仏文を、その章の文法に照らして直してもらう
 *   4. 活用ドリルの解説   … なぜその活用形になるのかを個別に説明させる
 *
 * AI の出力は必ず FR.markup を通して描画する。文字列を innerHTML に流し込む箇所は無い。
 * また出力に [[仏文|カナ|訳]] 記法を使わせることで、AI が作った例文もクリックで発音できる。
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

  var context = { id: '', no: '', title: '', body: '', index: 0 };
  var history = [];
  var busy = false;
  var controller = null;

  /* ---------- 共通のシステムプロンプト ---------- */

  var BASE_ROLE =
    'あなたは日本語話者にフランス語を教える、大学のフランス語教員です。\n' +
    '回答のきまり:\n' +
    '- 日本語で答える。文法用語は日本語とフランス語を併記する（例: 直説法半過去 / l\'imparfait）。\n' +
    '- フランス語を書くときは必ず [[仏文|カナ読み|和訳]] の記法を使う。この3つを必ず埋める。\n' +
    '  例: [[Je chante.|ジュ・シャント|私は歌う。]]\n' +
    '  カナ読みは日本語話者向けの近似でよい。リエゾンがあれば反映する。\n' +
    '- 見出しは ## か ###、強調は **…**、表は Markdown の表を使う。\n' +
    '- 規則を述べるときは、条件と適用範囲、例外があればそれも書く。「とりあえずこう覚える」で終わらせない。\n' +
    '- 学習者が実際に迷う対立（半過去 vs 複合過去、qui vs que など）は、対比の形で説明する。\n' +
    '- 冗長な前置きや自己紹介はしない。答えから書き始める。';

  function chapterContext() {
    if (!context.title) return '';
    var body = context.body || '';
    // 章が長いので、送るのは冒頭のまとまった量に限る（トークン節約）
    if (body.length > 9000) body = body.slice(0, 9000) + '\n…（以下略）';
    return '\n\n---\n学習者が今読んでいる教材の本文です。質問はこの内容についてのものです。\n' +
      '# 第' + context.no + '章 ' + context.title + '\n' + body + '\n---\n';
  }

  function systemPrompt(extra) {
    return BASE_ROLE + (extra ? '\n' + extra : '') + chapterContext();
  }

  /* ---------- 出力の描画 ---------- */

  /** ストリーム中の再描画を間引くための、遅延つきレンダラ */
  function makeRenderer(target) {
    var pending = null;
    var timer = null;

    function flush() {
      timer = null;
      if (pending == null) return;
      var out = FR.markup.parse(pending);
      target.textContent = '';
      target.appendChild(out.fragment);
      pending = null;
    }

    return {
      update: function (text) {
        pending = text;
        if (!timer) timer = setTimeout(flush, 90);
      },
      finish: function (text) {
        pending = text;
        if (timer) { clearTimeout(timer); timer = null; }
        flush();
        target.classList.remove('typing');
      },
      start: function () { target.classList.add('typing'); }
    };
  }

  /** 生成された例文に「マイ例文に保存」ボタンを足す */
  function addSaveButtons(root) {
    root.querySelectorAll('.exlist li[data-fr]').forEach(function (li) {
      if (li.querySelector('.save-phrase')) return;
      var b = el('button', 'btn-mini save-phrase', '⭐︎ 保存');
      b.type = 'button';
      b.style.alignSelf = 'center';
      b.addEventListener('click', function () {
        var kana = li.querySelector('.ex-kana');
        var ja = li.querySelector('.ex-ja');
        FR.store.phrases.add({
          fr: li.dataset.fr,
          kana: kana ? kana.textContent : '',
          ja: ja ? ja.textContent : '',
          chapter: context.title
        });
        b.textContent = '⭐ 保存済み';
        b.disabled = true;
      });
      li.appendChild(b);
    });
  }

  /* ---------- チャットパネル ---------- */

  var panel, panelBody, panelForm, input, sendBtn, ctxLabel;

  function ensureRefs() {
    if (panel) return;
    panel = doc.getElementById('aipanel');
    panelBody = doc.getElementById('aipanel-body');
    panelForm = doc.getElementById('aipanel-form');
    input = doc.getElementById('ai-input');
    sendBtn = doc.getElementById('ai-send');
    ctxLabel = doc.getElementById('aipanel-ctx');
    if (!panel) return;

    panelForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = '';
      input.style.height = '';
      send(text);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        panelForm.requestSubmit();
      }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });

    doc.getElementById('btn-ai-close').addEventListener('click', close);
  }

  function open() {
    ensureRefs();
    if (!panel) return;
    panel.hidden = false;
    var scrim = doc.getElementById('scrim');
    if (global.innerWidth < 860 && scrim) scrim.hidden = false;
    doc.getElementById('btn-ai').setAttribute('aria-expanded', 'true');
    setTimeout(function () { if (input) input.focus(); }, 50);
  }

  function close() {
    ensureRefs();
    if (!panel) return;
    panel.hidden = true;
    var scrim = doc.getElementById('scrim');
    if (scrim) scrim.hidden = true;
    doc.getElementById('btn-ai').setAttribute('aria-expanded', 'false');
    if (controller) { controller.abort(); controller = null; busy = false; }
  }

  function isOpen() { ensureRefs(); return panel && !panel.hidden; }

  /* ---------- 画面の初期状態 ---------- */

  function renderEmpty() {
    ensureRefs();
    if (!panelBody) return;
    panelBody.textContent = '';

    if (!FR.gemini.hasKey()) {
      var box = el('div', 'ai-empty');
      box.appendChild(el('p', null, 'AI 機能を使うには、Gemini の API キーが必要です。'));
      var a = el('a', null, '設定画面でキーを登録する →');
      a.href = '#/settings';
      a.addEventListener('click', close);
      box.appendChild(a);
      var note = el('p', null, 'キーは Google AI Studio で無料で取得できます。このブラウザの中だけに保存され、どこにも送信されません。');
      note.style.fontSize = '12px';
      note.style.marginTop = '14px';
      box.appendChild(note);
      panelBody.appendChild(box);
      return;
    }

    var empty = el('div', 'ai-empty');
    empty.appendChild(el('p', null,
      context.title ? '「第' + context.no + '章 ' + context.title + '」について質問できます。'
                    : 'フランス語の文法について質問できます。'));

    var sug = el('div', 'ai-suggest');
    suggestions().forEach(function (s) {
      var b = el('button', null, s);
      b.type = 'button';
      b.addEventListener('click', function () { send(s); });
      sug.appendChild(b);
    });
    empty.appendChild(sug);
    panelBody.appendChild(empty);
  }

  function suggestions() {
    if (context.title) {
      return [
        'この章で一番つまずきやすいところはどこ？',
        'この章の内容を使った例文を5つ作って',
        'この章の規則で、例外があるものを整理して',
        'この章の内容を確認する小テストを作って'
      ];
    }
    return [
      '半過去と複合過去の使い分けを教えて',
      'qui と que の違いを例文で説明して',
      '接続法はどんなときに使うの？'
    ];
  }

  /* ---------- 送信 ---------- */

  function appendMessage(role, text) {
    var msg = el('div', 'msg ' + role);
    msg.appendChild(el('div', 'msg-role', role === 'user' ? 'あなた' : role === 'err' ? 'エラー' : 'AI'));
    var body = el('div', 'msg-body');
    if (role === 'ai') {
      // 後からストリームで埋める
    } else {
      body.textContent = text;
    }
    msg.appendChild(body);
    panelBody.appendChild(msg);
    panelBody.scrollTop = panelBody.scrollHeight;
    return body;
  }

  function setBusy(v) {
    busy = v;
    if (sendBtn) {
      sendBtn.disabled = v;
      sendBtn.textContent = v ? '…' : '送信';
    }
  }

  function send(text, opts) {
    ensureRefs();
    opts = opts || {};
    if (busy) return;

    if (!FR.gemini.hasKey()) { renderEmpty(); return; }

    // 初回はプレースホルダを消す
    var placeholder = panelBody.querySelector('.ai-empty');
    if (placeholder) placeholder.remove();

    appendMessage('user', text);
    history.push({ role: 'user', text: text });

    var target = appendMessage('ai', '');
    var renderer = makeRenderer(target);
    renderer.start();

    setBusy(true);
    controller = new AbortController();

    FR.gemini.ask({
      system: systemPrompt(opts.extraSystem),
      // 直近の数往復だけ送る（章の本文が大きいのでトークンを節約する）
      messages: history.slice(-6),
      temperature: opts.temperature,
      onToken: function (delta, full) {
        renderer.update(full);
        panelBody.scrollTop = panelBody.scrollHeight;
      },
      signal: controller.signal
    }).then(function (full) {
      renderer.finish(full);
      addSaveButtons(target);
      history.push({ role: 'model', text: full });
      panelBody.scrollTop = panelBody.scrollHeight;
    }).catch(function (err) {
      if (err && err.name === 'AbortError') { target.parentNode.remove(); return; }
      target.parentNode.remove();
      appendMessage('err', err && err.message ? err.message : String(err));
    }).then(function () {
      setBusy(false);
      controller = null;
    });
  }

  /* ---------- 章の切り替え ---------- */

  function setContext(ch) {
    var changed = context.id !== (ch && ch.id);
    context = {
      id: ch ? ch.id : '',
      no: ch ? ch.no : '',
      title: ch ? ch.title : '',
      body: ch ? ch.body : '',
      index: ch ? ch.index || 0 : 0
    };
    ensureRefs();
    if (ctxLabel) ctxLabel.textContent = context.title ? '第' + context.no + '章 ' + context.title : '';
    if (changed) {
      history = [];
      renderEmpty();
    }
  }

  /* ---------- 章の中に置くボタン ---------- */

  /** :::ai-gen / :::ai-ask から呼ばれる */
  function embedButton(kind, arg) {
    var wrap = el('div', 'aitools');
    var out = el('div', 'ai-out');

    if (kind === 'ai-ask') {
      var ask = el('button', 'aitool', '✨ ' + (arg || 'この章について質問する'));
      ask.type = 'button';
      ask.addEventListener('click', function () {
        open();
        if (arg) send(arg);
      });
      wrap.appendChild(ask);
      return wrap;
    }

    // ai-gen: 例文生成
    var topic = arg || (context.title || 'この章の文法');

    var gen = el('button', 'aitool', '✨ この文法の例文を作ってもらう');
    gen.type = 'button';
    wrap.appendChild(gen);

    var check = el('button', 'aitool', '📝 自分の作文を添削してもらう');
    check.type = 'button';
    wrap.appendChild(check);

    var frag = doc.createDocumentFragment();
    frag.appendChild(wrap);
    frag.appendChild(out);

    gen.addEventListener('click', function () { showGenerator(out, topic, gen); });
    check.addEventListener('click', function () { showCorrector(out, topic, check); });

    return frag;
  }

  /* ---------- 例文の自動生成 ---------- */

  function showGenerator(out, topic, trigger) {
    if (!FR.gemini.hasKey()) { out.textContent = ''; out.appendChild(keyNotice()); return; }

    out.textContent = '';
    var card = el('div', 'card');
    card.appendChild(el('h2', null, '例文を作る'));

    var themeField = el('label', 'field');
    themeField.appendChild(el('span', null, 'テーマ'));
    var theme = doc.createElement('select');
    ['日常会話', 'カフェ・レストラン', '旅行', '買い物', '大学・仕事', '恋愛', '天気・季節', '自己紹介']
      .forEach(function (t) {
        var o = doc.createElement('option');
        o.value = t; o.textContent = t;
        theme.appendChild(o);
      });
    themeField.appendChild(theme);
    card.appendChild(themeField);

    var levelField = el('label', 'field');
    levelField.appendChild(el('span', null, '難易度'));
    var level = doc.createElement('select');
    [['やさしい', '短く、基本語彙だけ'], ['ふつう', '実際の会話で使える長さ'], ['難しい', '複文や書き言葉も含む']]
      .forEach(function (t) {
        var o = doc.createElement('option');
        o.value = t[0]; o.textContent = t[0] + '（' + t[1] + '）';
        level.appendChild(o);
      });
    level.selectedIndex = 1;
    levelField.appendChild(level);
    card.appendChild(levelField);

    var countField = el('label', 'field');
    countField.appendChild(el('span', null, '本数'));
    var count = doc.createElement('select');
    [3, 5, 8, 10].forEach(function (n) {
      var o = doc.createElement('option');
      o.value = String(n); o.textContent = n + '本';
      count.appendChild(o);
    });
    count.selectedIndex = 1;
    countField.appendChild(count);
    card.appendChild(countField);

    var go = el('button', 'btn btn-primary', '作ってもらう');
    go.type = 'button';
    card.appendChild(go);

    var result = el('div');
    result.style.marginTop = '14px';
    card.appendChild(result);

    out.appendChild(card);

    go.addEventListener('click', function () {
      if (busy) return;
      go.disabled = true;
      go.textContent = '作成中…';
      result.textContent = '';
      var renderer = makeRenderer(result);
      renderer.start();

      var prompt =
        '次の条件で、フランス語の例文を作ってください。\n' +
        '- 使う文法項目: ' + topic + '\n' +
        '- テーマ: ' + theme.value + '\n' +
        '- 難易度: ' + level.value + '\n' +
        '- 本数: ' + count.value + '本\n\n' +
        '出力の形式は、必ず次の例文ブロックにしてください（前置きは不要）。\n' +
        ':::ex ' + topic + 'の例文\n' +
        '仏文 | カナ読み | 和訳\n' +
        '仏文 | カナ読み | 和訳\n' +
        ':::\n\n' +
        'そのあとに、文法項目がどこに現れているかの短い解説を箇条書きで付けてください。';

      setBusy(true);
      controller = new AbortController();
      FR.gemini.ask({
        system: systemPrompt('例文はすべて文法的に正しく、実際にフランス語話者が使う自然な表現にしてください。'),
        messages: [{ role: 'user', text: prompt }],
        temperature: 0.9,
        onToken: function (d, full) { renderer.update(full); },
        signal: controller.signal
      }).then(function (full) {
        renderer.finish(full);
        addSaveButtons(result);
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        result.textContent = '';
        result.appendChild(errorBox(err));
      }).then(function () {
        setBusy(false);
        controller = null;
        go.disabled = false;
        go.textContent = 'もう一度作る';
      });
    });
  }

  /* ---------- 作文添削 ---------- */

  function showCorrector(out, topic, trigger) {
    if (!FR.gemini.hasKey()) { out.textContent = ''; out.appendChild(keyNotice()); return; }

    out.textContent = '';
    var card = el('div', 'card');
    card.appendChild(el('h2', null, '作文を添削してもらう'));
    card.appendChild(el('p', 'hint',
      'この章の文法（' + topic + '）を使って書いた文を入れてください。誤りの指摘・修正・理由を返します。'));

    var ta = doc.createElement('textarea');
    ta.rows = 4;
    ta.placeholder = '例: Hier, je suis allé au cinéma avec mes amis.';
    ta.style.width = '100%';
    ta.style.padding = '9px 11px';
    ta.style.font = 'inherit';
    ta.style.background = 'var(--bg-soft)';
    ta.style.color = 'var(--text)';
    ta.style.border = '1px solid var(--border)';
    ta.style.borderRadius = 'var(--radius-sm)';
    ta.style.marginBottom = '10px';
    card.appendChild(ta);

    var go = el('button', 'btn btn-primary', '添削してもらう');
    go.type = 'button';
    card.appendChild(go);

    var result = el('div');
    result.style.marginTop = '14px';
    card.appendChild(result);
    out.appendChild(card);

    go.addEventListener('click', function () {
      var text = ta.value.trim();
      if (!text || busy) return;
      go.disabled = true;
      go.textContent = '添削中…';
      result.textContent = '';
      var renderer = makeRenderer(result);
      renderer.start();

      var prompt =
        '次のフランス語の文を添削してください。\n\n' +
        '【学習者が書いた文】\n' + text + '\n\n' +
        '出力の形式:\n' +
        '## 判定\n' +
        '正しい／直したほうがよい点がある、のどちらかを一言で。\n' +
        '## 修正後\n' +
        ':::ex 修正後\n' +
        '修正した仏文 | カナ読み | 和訳\n' +
        ':::\n' +
        '## 指摘\n' +
        '誤りごとに「どこが → どう直す → なぜそうなるのか」の3点を箇条書きで。' +
        '「なぜ」では文法規則の名前を挙げ、この章（' + topic + '）との関係にも触れてください。\n' +
        '## もっと自然にするなら\n' +
        '文法的には正しいがフランス語として不自然な箇所があれば、代案を挙げてください。無ければ「特になし」。\n\n' +
        '誤りが1つも無い場合も、その旨をはっきり伝えてから、より自然な言い回しの案を示してください。';

      setBusy(true);
      controller = new AbortController();
      FR.gemini.ask({
        system: systemPrompt('添削では推測で書き換えず、学習者の意図を尊重してください。誤りでないものを誤りとしないこと。'),
        messages: [{ role: 'user', text: prompt }],
        temperature: 0.25,
        onToken: function (d, full) { renderer.update(full); },
        signal: controller.signal
      }).then(function (full) {
        renderer.finish(full);
        addSaveButtons(result);
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        result.textContent = '';
        result.appendChild(errorBox(err));
      }).then(function () {
        setBusy(false);
        controller = null;
        go.disabled = false;
        go.textContent = 'もう一度添削する';
      });
    });
  }

  /* ---------- ドリルの誤答解説 ---------- */

  function explainDrill(q) {
    open();
    if (!FR.gemini.hasKey()) { renderEmpty(); return; }

    var line = FR.conj.line(q.verb, q.tense, q.person) || q.answer;
    var weak = FR.store ? FR.store.drill.weakest(8) : [];
    var pattern = weak.length
      ? '\n\n参考: この学習者が繰り返し間違えている項目は次のとおりです。共通する誤りの傾向があれば指摘してください。\n' +
        weak.map(function (w) {
          var p = w.key.split('|');
          var t = FR.conj.tense(p[1]);
          return '- ' + p[0] + ' / ' + (t ? t.ja : p[1]) + '（誤答' + w.e.wrong + '回）';
        }).join('\n')
      : '';

    var prompt =
      '活用ドリルで間違えました。なぜこの形になるのかを説明してください。\n\n' +
      '- 動詞: ' + q.verb + '（' + (q.info && q.info.ja ? q.info.ja : '') + '）\n' +
      '- 時制: ' + q.tenseInfo.ja + ' / ' + q.tenseInfo.fr + '\n' +
      '- 人称: ' + q.pronoun + '\n' +
      '- 正解: ' + line + '\n\n' +
      '説明してほしいこと:\n' +
      '1. この形がどの語幹とどの語尾でできているか\n' +
      '2. その語幹はどこから来るのか（不定詞か、現在形の nous か ils か、など）\n' +
      '3. 間違えやすいポイントと、覚えるためのコツ\n' +
      '4. この形を使った短い例文を2つ' + pattern;

    var placeholder = panelBody.querySelector('.ai-empty');
    if (placeholder) placeholder.remove();
    history.push({ role: 'user', text: 'なぜ ' + line + ' になるの？' });
    appendMessage('user', 'なぜ ' + line + ' になるの？');

    var target = appendMessage('ai', '');
    var renderer = makeRenderer(target);
    renderer.start();
    setBusy(true);
    controller = new AbortController();

    FR.gemini.ask({
      system: systemPrompt('活用の説明では「語幹 × 語尾」の分解を必ず示してください。'),
      messages: [{ role: 'user', text: prompt }],
      temperature: 0.4,
      onToken: function (d, full) {
        renderer.update(full);
        panelBody.scrollTop = panelBody.scrollHeight;
      },
      signal: controller.signal
    }).then(function (full) {
      renderer.finish(full);
      history.push({ role: 'model', text: full });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') { target.parentNode.remove(); return; }
      target.parentNode.remove();
      appendMessage('err', err && err.message ? err.message : String(err));
    }).then(function () {
      setBusy(false);
      controller = null;
    });
  }

  /* ---------- 補助 ---------- */

  function keyNotice() {
    var box = el('div', 'callout note');
    box.appendChild(el('div', 'callout-title', '🔑 API キーが必要です'));
    var p = el('p');
    p.appendChild(doc.createTextNode('AI 機能を使うには Gemini の API キーを登録してください。'));
    var a = el('a', null, '設定画面へ');
    a.href = '#/settings';
    p.appendChild(doc.createTextNode(' '));
    p.appendChild(a);
    box.appendChild(p);
    return box;
  }

  function errorBox(err) {
    var box = el('div', 'callout warn');
    box.appendChild(el('div', 'callout-title', '⚠️ うまくいきませんでした'));
    box.appendChild(el('p', null, err && err.message ? err.message : String(err)));
    return box;
  }

  FR.aiPanel = {
    open: open,
    close: close,
    isOpen: isOpen,
    setContext: setContext,
    send: send,
    embedButton: embedButton,
    explainDrill: explainDrill,
    renderEmpty: renderEmpty
  };

}(typeof window !== 'undefined' ? window : globalThis));
