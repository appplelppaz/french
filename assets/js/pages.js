/* pages.js — 章以外の画面（ホーム／動詞活用表／マイ例文／設定） */
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

  /* ==================== ホーム ==================== */

  function home() {
    var wrap = el('div', 'page');

    var hero = el('div', 'home-hero');
    var h1 = el('h1');
    h1.appendChild(el('span', 'fr-title', 'Grammaire française'));
    h1.appendChild(doc.createElement('br'));
    h1.appendChild(doc.createTextNode('フランス語文法テキスト'));
    hero.appendChild(h1);
    hero.appendChild(el('p', null,
      '入門から接続法まで、全32章。文法は大学レベルの詳しさで書いてあります。' +
      'フランス語はどこをクリックしても発音が鳴り、動詞の活用は表を見るだけでなくドリルで練習できます。' +
      '分からないところは AI にその場で質問できます。'));
    wrap.appendChild(hero);

    var grid = el('div', 'home-grid');

    function card(href, iconName, title, desc) {
      var a = el('a', 'home-card');
      a.href = href;
      var ic = el('div', 'ic');
      if (FR.icon) ic.appendChild(FR.icon(iconName, 22));
      a.appendChild(ic);
      a.appendChild(el('div', 't', title));
      a.appendChild(el('div', 'd', desc));
      return a;
    }

    var first = FR.toc && FR.toc.length ? FR.toc[0] : null;
    var done = FR.store ? FR.store.progress.count() : 0;
    var total = FR.toc ? FR.toc.length : 0;
    var next = null;
    if (FR.toc) {
      for (var i = 0; i < FR.toc.length; i++) {
        if (!FR.store.progress.isDone(FR.toc[i].id)) { next = FR.toc[i]; break; }
      }
    }

    grid.appendChild(card(
      next ? '#/' + next.id : (first ? '#/' + first.id : '#/'),
      'book',
      done ? '続きから読む' : '第0章から始める',
      next ? ('第' + next.no + '章 ' + next.title) : 'すべての章を読み終えています'
    ));
    grid.appendChild(card('#/drill', 'target', '活用ドリル',
      '動詞と時制を選んで反復練習。間違えた項目は記録され、優先的に出題されます。'));
    grid.appendChild(card('#/verbs', 'grid', '動詞活用表',
      '全時制の活用表。どのセルもクリックで発音が鳴ります。'));
    grid.appendChild(card('#/settings', 'gear', '設定',
      '読み上げの声と速さ、AI 機能の API キーを設定します。'));
    wrap.appendChild(grid);

    /* 進捗 */
    if (total) {
      var prog = el('div', 'card');
      prog.appendChild(el('h2', null, '学習の進捗'));
      prog.appendChild(el('p', null, total + '章のうち ' + done + '章を読了。'));
      var bar = el('div');
      bar.style.height = '8px';
      bar.style.background = 'var(--surface-2)';
      bar.style.borderRadius = '999px';
      bar.style.overflow = 'hidden';
      var fill = el('div');
      fill.style.height = '100%';
      fill.style.width = Math.round(done / total * 100) + '%';
      fill.style.background = 'var(--accent)';
      bar.appendChild(fill);
      prog.appendChild(bar);
      wrap.appendChild(prog);
    }

    /* 使い方 */
    var how = el('div', 'card');
    how.appendChild(el('h2', null, 'この教材の使い方'));
    var ul = el('ul');
    [
      '本文中の赤いフランス語は、クリックすると発音が鳴ります。例文ブロックは「通して聞く」でまとめて再生できます。',
      '活用表では「語幹と語尾」を押すと色分けされ、「同じ音」を押すと、綴りが違うのに発音が同じ行に印が付きます。',
      '章の終わりにある練習問題は、答えが隠れています。自分で考えてから開いてください。',
      '右上の星印を押すと AI パネルが開きます。今読んでいる章の内容を踏まえて答えてくれます。'
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    how.appendChild(ul);
    wrap.appendChild(how);

    return wrap;
  }

  /* ==================== 動詞活用表 ==================== */

  function verbs() {
    var wrap = el('div', 'page');
    wrap.appendChild(el('h1', null, '動詞活用表'));
    wrap.appendChild(el('p', null, '動詞を選ぶと、全時制の活用表を表示します。どのセルもクリックで発音が鳴ります。'));

    var card = el('div', 'card');

    var field = el('label', 'field');
    field.appendChild(el('span', null, '動詞'));
    var sel = doc.createElement('select');
    var groups = [
      { label: '不規則動詞', list: FR.conj.list('irregular') },
      { label: '規則動詞', list: FR.conj.list('regular') },
      { label: '代名動詞', list: FR.conj.list('pronominal') }
    ];
    groups.forEach(function (g) {
      var og = doc.createElement('optgroup');
      og.label = g.label;
      g.list.forEach(function (v) {
        var info = FR.conj.info(v);
        var o = doc.createElement('option');
        o.value = v;
        o.textContent = v + (info && info.ja ? '  —  ' + info.ja : '');
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.value = 'être';
    field.appendChild(sel);
    card.appendChild(field);
    wrap.appendChild(card);

    var out = el('div');
    wrap.appendChild(out);

    var ALL = ['present', 'passeCompose', 'imparfait', 'plusQueParfait', 'futur', 'futurAnterieur',
               'conditionnel', 'conditionnelPasse', 'subjonctif', 'subjonctifPasse', 'imperatif', 'passeSimple'];

    function show() {
      out.textContent = '';
      var v = sel.value;
      var info = FR.conj.info(v);
      if (info) {
        var summary = el('div', 'card');
        summary.appendChild(el('h2', null, v + (info.ja ? '（' + info.ja + '）' : '')));
        var dl = el('ul');
        [
          ['グループ', info.group === 1 ? '第1群 -er' : info.group === 2 ? '第2群 -ir（-iss-）' : '第3群'],
          ['助動詞', info.aux + (info.aux === 'être' ? '（過去分詞が主語と性数一致する）' : '')],
          ['過去分詞', info.pp],
          ['現在分詞', info.presP || '—'],
          ['未来語幹', info.futStem + '-（単純未来と条件法現在の両方に使う）'],
          ['半過去語幹', (info.impfStem || '—') + '-'],
          ['接続法語幹', info.subjStem ? info.subjStem + '-' : '（不規則）']
        ].forEach(function (row) {
          var li = el('li');
          li.appendChild(el('strong', null, row[0] + '：'));
          li.appendChild(doc.createTextNode(' ' + row[1]));
          dl.appendChild(li);
        });
        summary.appendChild(dl);
        if (info.note) {
          var n = el('div', 'callout note');
          n.appendChild(el('div', 'callout-title', 'ポイント'));
          n.appendChild(el('p', null, info.note));
          summary.appendChild(n);
        }
        out.appendChild(summary);
      }
      out.appendChild(FR.conjTable.render(v, ALL));
    }

    sel.addEventListener('change', show);
    show();
    return wrap;
  }

  /* ==================== マイ例文 ==================== */

  function myPhrases() {
    var wrap = el('div', 'page');
    wrap.appendChild(el('h1', null, 'マイ例文'));
    wrap.appendChild(el('p', null, 'AI が作った例文のうち、保存したものがここに並びます。'));

    var list = FR.store.phrases.all();
    if (!list.length) {
      wrap.appendChild(el('p', 'empty',
        'まだ保存された例文はありません。章の中の「例文を作ってもらう」で作った例文に、保存ボタンが付きます。'));
      return wrap;
    }

    var box = el('div', 'exblock');
    var head = el('div', 'exblock-head');
    head.appendChild(el('span', 'ttl', list.length + '件'));
    var all = FR.iconize(el('button', 'btn-mini', '通して聞く'), 'play', 11);
    all.type = 'button';
    all.dataset.playAll = '1';
    head.appendChild(all);
    box.appendChild(head);

    var ul = el('ul', 'exlist');
    list.forEach(function (p) {
      var li = el('li');
      li.dataset.fr = p.fr;

      var play = el('button', 'playbtn');
      play.type = 'button';
      play.setAttribute('aria-label', p.fr + ' を発音');
      li.appendChild(play);

      var body = el('div', 'ex-text');
      body.appendChild(el('div', 'ex-fr', p.fr));
      if (p.kana) body.appendChild(el('div', 'ex-kana', p.kana));
      if (p.ja) body.appendChild(el('div', 'ex-ja', p.ja));
      if (p.chapter) {
        var src = el('div', 'ex-kana', '— ' + p.chapter);
        src.style.opacity = '.7';
        body.appendChild(src);
      }
      li.appendChild(body);

      var del = el('button', 'btn-mini', '削除');
      del.type = 'button';
      del.style.alignSelf = 'center';
      del.addEventListener('click', function () {
        FR.store.phrases.remove(p.fr);
        li.remove();
      });
      li.appendChild(del);

      ul.appendChild(li);
    });
    box.appendChild(ul);
    wrap.appendChild(box);
    return wrap;
  }

  /* ==================== 設定 ==================== */

  function settings() {
    var wrap = el('div', 'page');
    wrap.appendChild(el('h1', null, '設定'));

    /* --- 音声 --- */
    var voiceCard = el('div', 'card');
    voiceCard.appendChild(el('h2', null, '読み上げ'));

    if (!FR.speech.supported) {
      voiceCard.appendChild(el('p', 'hint', 'このブラウザは読み上げに対応していません。Chrome、Safari、Edge をお試しください。'));
    } else if (!FR.speech.isReady()) {
      var warn = el('div', 'callout warn');
      warn.appendChild(el('div', 'callout-title', 'フランス語の音声が見つかりません'));
      warn.appendChild(el('p', null, 'お使いの端末にフランス語の読み上げ音声が入っていないようです。次の手順で追加できます。'));
      var ul = el('ul');
      [
        'Windows: 設定 → 時刻と言語 → 言語と地域 → 言語の追加 →「フランス語」→ 音声認識・音声合成にチェック',
        'macOS: システム設定 → アクセシビリティ → 読み上げコンテンツ → システムの声 → 「フランス語」を追加',
        'iPhone / iPad: 設定 → アクセシビリティ → 読み上げコンテンツ → 声 → フランス語',
        'Android: 設定 → システム → 言語と入力 → テキスト読み上げ → 言語データのインストール'
      ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
      warn.appendChild(ul);
      warn.appendChild(el('p', null, '音声が無くても、本文・活用表・ドリル・AI 機能はすべて使えます。'));
      voiceCard.appendChild(warn);
    }

    var voiceField = el('label', 'field');
    voiceField.appendChild(el('span', null, '声'));
    var voiceSel = doc.createElement('select');
    voiceField.appendChild(voiceSel);
    voiceCard.appendChild(voiceField);

    function fillVoices() {
      voiceSel.textContent = '';
      var list = FR.speech.listVoices();
      if (!list.length) {
        var o = doc.createElement('option');
        o.textContent = '（フランス語の声がありません）';
        voiceSel.appendChild(o);
        voiceSel.disabled = true;
        return;
      }
      voiceSel.disabled = false;
      var cur = FR.speech.currentVoice();
      list.forEach(function (v) {
        var o = doc.createElement('option');
        o.value = v.voiceURI;
        o.textContent = v.name + '（' + v.lang + '）' + (v.localService ? '' : ' — オンライン');
        if (cur && v.voiceURI === cur.voiceURI) o.selected = true;
        voiceSel.appendChild(o);
      });
    }
    fillVoices();
    FR.speech.onVoicesChanged(fillVoices);
    voiceSel.addEventListener('change', function () { FR.speech.setVoice(voiceSel.value); });

    var rateField = el('label', 'field');
    var rateLabel = el('span', null, '速さ');
    var rateOut = el('output');
    rateOut.style.marginLeft = '6px';
    rateLabel.appendChild(rateOut);
    rateField.appendChild(rateLabel);
    var rate = doc.createElement('input');
    rate.type = 'range';
    rate.min = '0.5'; rate.max = '1.2'; rate.step = '0.05';
    rate.value = String(FR.speech.getRate());
    rateOut.textContent = '× ' + rate.value;
    rate.addEventListener('input', function () {
      FR.speech.setRate(rate.value);
      rateOut.textContent = '× ' + rate.value;
    });
    rateField.appendChild(rate);
    voiceCard.appendChild(rateField);

    var test = el('button', 'btn', '試聴');
    test.type = 'button';
    test.addEventListener('click', function () {
      FR.speech.speak("Bonjour, je m'appelle Marie. J'apprends le français depuis deux ans.");
    });
    voiceCard.appendChild(test);
    wrap.appendChild(voiceCard);

    /* --- テーマ --- */
    var themeCard = el('div', 'card');
    themeCard.appendChild(el('h2', null, '表示'));
    var themeField = el('label', 'field');
    themeField.appendChild(el('span', null, 'テーマ'));
    var themeSel = doc.createElement('select');
    [['dark', 'ダーク（既定）'], ['light', 'ライト'], ['auto', '端末の設定に合わせる']].forEach(function (t) {
      var o = doc.createElement('option');
      o.value = t[0]; o.textContent = t[1];
      if (FR.store.settings.get('theme') === t[0]) o.selected = true;
      themeSel.appendChild(o);
    });
    themeSel.addEventListener('change', function () {
      FR.store.settings.set('theme', themeSel.value);
      FR.app.applyTheme();
    });
    themeField.appendChild(themeSel);
    themeCard.appendChild(themeField);
    wrap.appendChild(themeCard);

    /* --- AI --- */
    var aiCard = el('div', 'card');
    aiCard.appendChild(el('h2', null, 'AI 機能（Gemini）'));
    aiCard.appendChild(el('p', 'hint',
      '文法の質問、例文の生成、作文の添削、活用ドリルの解説に Gemini を使います。' +
      'ご自身の API キーが必要です。'));

    var steps = el('ol');
    [
      'Google AI Studio（aistudio.google.com/apikey）でAPIキーを作成する（無料枠があります）',
      '作成したキーを下の欄に貼り付けて「保存」を押す',
      'キーはこのブラウザの中にだけ保存されます。リポジトリにも、こちらのサーバーにも送られません'
    ].forEach(function (t) { steps.appendChild(el('li', null, t)); });
    aiCard.appendChild(steps);

    var link = el('p');
    var a = el('a', null, 'Google AI Studio で API キーを作る →');
    a.href = 'https://aistudio.google.com/apikey';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    link.appendChild(a);
    aiCard.appendChild(link);

    var keyField = el('label', 'field');
    keyField.appendChild(el('span', null, 'Gemini API キー'));
    var keyInput = doc.createElement('input');
    keyInput.type = 'password';
    keyInput.autocomplete = 'off';
    keyInput.spellcheck = false;
    keyInput.placeholder = FR.gemini.hasKey() ? FR.gemini.maskedKey() : 'AIza…';
    keyField.appendChild(keyInput);
    aiCard.appendChild(keyField);

    var status = el('p', 'hint');
    function refreshStatus() {
      status.textContent = FR.gemini.hasKey()
        ? '✅ キーが登録されています（' + FR.gemini.maskedKey() + '）'
        : '未登録です。AI 機能は使えませんが、教材の他の機能はすべて動きます。';
    }
    refreshStatus();

    var save = el('button', 'btn btn-primary', '保存');
    save.type = 'button';
    save.addEventListener('click', function () {
      var v = keyInput.value.trim();
      if (!v) return;
      FR.gemini.setKey(v);
      keyInput.value = '';
      keyInput.placeholder = FR.gemini.maskedKey();
      refreshStatus();
      FR.aiPanel.renderEmpty();
      save.textContent = '保存しました';
      setTimeout(function () { save.textContent = '保存'; }, 1500);
    });
    aiCard.appendChild(save);

    var clear = el('button', 'btn', 'キーを削除');
    clear.type = 'button';
    clear.style.marginLeft = '8px';
    clear.addEventListener('click', function () {
      FR.gemini.clearKey();
      keyInput.value = '';
      keyInput.placeholder = 'AIza…';
      refreshStatus();
      FR.aiPanel.renderEmpty();
    });
    aiCard.appendChild(clear);
    aiCard.appendChild(status);

    var modelField = el('label', 'field');
    modelField.appendChild(el('span', null, 'モデル'));
    var modelSel = doc.createElement('select');
    FR.gemini.MODELS.forEach(function (m) {
      var o = doc.createElement('option');
      o.value = m.id; o.textContent = m.label;
      if (FR.gemini.model() === m.id) o.selected = true;
      modelSel.appendChild(o);
    });
    modelSel.addEventListener('change', function () { FR.gemini.setModel(modelSel.value); });
    modelField.appendChild(modelSel);
    aiCard.appendChild(modelField);

    var sec = el('div', 'callout note');
    sec.appendChild(el('div', 'callout-title', 'キーの扱いについて'));
    var sl = el('ul');
    [
      'キーはこのブラウザの localStorage にのみ保存されます。共有のパソコンで使う場合は、終わったら「キーを削除」を押してください。',
      '通信先は Google の API（generativelanguage.googleapis.com）だけです。',
      'GitHub Pages で公開している場合は、Google AI Studio 側でキーに HTTP リファラ制限をかけておくと安全です。'
    ].forEach(function (t) { sl.appendChild(el('li', null, t)); });
    sec.appendChild(sl);
    aiCard.appendChild(sec);

    wrap.appendChild(aiCard);

    /* --- 学習データ --- */
    var dataCard = el('div', 'card');
    dataCard.appendChild(el('h2', null, '学習データ'));
    var doneCount = FR.store.progress.count();
    var stats = FR.store.drill.stats();
    var drillCount = Object.keys(stats).reduce(function (s, k) { return s + stats[k].right + stats[k].wrong; }, 0);
    var dl = el('ul');
    dl.appendChild(el('li', null, '読了した章：' + doneCount + ' / ' + (FR.toc ? FR.toc.length : 0)));
    dl.appendChild(el('li', null, 'ドリルの解答数：' + drillCount));
    dl.appendChild(el('li', null, '保存した例文：' + FR.store.phrases.all().length));
    dataCard.appendChild(dl);
    if (!FR.store.isPersistent()) {
      dataCard.appendChild(el('p', 'hint',
        'このブラウザでは保存機能が使えないため、進捗はページを閉じると消えます（プライベートブラウズなど）。'));
    }
    wrap.appendChild(dataCard);

    return wrap;
  }

  FR.pages = {
    home: home,
    verbs: verbs,
    myPhrases: myPhrases,
    settings: settings
  };

}(typeof window !== 'undefined' ? window : globalThis));
