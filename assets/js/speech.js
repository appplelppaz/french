/* speech.js — Web Speech API のラッパ。
 *
 * ブラウザの読み上げは実装差が大きいので、この層で以下を吸収する:
 *   - ボイス一覧が非同期でしか揃わない（voiceschanged を待つ）
 *   - フランス語ボイスが入っていない環境がある（バナーで案内し、無音で動き続ける）
 *   - iOS Safari は最初のユーザー操作より前に発話できない（無音発話で解錠する）
 *   - Chrome は長い発話を 15 秒ほどで打ち切る（文に分割し、resume を打ち続ける）
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};
  var synth = global.speechSynthesis;
  var supported = !!(synth && global.SpeechSynthesisUtterance);

  var voices = [];
  var frVoices = [];
  var chosen = null;
  var rate = 0.9;
  var unlocked = false;
  var readyResolvers = [];
  var voicesReady = false;

  var currentToken = 0;     // 世代番号。stop() で無効化するために使う
  var keepAliveTimer = null;
  var listeners = [];

  /* ---------- ボイスの取得 ---------- */

  function refreshVoices() {
    if (!supported) return;
    var list;
    try { list = synth.getVoices() || []; } catch (e) { list = []; }
    if (!list.length) return;

    voices = list;
    frVoices = list.filter(function (v) {
      return (v.lang || '').toLowerCase().indexOf('fr') === 0;
    });

    // 保存された選択があればそれを、無ければ fr-FR を優先して自動選択
    var saved = FR.store ? FR.store.settings.get('voiceURI') : '';
    chosen = null;
    if (saved) {
      chosen = frVoices.filter(function (v) { return v.voiceURI === saved; })[0] || null;
    }
    if (!chosen) chosen = pickBest(frVoices);

    if (!voicesReady) {
      voicesReady = true;
      readyResolvers.forEach(function (fn) { fn(); });
      readyResolvers = [];
    }
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function pickBest(list) {
    if (!list.length) return null;
    // fr-FR を fr-CA などより優先し、その中でローカル（オフライン）音声を優先する
    var scored = list.map(function (v) {
      var s = 0;
      if ((v.lang || '').toLowerCase().replace('_', '-') === 'fr-fr') s += 4;
      if (v.localService) s += 2;
      if (/thomas|amelie|amélie|audrey|marie|virginie|google/i.test(v.name || '')) s += 1;
      return { v: v, s: s };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored[0].v;
  }

  if (supported) {
    refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
    } else {
      synth.onvoiceschanged = refreshVoices;
    }
    // Safari は voiceschanged を出さないことがあるので、数回ポーリングして諦める
    var tries = 0;
    var poll = setInterval(function () {
      refreshVoices();
      if (++tries > 20 || voicesReady) {
        clearInterval(poll);
        if (!voicesReady) { voicesReady = true; readyResolvers.forEach(function (f) { f(); }); readyResolvers = []; }
      }
    }, 250);
  }

  function whenReady() {
    return new Promise(function (resolve) {
      if (!supported || voicesReady) resolve();
      else readyResolvers.push(resolve);
    });
  }

  /* ---------- iOS の解錠 ---------- */

  function unlock() {
    if (unlocked || !supported) return;
    unlocked = true;
    try {
      var u = new global.SpeechSynthesisUtterance('');
      u.volume = 0;
      synth.speak(u);
    } catch (e) { /* 無視してよい */ }
  }

  if (supported) {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      global.addEventListener(ev, unlock, { once: true, passive: true });
    });
  }

  /* ---------- 発話 ---------- */

  /** Chrome の 15 秒打ち切り対策：発話中に resume を打ち続ける */
  function startKeepAlive() {
    stopKeepAlive();
    keepAliveTimer = setInterval(function () {
      if (!synth.speaking) { stopKeepAlive(); return; }
      try { synth.pause(); synth.resume(); } catch (e) {}
    }, 9000);
  }
  function stopKeepAlive() {
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  }

  /** 長文を文単位に割る。句読点が無ければそのまま返す。 */
  function chunk(text) {
    var t = String(text).trim();
    if (t.length <= 180) return [t];
    var parts = t.match(/[^.!?…:;]+[.!?…:;]*\s*/g) || [t];
    var out = [], buf = '';
    parts.forEach(function (p) {
      if ((buf + p).length > 180 && buf) { out.push(buf.trim()); buf = p; }
      else { buf += p; }
    });
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function speakOne(text, token, opts) {
    return new Promise(function (resolve) {
      if (token !== currentToken) return resolve();
      var u = new global.SpeechSynthesisUtterance(text);
      u.lang = (chosen && chosen.lang) || 'fr-FR';
      if (chosen) u.voice = chosen;
      u.rate = opts && opts.rate != null ? opts.rate : rate;
      u.pitch = opts && opts.pitch != null ? opts.pitch : 1;

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      u.onend = finish;
      u.onerror = finish;

      // onend が来ないブラウザがあるので、長さから見積もった時間で保険をかける
      var guard = setTimeout(finish, Math.max(2500, text.length * 130 / (u.rate || 1)));
      var origResolve = finish;
      u.onend = function () { clearTimeout(guard); origResolve(); };
      u.onerror = function () { clearTimeout(guard); origResolve(); };

      try {
        synth.speak(u);
        startKeepAlive();
      } catch (e) { finish(); }
    });
  }

  var speech = {
    supported: supported,

    /** フランス語のボイスが使えるか */
    isReady: function () { return supported && frVoices.length > 0; },

    /** ボイスは無いが Web Speech API 自体はある（別言語の声で読まれてしまう状態） */
    hasAnyVoice: function () { return supported && voices.length > 0; },

    whenReady: whenReady,

    listVoices: function () { return frVoices.slice(); },
    currentVoice: function () { return chosen; },

    setVoice: function (uri) {
      var v = frVoices.filter(function (x) { return x.voiceURI === uri; })[0];
      if (v) {
        chosen = v;
        if (FR.store) FR.store.settings.set('voiceURI', uri);
      }
      return chosen;
    },

    getRate: function () { return rate; },
    setRate: function (r) {
      rate = Math.max(0.4, Math.min(1.5, Number(r) || 0.9));
      if (FR.store) FR.store.settings.set('rate', rate);
      return rate;
    },

    onVoicesChanged: function (fn) { listeners.push(fn); },

    stop: function () {
      currentToken++;
      stopKeepAlive();
      if (supported) { try { synth.cancel(); } catch (e) {} }
    },

    /**
     * フランス語を読み上げる。
     * @param {string} text
     * @param {{rate?:number, pitch?:number, onstart?:Function, onend?:Function}} [opts]
     * @returns {Promise<void>}
     */
    speak: function (text, opts) {
      opts = opts || {};
      if (!supported || !text) { if (opts.onend) opts.onend(); return Promise.resolve(); }

      unlock();
      speech.stop();
      var token = ++currentToken;

      var pieces = chunk(text);
      if (opts.onstart) opts.onstart();

      // cancel() 直後の speak() を Chrome が取りこぼすので一拍置く
      return new Promise(function (resolve) { setTimeout(resolve, 30); })
        .then(function () {
          return pieces.reduce(function (chain, piece) {
            return chain.then(function () {
              if (token !== currentToken) return;
              return speakOne(piece, token, opts);
            });
          }, Promise.resolve());
        })
        .then(function () {
          stopKeepAlive();
          if (token === currentToken && opts.onend) opts.onend();
        });
    },

    /**
     * 複数の文を順に読み上げる。
     * @param {Array<string|{text:string}>} items
     * @param {{gap?:number, onItem?:(index:number)=>void, onend?:Function}} [opts]
     */
    speakSequence: function (items, opts) {
      opts = opts || {};
      if (!supported || !items || !items.length) { if (opts.onend) opts.onend(); return Promise.resolve(); }

      unlock();
      speech.stop();
      var token = ++currentToken;
      var gap = opts.gap != null ? opts.gap : 320;

      return items.reduce(function (chain, item, i) {
        return chain.then(function () {
          if (token !== currentToken) return;
          if (opts.onItem) opts.onItem(i);
          var text = typeof item === 'string' ? item : item.text;
          return speakOne(text, token, opts).then(function () {
            return new Promise(function (r) { setTimeout(r, gap); });
          });
        });
      }, Promise.resolve()).then(function () {
        stopKeepAlive();
        if (token === currentToken) {
          if (opts.onItem) opts.onItem(-1);
          if (opts.onend) opts.onend();
        }
      });
    }
  };

  // 保存済みの速度を復元
  if (FR.store) {
    var r = FR.store.settings.get('rate');
    if (r) rate = Number(r);
  }

  FR.speech = speech;

}(typeof window !== 'undefined' ? window : globalThis));
