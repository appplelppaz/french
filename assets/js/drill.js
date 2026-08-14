/* drill.js — 活用ドリル
 *
 * 活用表を眺めるだけでは覚えられない。出力させて、間違えたところを記録して、
 * そこを優先的に出し直す——紙の教科書にできないのはここ。
 *
 *   ・入力式と4択式を切り替えられる
 *   ・アクセント記号を打ちにくい環境のために、入力補助と「惜しい」判定を持つ
 *   ・誤答は localStorage に残し、次回以降その項目を優先して出題する
 *   ・なぜその形になるのかを、AI に個別解説させられる
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var doc = global.document;

  var ACCENTS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ù', 'û', 'î', 'ï', 'ô', 'ç'];

  var DEFAULT_VERBS = ['être', 'avoir', 'aller', 'faire', 'parler', 'finir', 'prendre', 'venir', 'pouvoir', 'vouloir'];
  var DEFAULT_TENSES = ['present'];

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function keyOf(verb, tense, person) { return verb + '|' + tense + '|' + person; }

  /* ---------- 出題 ---------- */

  /**
   * 次の問題を選ぶ。
   * 3回に1回くらいの割合で、過去に間違えた項目から優先的に出す。
   */
  function nextQuestion(pool) {
    var weak = FR.store ? FR.store.drill.weakest(12) : [];
    if (weak.length && Math.random() < 0.35) {
      var cand = weak.filter(function (w) {
        var p = w.key.split('|');
        return pool.verbs.indexOf(p[0]) !== -1 && pool.tenses.indexOf(p[1]) !== -1;
      });
      if (cand.length) {
        var parts = pick(cand.slice(0, 6)).key.split('|');
        var q = build(parts[0], parts[1], Number(parts[2]));
        if (q) { q.review = true; return q; }
      }
    }

    // 通常出題。答えが存在する組み合わせに当たるまで数回試す
    for (var i = 0; i < 40; i++) {
      var verb = pick(pool.verbs);
      var tense = pick(pool.tenses);
      var r = FR.conj.get(verb, tense);
      if (!r) continue;
      var avail = [];
      r.forms.forEach(function (f, idx) { if (f) avail.push(idx); });
      if (!avail.length) continue;
      var q2 = build(verb, tense, pick(avail));
      if (q2) return q2;
    }
    return null;
  }

  function build(verb, tense, person) {
    var r = FR.conj.get(verb, tense);
    if (!r || !r.forms[person]) return null;
    return {
      verb: verb,
      tense: tense,
      person: person,
      answer: r.forms[person],
      pronoun: r.pronouns[person],
      tenseInfo: r.tense,
      info: FR.conj.info(verb)
    };
  }

  /** 4択の選択肢を作る。「ありそうな間違い」を混ぜるのが肝心。 */
  function choicesFor(q) {
    var set = {};
    set[q.answer] = true;
    var out = [q.answer];

    function add(f) {
      if (!f || set[f]) return;
      set[f] = true;
      out.push(f);
    }

    // 同じ時制の別人称（人称の取り違えを試す）
    var same = FR.conj.get(q.verb, q.tense);
    if (same) shuffle(same.forms.filter(Boolean)).forEach(add);

    // 同じ人称の別時制（時制の取り違えを試す）
    ['present', 'imparfait', 'futur', 'conditionnel', 'subjonctif'].forEach(function (t) {
      if (t === q.tense) return;
      var r = FR.conj.get(q.verb, t);
      if (r && r.forms[q.person]) add(r.forms[q.person]);
    });

    // 不規則動詞なら「規則どおりに活用してしまった形」も混ぜる
    if (q.info && q.info.irregular) {
      var stem = q.verb.replace(/(er|ir|re)$/, '');
      var reg = FR.conj.get(stem + 'er', q.tense);
      if (reg && reg.forms[q.person]) add(reg.forms[q.person]);
    }

    return shuffle(out.slice(0, 4));
  }

  /* ---------- 採点 ---------- */

  function grade(input, answer) {
    var a = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var b = String(answer).toLowerCase();
    if (a === b) return 'right';
    if (FR.conj.deaccent(a) === FR.conj.deaccent(b)) return 'accent';
    return 'wrong';
  }

  /* ---------- 本体 ---------- */

  /**
   * ドリルを作る。
   * @param {{verbs?:string[], tenses?:string[], mode?:'input'|'choice', title?:string, compact?:boolean}} opts
   */
  function create(opts) {
    opts = opts || {};

    var pool = {
      verbs: (opts.verbs && opts.verbs.length ? opts.verbs : DEFAULT_VERBS)
        .filter(function (v) { return FR.conj.exists(v); }),
      tenses: (opts.tenses && opts.tenses.length ? opts.tenses : DEFAULT_TENSES)
        .map(function (t) { return FR.conj.normalizeTense(t); })
        .filter(Boolean)
    };
    if (!pool.verbs.length) pool.verbs = DEFAULT_VERBS;
    if (!pool.tenses.length) pool.tenses = DEFAULT_TENSES;

    var mode = opts.mode || 'input';
    var session = { asked: 0, right: 0, streak: 0, best: 0 };
    var current = null;
    var answered = false;

    var root = el('div', 'drill');

    /* --- ヘッダ --- */
    var head = el('div', 'drill-head');
    head.appendChild(el('span', 'ttl', opts.title || '活用ドリル'));

    var modeBtn = el('button', 'btn-mini', mode === 'input' ? '4択にする' : '入力式にする');
    modeBtn.type = 'button';
    modeBtn.addEventListener('click', function () {
      mode = mode === 'input' ? 'choice' : 'input';
      modeBtn.textContent = mode === 'input' ? '4択にする' : '入力式にする';
      show();
    });
    head.appendChild(modeBtn);

    var stats = el('div', 'drill-stats');
    var sAsked = el('span'), sRate = el('span'), sStreak = el('span');
    stats.appendChild(sAsked); stats.appendChild(sRate); stats.appendChild(sStreak);
    head.appendChild(stats);
    root.appendChild(head);

    function updateStats() {
      sAsked.textContent = '';
      sAsked.appendChild(doc.createTextNode('出題 '));
      sAsked.appendChild(el('b', null, String(session.asked)));

      var rate = session.asked ? Math.round(session.right / session.asked * 100) : 0;
      sRate.textContent = '';
      sRate.appendChild(doc.createTextNode('正答率 '));
      sRate.appendChild(el('b', null, rate + '%'));

      sStreak.textContent = '';
      sStreak.appendChild(doc.createTextNode('連続 '));
      sStreak.appendChild(el('b', null, String(session.streak)));
    }

    /* --- 出題エリア --- */
    var body = el('div', 'drill-body');
    root.appendChild(body);

    var foot = el('div', 'drill-foot');
    root.appendChild(foot);

    function show() {
      answered = false;
      current = nextQuestion(pool);
      body.textContent = '';
      foot.textContent = '';

      if (!current) {
        body.appendChild(el('p', null, '出題できる組み合わせがありません。'));
        return;
      }

      if (current.review) {
        var badge = el('div', 'drill-prompt', '前に間違えた問題');
        badge.style.color = 'var(--amber)';
        body.appendChild(badge);
      }

      body.appendChild(el('div', 'drill-prompt', 'この動詞を活用させてください'));

      var verbLine = el('div', 'drill-verb');
      verbLine.textContent = current.verb;
      verbLine.dataset.fr = current.verb;
      verbLine.setAttribute('role', 'button');
      verbLine.setAttribute('tabindex', '0');
      body.appendChild(verbLine);

      if (current.info && current.info.ja) {
        body.appendChild(el('div', 'drill-tense', current.info.ja));
      }
      body.appendChild(el('div', 'drill-tense', current.tenseInfo.ja + '（' + current.tenseInfo.fr + '）'));

      var subj = el('div', 'drill-subject');
      subj.textContent = current.tenseInfo.key === 'imperatif'
        ? current.pronoun + ' に対する命令'
        : current.pronoun + ' …… ?';
      body.appendChild(subj);

      if (mode === 'input') showInput();
      else showChoices();
    }

    function showInput() {
      var row = el('div', 'drill-inputrow');
      var input = el('input', 'drill-input');
      input.type = 'text';
      input.autocapitalize = 'off';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', '活用形を入力');
      row.appendChild(input);

      var send = el('button', 'btn btn-primary', '答える');
      send.type = 'button';
      row.appendChild(send);
      body.appendChild(row);

      var acc = el('div', 'drill-accents');
      ACCENTS.forEach(function (c) {
        var b = el('button', null, c);
        b.type = 'button';
        b.tabIndex = -1;
        b.addEventListener('click', function () {
          var s = input.selectionStart || input.value.length;
          input.value = input.value.slice(0, s) + c + input.value.slice(input.selectionEnd || s);
          input.focus();
          input.setSelectionRange(s + 1, s + 1);
        });
        acc.appendChild(b);
      });
      body.appendChild(acc);

      function submit() {
        if (answered) return;
        if (!input.value.trim()) { input.focus(); return; }
        var res = grade(input.value, current.answer);
        input.disabled = true;
        send.disabled = true;
        reveal(res);
      }
      send.addEventListener('click', submit);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      setTimeout(function () { input.focus(); }, 30);
    }

    function showChoices() {
      var opts4 = choicesFor(current);
      var grid = el('div', 'drill-choices');
      opts4.forEach(function (c) {
        var b = el('button', 'drill-choice', c);
        b.type = 'button';
        b.addEventListener('click', function () {
          if (answered) return;
          var right = c === current.answer;
          grid.querySelectorAll('.drill-choice').forEach(function (n) {
            n.disabled = true;
            if (n.textContent === current.answer) n.classList.add('right');
            else if (n === b) n.classList.add('wrong');
          });
          reveal(right ? 'right' : 'wrong');
        });
        grid.appendChild(b);
      });
      body.appendChild(grid);
    }

    /* --- 採点結果 --- */

    function reveal(res) {
      answered = true;
      var correct = res === 'right' || res === 'accent';

      session.asked++;
      if (correct) {
        session.right++;
        session.streak++;
        if (session.streak > session.best) session.best = session.streak;
      } else {
        session.streak = 0;
      }
      if (FR.store) {
        FR.store.drill.record(keyOf(current.verb, current.tense, current.person), res === 'right');
      }
      updateStats();

      var fb = el('div', 'drill-feedback ' + (correct ? 'ok' : 'ng'));
      if (res === 'right') fb.appendChild(el('div', null, '正解'));
      else if (res === 'accent') fb.appendChild(el('div', null, '△ 惜しい — アクセント記号が抜けています'));
      else fb.appendChild(el('div', null, '正解は'));

      var line = FR.conj.line(current.verb, current.tense, current.person) || current.answer;
      var ans = el('div', 'answer');
      ans.textContent = line;
      ans.dataset.fr = line;
      ans.setAttribute('role', 'button');
      ans.setAttribute('tabindex', '0');
      fb.appendChild(ans);
      body.appendChild(fb);

      // 正解を読み上げる
      if (FR.speech) FR.speech.speak(line);

      // なぜその形になるのか（エンジンが持っている構造をそのまま説明に使う）
      var why = explain(current);
      if (why) {
        var w = el('div', 'drill-why');
        w.textContent = why;
        body.appendChild(w);
      }

      /* 次へ / AI解説 */
      var next = el('button', 'btn btn-primary', '次の問題 →');
      next.type = 'button';
      next.addEventListener('click', show);
      foot.appendChild(next);

      var table = el('button', 'btn', '活用表を見る');
      table.type = 'button';
      table.addEventListener('click', function () {
        table.disabled = true;
        foot.parentNode.insertBefore(
          FR.conjTable.render(current.verb, [current.tense]),
          foot
        );
      });
      foot.appendChild(table);

      if (!correct && FR.aiPanel) {
        var ai = el('button', 'aitool', 'なぜこの形になるの？');
        ai.type = 'button';
        ai.addEventListener('click', function () {
          FR.aiPanel.explainDrill(current);
        });
        foot.appendChild(ai);
      }

      setTimeout(function () { next.focus(); }, 40);
    }

    /** 活用エンジンが持つ「語幹 × 語尾」の構造を、そのまま日本語の説明にする */
    function explain(q) {
      var info = q.info;
      if (!info) return '';
      var t = q.tense;
      var parts = FR.conj.split(q.verb, q.tense, q.person);

      if (t === 'futur' || t === 'conditionnel') {
        var endings = FR.conj.endings(t);
        return '未来語幹「' + info.futStem + '-」＋ ' +
          (t === 'futur' ? '単純未来の語尾' : '半過去と同じ語尾') +
          '「-' + endings[q.person] + '」。' +
          (t === 'conditionnel' ? '条件法現在は「未来語幹 ＋ 半過去の語尾」でできている。' : '');
      }
      if (t === 'imparfait') {
        return '半過去は「nous の現在形 − ons」が語幹。' +
          (info.impfStem ? '「' + info.impfStem + '-」＋「-' + FR.conj.endings('imparfait')[q.person] + '」。' : '');
      }
      if (t === 'subjonctif' && info.subjStem) {
        return '接続法現在は「ils の現在形 − ent」が語幹。「' + info.subjStem + '-」＋「-' +
          FR.conj.endings('subjonctif')[q.person] + '」。ただし nous・vous は半過去と同じ語幹を使う。';
      }
      var tenseInfo = FR.conj.tense(t);
      if (tenseInfo && tenseInfo.compound) {
        return '複合時制は「助動詞 ' + info.aux + ' の' + FR.conj.tense(tenseInfo.compound).ja +
          ' ＋ 過去分詞 ' + info.pp + '」。' +
          (info.aux === 'être' ? 'être を取るので過去分詞が主語と性数一致する。' : '過去分詞は変化しない。');
      }
      if (t === 'present' && !info.irregular && parts.ending) {
        return '語幹「' + parts.stem + '」＋ 語尾「-' + parts.ending + '」。';
      }
      if (info.irregular && info.note) return info.note;
      return '';
    }

    updateStats();
    show();
    return root;
  }

  /* ---------- 章に埋め込む形 ---------- */

  function embed(opts) {
    return create(Object.assign({ compact: true }, opts));
  }

  /* ---------- 独立ページ ---------- */

  function page() {
    var wrap = el('div', 'page');
    wrap.appendChild(el('h1', null, '活用ドリル'));
    wrap.appendChild(el('p', null,
      '動詞と時制を選んで練習します。間違えた項目は記録され、次回以降くり返し出題されます。'));

    var setup = el('div', 'card');

    var verbField = el('label', 'field');
    verbField.appendChild(el('span', null, '動詞'));
    var verbSel = doc.createElement('select');
    verbSel.multiple = true;
    verbSel.size = 8;
    FR.conj.list().forEach(function (v) {
      var o = doc.createElement('option');
      var info = FR.conj.info(v);
      o.value = v;
      o.textContent = v + (info && info.ja ? '（' + info.ja + '）' : '');
      if (DEFAULT_VERBS.indexOf(v) !== -1) o.selected = true;
      verbSel.appendChild(o);
    });
    verbField.appendChild(verbSel);
    setup.appendChild(verbField);

    var tenseField = el('label', 'field');
    tenseField.appendChild(el('span', null, '時制'));
    var tenseSel = doc.createElement('select');
    tenseSel.multiple = true;
    tenseSel.size = 8;
    FR.conj.TENSES.forEach(function (t) {
      var o = doc.createElement('option');
      o.value = t.key;
      o.textContent = t.ja + '（' + t.fr + '）';
      if (t.key === 'present') o.selected = true;
      tenseSel.appendChild(o);
    });
    tenseField.appendChild(tenseSel);
    setup.appendChild(tenseField);

    var start = el('button', 'btn btn-primary', 'この設定で始める');
    start.type = 'button';
    setup.appendChild(start);

    var reset = el('button', 'btn', '成績をリセット');
    reset.type = 'button';
    reset.style.marginLeft = '8px';
    reset.addEventListener('click', function () {
      if (FR.store) FR.store.drill.reset();
      reset.textContent = 'リセットしました';
      setTimeout(function () { reset.textContent = '成績をリセット'; }, 1500);
      renderWeak();
    });
    setup.appendChild(reset);

    wrap.appendChild(setup);

    var host = el('div');
    wrap.appendChild(host);

    function selected(sel) {
      return Array.prototype.slice.call(sel.selectedOptions).map(function (o) { return o.value; });
    }

    start.addEventListener('click', function () {
      host.textContent = '';
      host.appendChild(create({ verbs: selected(verbSel), tenses: selected(tenseSel) }));
      host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    /* 弱点リスト */
    var weakCard = el('div', 'card');
    wrap.appendChild(weakCard);

    function renderWeak() {
      weakCard.textContent = '';
      weakCard.appendChild(el('h2', null, '苦手な項目'));
      var weak = FR.store ? FR.store.drill.weakest(20) : [];
      if (!weak.length) {
        weakCard.appendChild(el('p', 'empty', 'まだ記録がありません。ドリルを解くとここに苦手な項目が並びます。'));
        return;
      }
      var ul = el('ul');
      weak.forEach(function (w) {
        var p = w.key.split('|');
        var t = FR.conj.tense(p[1]);
        var line = FR.conj.line(p[0], p[1], Number(p[2]));
        var li = el('li');
        li.appendChild(doc.createTextNode(p[0] + ' / ' + (t ? t.ja : p[1]) + ' → '));
        if (line) {
          var s = el('span', 'fr', line);
          s.dataset.fr = line;
          s.setAttribute('role', 'button');
          s.setAttribute('tabindex', '0');
          li.appendChild(s);
        }
        li.appendChild(el('span', 'vocab-pos', '誤 ' + w.e.wrong + ' / 正 ' + w.e.right));
        ul.appendChild(li);
      });
      weakCard.appendChild(ul);

      var again = el('button', 'btn', '苦手な項目だけ練習する');
      again.type = 'button';
      again.addEventListener('click', function () {
        var verbs = [], tenses = [];
        weak.forEach(function (w) {
          var p = w.key.split('|');
          if (verbs.indexOf(p[0]) === -1) verbs.push(p[0]);
          if (tenses.indexOf(p[1]) === -1) tenses.push(p[1]);
        });
        host.textContent = '';
        host.appendChild(create({ verbs: verbs, tenses: tenses, title: '苦手な項目の復習' }));
        host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      weakCard.appendChild(again);
    }
    renderWeak();

    return wrap;
  }

  FR.drill = {
    create: create,
    embed: embed,
    page: page,
    grade: grade
  };

}(typeof window !== 'undefined' ? window : globalThis));
