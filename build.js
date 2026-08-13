#!/usr/bin/env node
/* build.js — 1ファイル完結版のHTMLを作る
 *
 *   node build.js   →   dist/french-textbook.html
 *
 * index.html の <link rel=stylesheet> と <script src> をすべて中身に置き換え、
 * さらに全37章を同梱する。出力は単体で完全に動作するので、メールに添付しても
 * USB に入れても、機内でも使える。
 *
 * Node の標準モジュールしか使わない（npm install は不要）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'french-textbook.html');

let warnings = 0;
let problems = 0;

function warn(msg) { warnings++; console.log('  注意: ' + msg); }
function fail(msg) { problems++; console.log('  問題: ' + msg); }

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/* ---------- APIキーが混入していないかを検査する ---------- */

/* Google の API キーは AIza で始まる39文字。誤ってコミットされたものが
   1ファイル版に焼き込まれないよう、ビルドの時点で止める。 */
const KEY_PATTERN = /AIza[0-9A-Za-z_-]{35}/;

function checkForSecrets(label, text) {
  const m = text.match(KEY_PATTERN);
  if (m) {
    fail(`${label} に API キーらしき文字列が含まれています（${m[0].slice(0, 10)}…）。`);
  }
}

/* ---------- 章の原稿を検査する ---------- */

/* 原稿はテンプレートリテラルの中に書かれるので、バッククォートと ${ が
   そのまま入っていると構文が壊れる。ビルド時に気づけるようにしておく。 */
function checkChapterSource(file, src) {
  const body = src.match(/body:\s*`([\s\S]*)`\s*\}\s*\)\s*;?\s*$/);
  if (!body) {
    warn(`${file}: body のテンプレートリテラルを取り出せませんでした`);
    return;
  }
  const text = body[1];
  const interp = (text.match(/\$\{/g) || []).length;
  if (interp) fail(`${file}: 本文に \${ が ${interp} 箇所あります（テンプレートリテラルが壊れます）`);
}

/* ---------- 収集 ---------- */

console.log('1ファイル版をビルドします\n');

const indexHtml = read('index.html');

// index.html に書かれている順序でファイルを集める（読み込み順が意味を持つため）
const cssFiles = [];
const jsFiles = [];

indexHtml.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/g, (_, href) => { cssFiles.push(href); return _; });
indexHtml.replace(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g, (_, src) => { jsFiles.push(src); return _; });

console.log(`CSS ${cssFiles.length} 件 / JS ${jsFiles.length} 件を検出`);

// 章の一覧は content/index.js が持っているので、それを読んで全章を集める
const tocSrc = read('content/index.js');
const chapterIds = [];
tocSrc.replace(/id:\s*'([^']+)'/g, (_, id) => { chapterIds.push(id); return _; });

console.log(`章 ${chapterIds.length} 件を検出\n`);

const chapterFiles = [];
for (const id of chapterIds) {
  const rel = path.join('content', id + '.js');
  if (!fs.existsSync(path.join(ROOT, rel))) {
    fail(`${rel} が見つかりません（目次にあるのに原稿がない）`);
    continue;
  }
  chapterFiles.push(rel);
}

/* ---------- 検査 ---------- */

console.log('検査中…');

for (const f of cssFiles.concat(jsFiles)) {
  checkForSecrets(f, read(f));
}
for (const f of chapterFiles) {
  const src = read(f);
  checkForSecrets(f, src);
  checkChapterSource(f, src);
}

if (problems) {
  console.log(`\n問題が ${problems} 件あります。ビルドを中止しました。`);
  process.exit(1);
}
console.log(warnings ? `  注意 ${warnings} 件（続行します）` : '  問題なし');

/* ---------- インライン化 ---------- */

function inlineCss(rel) {
  return '<style>\n/* ' + rel + ' */\n' + read(rel) + '\n</style>';
}

function inlineJs(rel) {
  // </script> が中に現れると script が途中で閉じてしまうので分割しておく
  const code = read(rel).replace(/<\/script>/gi, '<\\/script>');
  return '<script>\n/* ' + rel + ' */\n' + code + '\n</script>';
}

let out = indexHtml;

for (const rel of cssFiles) {
  const tag = new RegExp('<link[^>]+href="' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>');
  out = out.replace(tag, () => inlineCss(rel));
}

for (const rel of jsFiles) {
  const tag = new RegExp('<script[^>]+src="' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*><\\/script>');
  out = out.replace(tag, () => inlineJs(rel));
}

/* 全章を同梱する。
   app.js は章を <script> タグで遅延ロードするが、1ファイル版ではネットワークが
   使えないので、あらかじめ全部登録しておき、遅延ロードを短絡させる。 */
const chapterBundle = [
  '<script>',
  '/* 全章を同梱（1ファイル版では遅延ロードしない） */',
  ...chapterFiles.map(rel => read(rel).replace(/<\/script>/gi, '<\\/script>')),
  '</script>'
].join('\n');

out = out.replace('</body>', chapterBundle + '\n</body>');

/* 1ファイル版であることを本体に伝える。app.js はこの印を見て、
   章のスクリプトを取りに行かずに同梱済みのものを使う。 */
out = out.replace('<body>', '<body data-bundled="1">');

/* ---------- 書き出し ---------- */

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, out, 'utf8');

const kb = Math.round(Buffer.byteLength(out, 'utf8') / 1024);
console.log(`\n出力: dist/french-textbook.html（${kb} KB、${chapterFiles.length} 章を同梱）`);
console.log('このファイル1つで、オフラインでも全機能が動きます。');
