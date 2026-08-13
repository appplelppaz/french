/* app.js — シェルの制御（ルーティング、目次、章の読み込み、検索、テーマ）
 *
 * 章の原稿は content/chNN.js に置き、それぞれが FR.chapter({...}) で自己登録する。
 * fetch ではなく <script> タグで読むので、http:// でも file:// でも同じように動く。
 * （fetch だと file:// では CORS で失敗し、ローカルで開いた瞬間に壊れてしまう）
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var doc = global.document;

  var chapters = Object.create(null);
  var pending = Object.create(null);
  var current = null;
  var observer = null;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function byId(id) { return doc.getElementById(id); }

  function tocEntry(id) {
    for (var i = 0; i < FR.toc.length; i++) if (FR.toc[i].id === id) return FR.toc[i];
    return null;
  }

  /* ==================== 章の登録と読み込み ==================== */

  /** content/chNN.js から呼ばれる */
  FR.chapter = function (ch) {
    chapters[ch.id] = ch;
    var p = pending[ch.id];
    if (p) { p.forEach(function (fn) { fn(ch); }); delete pending[ch.id]; }
  };

  function loadChapter(id) {
    return new Promise(function (resolve, reject) {
      if (chapters[id]) return resolve(chapters[id]);

      if (pending[id]) { pending[id].push(resolve); return; }
      pending[id] = [resolve];

      var s = doc.createElement('script');
      s.src = 'content/' + id + '.js';
      s.async = false;
      s.onerror = function () {
        delete pending[id];
        reject(new Error('章を読み込めませんでした: ' + id));
      };
      s.onload = function () {
        // 読み込めたのに登録が無い＝原稿側の書き損じ
        if (!chapters[id] && pending[id]) {
          delete pending[id];
          reject(new Error('章の中身が登録されませんでした: ' + id));
        }
      };
      doc.head.appendChild(s);
    });
  }

  function loadAllChapters() {
    return Promise.all(FR.toc.map(function (t) {
      return loadChapter(t.id).catch(function () { return null; });
    }));
  }

  /* ==================== サイドバー目次 ==================== */

  function buildToc() {
    var list = byId('toc');
    list.textContent = '';

    var parts = {};
    (FR.tocParts || []).forEach(function (p) { parts[p.before] = p.label; });

    FR.toc.forEach(function (t) {
      if (parts[t.id]) {
        var head = el('li', 'toc-part', parts[t.id]);
        head.setAttribute('role', 'presentation');
        list.appendChild(head);
      }

      var li = el('li', t.branch ? 'sub' : '');
      var a = el('a');
      a.href = '#/' + t.id;
      a.dataset.chapter = t.id;

      a.appendChild(el('span', 'no', t.no));
      a.appendChild(el('span', 'ttl', t.title));
      var done = el('span', 'done', FR.store.progress.isDone(t.id) ? '✓' : '');
      done.dataset.done = t.id;
      a.appendChild(done);

      li.appendChild(a);
      list.appendChild(li);
    });

    updateProgressPill();
  }

  function updateProgressPill() {
    var done = FR.store.progress.count();
    byId('progress-pill').textContent = done + ' / ' + FR.toc.length;
  }

  function highlightToc(id) {
    doc.querySelectorAll('#toc a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.chapter === id);
    });
  }

  function refreshDoneMarks() {
    doc.querySelectorAll('[data-done]').forEach(function (n) {
      n.textContent = FR.store.progress.isDone(n.dataset.done) ? '✓' : '';
    });
    updateProgressPill();
  }

  /* ==================== 章内目次 ==================== */

  function buildMiniToc(headings) {
    var host = byId('minitoc');
    host.textContent = '';
    if (observer) { observer.disconnect(); observer = null; }
    if (!headings || headings.length < 2) return;

    host.appendChild(el('div', 'minitoc-title', 'この章の内容'));
    headings.forEach(function (h) {
      if (h.level > 3) return;
      var a = el('a', h.level === 3 ? 'lv3' : '', h.text);
      a.href = '#' + h.id;
      a.dataset.target = h.id;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = byId(h.id);
        if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      host.appendChild(a);
    });

    // 読んでいる位置に合わせて目次をハイライトする
    if (typeof IntersectionObserver !== 'function') return;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        host.querySelectorAll('a').forEach(function (a) {
          a.classList.toggle('active', a.dataset.target === entry.target.id);
        });
      });
    }, { rootMargin: '-70px 0px -75% 0px', threshold: 0 });

    headings.forEach(function (h) {
      var n = byId(h.id);
      if (n) observer.observe(n);
    });
  }

  /* ==================== 章の描画 ==================== */

  function renderChapter(id) {
    var meta = tocEntry(id);
    var host = byId('chapter');
    var nav = byId('chapter-nav');

    host.textContent = '';
    nav.textContent = '';
    host.appendChild(el('p', 'empty', '読み込んでいます…'));

    loadChapter(id).then(function (ch) {
      host.textContent = '';

      var head = el('div', 'ch-head');
      head.appendChild(el('div', 'ch-no', '第 ' + (ch.no || meta.no) + ' 章'));
      head.appendChild(el('h1', 'ch-title', ch.title || meta.title));
      if (ch.sub || meta.sub) head.appendChild(el('p', 'ch-sub', ch.sub || meta.sub));
      host.appendChild(head);

      var body = el('div');
      var headings = FR.markup.renderInto(body, ch.body);
      host.appendChild(body);

      /* 読了ボタン */
      var mark = el('button', 'mark-done');
      mark.type = 'button';
      function syncMark() {
        var on = FR.store.progress.isDone(id);
        mark.classList.toggle('on', on);
        mark.textContent = on ? '✓ この章は読了しました' : 'この章を読了にする';
      }
      mark.addEventListener('click', function () {
        FR.store.progress.setDone(id, !FR.store.progress.isDone(id));
        syncMark();
        refreshDoneMarks();
      });
      syncMark();
      host.appendChild(mark);

      buildMiniToc(headings);
      buildChapterNav(id);

      // AI パネルに、今読んでいる章を文脈として渡す
      var idx = FR.toc.indexOf(meta);
      FR.aiPanel.setContext({
        id: id, no: ch.no || meta.no, title: ch.title || meta.title,
        body: ch.body, index: idx
      });

      global.scrollTo(0, 0);
    }).catch(function (err) {
      host.textContent = '';
      var box = el('div', 'callout warn');
      box.appendChild(el('div', 'callout-title', '⚠️ 表示できませんでした'));
      box.appendChild(el('p', null, err.message));
      box.appendChild(el('p', null, 'この章はまだ用意されていない可能性があります。'));
      host.appendChild(box);
      buildChapterNav(id);
    });
  }

  function buildChapterNav(id) {
    var nav = byId('chapter-nav');
    nav.textContent = '';
    var meta = tocEntry(id);
    var i = FR.toc.indexOf(meta);
    if (i < 0) return;

    function link(t, dir, cls) {
      var a = el('a', cls);
      a.href = '#/' + t.id;
      a.appendChild(el('div', 'dir', dir));
      a.appendChild(el('div', 't', '第' + t.no + '章 ' + t.title));
      return a;
    }
    if (i > 0) nav.appendChild(link(FR.toc[i - 1], '← 前の章', 'prev'));
    if (i < FR.toc.length - 1) nav.appendChild(link(FR.toc[i + 1], '次の章 →', 'next'));
  }

  /* ==================== ルーティング ==================== */

  function showPage(node) {
    var host = byId('chapter');
    host.textContent = '';
    byId('chapter-nav').textContent = '';
    byId('minitoc').textContent = '';
    if (observer) { observer.disconnect(); observer = null; }
    host.appendChild(node);
    FR.aiPanel.setContext(null);
    global.scrollTo(0, 0);
  }

  function route() {
    var hash = global.location.hash.replace(/^#\/?/, '');
    closeMenu();
    current = hash;

    if (!hash || hash === '/') { highlightToc(''); return showPage(FR.pages.home()); }
    if (hash === 'drill') { highlightToc(''); return showPage(FR.drill.page()); }
    if (hash === 'verbs') { highlightToc(''); return showPage(FR.pages.verbs()); }
    if (hash === 'myphrases') { highlightToc(''); return showPage(FR.pages.myPhrases()); }
    if (hash === 'settings') { highlightToc(''); return showPage(FR.pages.settings()); }

    if (tocEntry(hash)) {
      highlightToc(hash);
      return renderChapter(hash);
    }
    // 章内の見出しへのリンク（#見出しID）はブラウザ任せにする
    if (!/^ch/.test(hash)) return;

    highlightToc('');
    showPage(el('p', 'empty', 'ページが見つかりません。'));
  }

  /* ==================== テーマ ==================== */

  function applyTheme() {
    var t = FR.store.settings.get('theme');
    if (t === 'light' || t === 'dark') doc.documentElement.setAttribute('data-theme', t);
    else doc.documentElement.removeAttribute('data-theme');
  }

  function cycleTheme() {
    var order = ['auto', 'light', 'dark'];
    var cur = FR.store.settings.get('theme');
    var next = order[(order.indexOf(cur) + 1) % order.length];
    FR.store.settings.set('theme', next);
    applyTheme();
  }

  /* ==================== 検索 ==================== */

  var searchLoaded = false;

  function setupSearch() {
    var input = byId('search-input');
    var results = byId('search-results');
    var timer = null;

    function hide() { results.hidden = true; results.textContent = ''; }

    function run() {
      var q = input.value.trim();
      if (q.length < 2) return hide();

      results.hidden = false;
      results.textContent = '';

      if (!searchLoaded) {
        results.appendChild(el('div', 'sr-empty', '検索の準備をしています…'));
        loadAllChapters().then(function () {
          searchLoaded = true;
          run();
        });
        return;
      }

      var needle = q.toLowerCase();
      var hits = [];

      FR.toc.forEach(function (t) {
        var ch = chapters[t.id];
        var score = 0, snippet = '';

        if ((t.title + ' ' + (t.sub || '')).toLowerCase().indexOf(needle) !== -1) score += 10;

        if (ch && ch.body) {
          var body = ch.body;
          var at = body.toLowerCase().indexOf(needle);
          if (at !== -1) {
            score += 5;
            var from = Math.max(0, at - 40);
            snippet = (from > 0 ? '…' : '') + body.slice(from, at + needle.length + 60).replace(/\s+/g, ' ') + '…';
          }
        }
        if (score) hits.push({ t: t, score: score, snippet: snippet });
      });

      hits.sort(function (a, b) { return b.score - a.score; });

      if (!hits.length) {
        results.appendChild(el('div', 'sr-empty', '見つかりませんでした'));
        return;
      }

      hits.slice(0, 20).forEach(function (h) {
        var a = el('a');
        a.href = '#/' + h.t.id;
        a.appendChild(el('div', 'sr-title', '第' + h.t.no + '章 ' + h.t.title));
        if (h.snippet) {
          var s = el('div', 'sr-snip');
          // 一致部分を強調する（テキストノードで組み立てる）
          var lower = h.snippet.toLowerCase();
          var at = lower.indexOf(needle);
          if (at === -1) s.textContent = h.snippet;
          else {
            s.appendChild(doc.createTextNode(h.snippet.slice(0, at)));
            s.appendChild(el('mark', null, h.snippet.slice(at, at + needle.length)));
            s.appendChild(doc.createTextNode(h.snippet.slice(at + needle.length)));
          }
          a.appendChild(s);
        }
        a.addEventListener('click', function () { hide(); input.value = ''; });
        results.appendChild(a);
      });
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(run, 180);
    });
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) run(); });
    doc.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrap')) hide();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; hide(); input.blur(); }
    });
  }

  /* ==================== モバイルのメニュー ==================== */

  function openMenu() {
    byId('sidebar').classList.add('open');
    byId('scrim').hidden = false;
    byId('btn-menu').setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    byId('sidebar').classList.remove('open');
    if (!FR.aiPanel.isOpen()) byId('scrim').hidden = true;
    byId('btn-menu').setAttribute('aria-expanded', 'false');
  }

  /* ==================== 音声のバナー ==================== */

  function checkVoices() {
    var banner = byId('voice-banner');
    if (!FR.speech.supported) {
      banner.hidden = false;
      banner.textContent = '';
      banner.appendChild(doc.createTextNode('このブラウザは読み上げに対応していません。Chrome・Safari・Edge をお使いください。教材の他の機能はすべて使えます。'));
      return;
    }
    FR.speech.whenReady().then(function () {
      if (FR.speech.isReady()) { banner.hidden = true; return; }
      banner.hidden = false;
      banner.textContent = '';
      banner.appendChild(doc.createTextNode('🔊 フランス語の読み上げ音声が見つかりません。'));

      var a = doc.createElement('a');
      a.href = '#/settings';
      a.textContent = '追加のしかたを見る';
      a.style.marginLeft = '6px';
      banner.appendChild(a);

      var close = doc.createElement('button');
      close.type = 'button';
      close.textContent = '閉じる';
      close.addEventListener('click', function () { banner.hidden = true; });
      banner.appendChild(close);
    });
  }

  /* ==================== 音声設定ダイアログ ==================== */

  function setupSpeechDialog() {
    var dlg = byId('speech-dialog');
    var sel = byId('voice-select');
    var range = byId('rate-range');
    var out = byId('rate-out');
    var hint = byId('speech-hint');

    function fill() {
      sel.textContent = '';
      var list = FR.speech.listVoices();
      if (!list.length) {
        var o = doc.createElement('option');
        o.textContent = '（フランス語の声がありません）';
        sel.appendChild(o);
        sel.disabled = true;
        hint.textContent = 'お使いの端末にフランス語の音声が入っていません。設定画面に追加の手順があります。';
        return;
      }
      sel.disabled = false;
      hint.textContent = '「ゆっくり」にすると、リエゾンや語尾が聞き取りやすくなります。';
      var cur = FR.speech.currentVoice();
      list.forEach(function (v) {
        var o = doc.createElement('option');
        o.value = v.voiceURI;
        o.textContent = v.name + '（' + v.lang + '）';
        if (cur && v.voiceURI === cur.voiceURI) o.selected = true;
        sel.appendChild(o);
      });
    }

    sel.addEventListener('change', function () { FR.speech.setVoice(sel.value); });
    range.addEventListener('input', function () {
      FR.speech.setRate(range.value);
      out.textContent = '× ' + range.value;
    });
    byId('speech-test').addEventListener('click', function () {
      FR.speech.speak("Bonjour ! Je m'appelle Marie et j'apprends le français.");
    });

    byId('btn-speech').addEventListener('click', function () {
      fill();
      range.value = String(FR.speech.getRate());
      out.textContent = '× ' + range.value;
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else global.location.hash = '#/settings';
    });

    FR.speech.onVoicesChanged(function () {
      if (dlg.open) fill();
    });
  }

  /* ==================== 起動 ==================== */

  function init() {
    applyTheme();
    buildToc();
    setupSearch();
    setupSpeechDialog();
    checkVoices();

    byId('btn-theme').addEventListener('click', cycleTheme);
    byId('btn-menu').addEventListener('click', function () {
      if (byId('sidebar').classList.contains('open')) closeMenu();
      else openMenu();
    });
    byId('scrim').addEventListener('click', function () {
      closeMenu();
      FR.aiPanel.close();
    });
    byId('btn-ai').addEventListener('click', function () {
      if (FR.aiPanel.isOpen()) FR.aiPanel.close();
      else FR.aiPanel.open();
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        FR.speech.stop();
        closeMenu();
      }
      // / で検索へ
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement.tagName)) {
        e.preventDefault();
        byId('search-input').focus();
      }
    });

    global.addEventListener('hashchange', route);
    route();
  }

  FR.app = {
    applyTheme: applyTheme,
    route: route,
    loadChapter: loadChapter,
    chapters: chapters,
    refreshDoneMarks: refreshDoneMarks
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

}(typeof window !== 'undefined' ? window : globalThis));
