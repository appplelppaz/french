/* store.js — localStorage の薄いラッパ。
   プライベートブラウズ等で localStorage が使えない場合はメモリに退避して動き続ける。 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};

  var PREFIX = 'fr.';
  var memory = Object.create(null);
  var usable = (function () {
    try {
      var k = PREFIX + '__t';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }());

  function read(key) {
    if (!usable) return memory[key];
    try { return localStorage.getItem(PREFIX + key); } catch (e) { return memory[key]; }
  }

  function write(key, raw) {
    memory[key] = raw;
    if (!usable) return;
    try { localStorage.setItem(PREFIX + key, raw); } catch (e) { /* 容量超過などは黙って諦める */ }
  }

  var store = {
    /** 保存された JSON を返す。無ければ fallback。 */
    get: function (key, fallback) {
      var raw = read(key);
      if (raw === null || raw === undefined) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },

    set: function (key, value) {
      write(key, JSON.stringify(value));
      return value;
    },

    remove: function (key) {
      delete memory[key];
      if (!usable) return;
      try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    },

    /** 配列に push（上限つき・重複除去つき） */
    push: function (key, value, limit) {
      var list = store.get(key, []);
      if (!Array.isArray(list)) list = [];
      list.push(value);
      if (limit && list.length > limit) list = list.slice(list.length - limit);
      return store.set(key, list);
    },

    isPersistent: function () { return usable; }
  };

  /* ---- 学習の進捗 ---- */

  store.progress = {
    all: function () { return store.get('progress', {}); },
    isDone: function (id) { return !!store.progress.all()[id]; },
    setDone: function (id, done) {
      var p = store.progress.all();
      if (done) p[id] = Date.now(); else delete p[id];
      return store.set('progress', p);
    },
    count: function () { return Object.keys(store.progress.all()).length; }
  };

  /* ---- 活用ドリルの成績・弱点 ---- */

  store.drill = {
    /** key = "verb|tense|person" → {wrong, right, last} */
    stats: function () { return store.get('drillStats', {}); },

    record: function (key, correct) {
      var s = store.drill.stats();
      var e = s[key] || { right: 0, wrong: 0, last: 0 };
      if (correct) e.right++; else e.wrong++;
      e.last = Date.now();
      s[key] = e;
      return store.set('drillStats', s);
    },

    /** 誤答が正答を上回っている項目を、間違いの多い順に返す */
    weakest: function (limit) {
      var s = store.drill.stats();
      var out = Object.keys(s)
        .map(function (k) { return { key: k, e: s[k] }; })
        .filter(function (x) { return x.e.wrong > 0; })
        .sort(function (a, b) {
          var da = a.e.wrong - a.e.right, db = b.e.wrong - b.e.right;
          if (db !== da) return db - da;
          return b.e.wrong - a.e.wrong;
        });
      return limit ? out.slice(0, limit) : out;
    },

    session: function () {
      return store.get('drillSession', { asked: 0, right: 0, streak: 0, bestStreak: 0 });
    },
    saveSession: function (s) { return store.set('drillSession', s); },
    reset: function () { store.remove('drillStats'); store.remove('drillSession'); }
  };

  /* ---- マイ例文 ---- */

  store.phrases = {
    all: function () { return store.get('myPhrases', []); },
    add: function (p) {
      var list = store.phrases.all();
      if (list.some(function (x) { return x.fr === p.fr; })) return list;
      list.unshift(Object.assign({ at: Date.now() }, p));
      return store.set('myPhrases', list.slice(0, 500));
    },
    remove: function (fr) {
      return store.set('myPhrases', store.phrases.all().filter(function (x) { return x.fr !== fr; }));
    }
  };

  /* ---- 設定 ---- */

  var DEFAULT_SETTINGS = {
    theme: 'auto',            // auto | light | dark
    voiceURI: '',
    rate: 0.9,
    model: 'gemini-3.6-flash',
    showParts: true,          // 活用表：語幹と語尾を色分け
    showHomophones: true      // 活用表：同じ音のセルに印
  };

  store.settings = {
    all: function () {
      return Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
    },
    get: function (k) { return store.settings.all()[k]; },
    set: function (k, v) {
      var s = store.settings.all();
      s[k] = v;
      return store.set('settings', s);
    },
    defaults: DEFAULT_SETTINGS
  };

  FR.store = store;

}(typeof window !== 'undefined' ? window : globalThis));
