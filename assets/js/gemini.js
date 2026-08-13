/* gemini.js — Gemini API クライアント（BYOK）
 *
 * このサイトは静的ファイルだけで動くので、鍵をサーバーに隠す場所がない。
 * そこで「利用者が自分の鍵を入れて、自分のブラウザから直接 Google を呼ぶ」方式にする。
 *   ・鍵は localStorage にだけ置き、リポジトリにも他所にも送らない
 *   ・generativelanguage.googleapis.com は CORS を許可しているので中継サーバーは要らない
 *     （x-goog-api-key ヘッダも許可済み。クエリ文字列に鍵を載せずに済む）
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};

  var ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
  var KEY_STORE = 'geminiKey';

  var MODELS = [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash（既定・速い）' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash（より丁寧）' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（軽量）' }
  ];

  function getKey() {
    return (FR.store ? FR.store.get(KEY_STORE, '') : '') || '';
  }

  function model() {
    var m = FR.store ? FR.store.settings.get('model') : null;
    return m || MODELS[0].id;
  }

  /* ---------- エラーの日本語化 ---------- */

  function describeError(status, payload) {
    var detail = '';
    try {
      detail = payload && payload.error && payload.error.message ? payload.error.message : '';
    } catch (e) {}

    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(detail)) {
      return 'API キーが正しくないようです。設定画面で入力し直してください。';
    }
    if (status === 400) {
      return 'リクエストが受け付けられませんでした。' + (detail ? '（' + detail + '）' : '');
    }
    if (status === 401 || status === 403) {
      return 'API キーが無効か、権限がありません。Google AI Studio でキーを作り直して、設定画面に貼り直してください。';
    }
    if (status === 404) {
      return '指定されたモデルが見つかりませんでした。設定画面で別のモデルを選んでみてください。';
    }
    if (status === 429) {
      return 'アクセスが集中しています（無料枠の上限に達した可能性があります）。1分ほど待ってからもう一度お試しください。';
    }
    if (status >= 500) {
      return 'Google 側で一時的な問題が起きています。しばらくしてからお試しください。';
    }
    return '通信に失敗しました。' + (detail ? '（' + detail + '）' : '');
  }

  /* ---------- SSE の読み取り ---------- */

  function extractText(chunk) {
    var out = '';
    var cands = chunk && chunk.candidates;
    if (!cands || !cands.length) return out;
    var parts = cands[0].content && cands[0].content.parts;
    if (!parts) return out;
    parts.forEach(function (p) {
      // Gemini 3 系は思考パートを返すことがあるので、本文だけ拾う
      if (p && typeof p.text === 'string' && !p.thought) out += p.text;
    });
    return out;
  }

  function readStream(response, onToken) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var full = '';

    function step() {
      return reader.read().then(function (res) {
        if (res.done) {
          return full;
        }
        buffer += decoder.decode(res.value, { stream: true });

        var events = buffer.split('\n\n');
        buffer = events.pop();

        events.forEach(function (evt) {
          evt.split('\n').forEach(function (line) {
            if (line.indexOf('data:') !== 0) return;
            var json = line.slice(5).trim();
            if (!json || json === '[DONE]') return;
            var parsed;
            try { parsed = JSON.parse(json); } catch (e) { return; }
            var text = extractText(parsed);
            if (text) {
              full += text;
              if (onToken) onToken(text, full);
            }
          });
        });
        return step();
      });
    }
    return step();
  }

  /* ---------- 本体 ---------- */

  var gemini = {
    MODELS: MODELS,

    hasKey: function () { return !!getKey(); },

    setKey: function (k) {
      var v = String(k || '').trim();
      if (FR.store) {
        if (v) FR.store.set(KEY_STORE, v);
        else FR.store.remove(KEY_STORE);
      }
      return v;
    },

    clearKey: function () { if (FR.store) FR.store.remove(KEY_STORE); },

    /** 画面表示用に伏せた鍵を返す */
    maskedKey: function () {
      var k = getKey();
      if (!k) return '';
      if (k.length <= 10) return '••••••';
      return k.slice(0, 6) + '••••••••' + k.slice(-4);
    },

    model: model,
    setModel: function (m) { if (FR.store) FR.store.settings.set('model', m); return m; },

    /**
     * Gemini に問い合わせる。ストリームで少しずつ返す。
     * @param {{system?:string, messages:Array<{role:'user'|'model', text:string}>,
     *          temperature?:number, maxTokens?:number,
     *          onToken?:(delta:string, full:string)=>void, signal?:AbortSignal}} opts
     * @returns {Promise<string>}
     */
    ask: function (opts) {
      var key = getKey();
      if (!key) {
        return Promise.reject(new Error('APIキーが設定されていません。設定画面で Gemini の API キーを入力してください。'));
      }
      if (typeof fetch !== 'function') {
        return Promise.reject(new Error('このブラウザは通信機能に対応していません。'));
      }

      var body = {
        contents: (opts.messages || []).map(function (m) {
          return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] };
        }),
        generationConfig: {
          temperature: opts.temperature != null ? opts.temperature : 0.7,
          maxOutputTokens: opts.maxTokens || 2048
        }
      };
      if (opts.system) {
        body.systemInstruction = { parts: [{ text: opts.system }] };
      }

      var url = ENDPOINT + encodeURIComponent(model()) + ':streamGenerateContent?alt=sse';

      return fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify(body),
        signal: opts.signal
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            var payload = null;
            try { payload = JSON.parse(t); } catch (e) {}
            throw new Error(describeError(res.status, payload));
          });
        }
        if (!res.body || typeof res.body.getReader !== 'function') {
          // ストリームが使えない環境向けの保険
          return res.text().then(function (t) {
            var full = '';
            t.split('\n').forEach(function (line) {
              if (line.indexOf('data:') !== 0) return;
              try { full += extractText(JSON.parse(line.slice(5).trim())); } catch (e) {}
            });
            if (opts.onToken && full) opts.onToken(full, full);
            return full;
          });
        }
        return readStream(res, opts.onToken);
      }).catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        if (err instanceof TypeError) {
          throw new Error('ネットワークに接続できませんでした。オフラインでないか確認してください。');
        }
        throw err;
      });
    }
  };

  FR.gemini = gemini;

}(typeof window !== 'undefined' ? window : globalThis));
