/* content.test.js — 章の原稿を検査する（依存なし。node test/content.test.js で実行）
 *
 * 37章分を手で書くので、次のような取りこぼしを機械で見つける。
 *   - ::: ブロックの閉じ忘れ・入れ子のずれ
 *   - :::conj / :::drill が未登録の動詞や存在しない時制を指している
 *   - 表の列数が行ごとにずれている（[[仏文|カナ|訳]] がセルを割ってしまう事故）
 *   - 例文ブロックや語彙リストの項目数が足りない
 *   - テンプレートリテラルを壊す文字の混入
 *   - 分量（文字数・練習問題数・語彙数）が目標に届いていない
 *
 * 分量の未達は構造の壊れとは性質が違う。書き進めている途中は必ず未達が出るので、
 * 既定では一覧に出すだけで終了コードには反映しない。
 * すべて書き終えたあとの最終確認では --strict を付けて、未達も失敗として扱う。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

global.window = undefined;
require(path.join(ROOT, 'content', 'verbs.js'));
require(path.join(ROOT, 'assets', 'js', 'conjugation.js'));
require(path.join(ROOT, 'content', 'index.js'));

const FR = globalThis.FR;

const STRICT = process.argv.includes('--strict');

/* 分量の目安。市販の仏文法書に近い密度をめざす。 */
const SIZE = {
  target:   20000,  // 1章の目標
  warnAt:   13000,  // これを下回ったら「もう少し」
  failAt:    8000,  // これを下回ったら明らかに足りない
  quizzes:     10,  // 練習問題の数
  vocab:       15   // 語彙リストの項目数
};

const problems = [];
const warnings = [];
const sizes = [];      // 章ごとの分量（一覧に出す）
let checked = 0;

function fail(file, msg) { problems.push(`  ${file}: ${msg}`); }
function warn(file, msg) { warnings.push(`  ${file}: ${msg}`); }

/* ---------- 章を読み込む ---------- */

const chapters = [];
FR.chapter = (ch) => chapters.push(ch);

const files = fs.readdirSync(path.join(ROOT, 'content'))
  .filter(f => /^ch.*\.js$/.test(f))
  .sort();

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'content', f), 'utf8');
  try {
    new Function('FR', src)(FR);
  } catch (e) {
    fail(f, `JS として読めない: ${e.message}`);
  }
}

/* ---------- 目次との突き合わせ ---------- */

const written = new Set(chapters.map(c => c.id));
const missing = FR.toc.filter(t => !written.has(t.id));
const orphan = chapters.filter(c => !FR.toc.some(t => t.id === c.id));

for (const o of orphan) fail(o.id, '目次（content/index.js）に載っていない');

for (const c of chapters) {
  const meta = FR.toc.find(t => t.id === c.id);
  if (meta && meta.no !== c.no) {
    fail(c.id, `章番号が目次と食い違う（目次 ${meta.no} / 原稿 ${c.no}）`);
  }
}

/* ---------- 1章ずつ検査する ---------- */

const BLOCK = new Set(['ex', 'note', 'warn', 'adv', 'tip', 'deep', 'quiz', 'vocab']);
const SOLO = new Set(['conj', 'drill', 'vmap', 'ai-gen', 'ai-ask']);

function splitPipes(text) {
  const out = [];
  let buf = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '[' && text[i + 1] === '[') { depth++; buf += '[['; i++; continue; }
    if (c === ']' && text[i + 1] === ']' && depth > 0) { depth--; buf += ']]'; i++; continue; }
    if (c === '|' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += c;
  }
  out.push(buf);
  return out;
}

for (const ch of chapters) {
  checked++;
  const id = ch.id;
  const body = ch.body || '';
  const lines = body.split('\n');

  if (!body.trim()) { fail(id, '本文が空'); continue; }

  /* テンプレートリテラルを壊す文字 */
  const stray = (body.match(/\$\{/g) || []).length;
  if (stray) fail(id, `本文に \${ が ${stray} 箇所ある（テンプレートリテラルが壊れる）`);

  /* ブロックの開閉 */
  const stack = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t === ':::') {
      if (!stack.length) fail(id, `${i + 1}行目: 対応する開始のない ::: がある`);
      else stack.pop();
      return;
    }
    const m = t.match(/^:::([a-z-]+)\s*(.*)$/);
    if (!m) return;
    const [, name, args] = m;
    if (SOLO.has(name)) return;
    if (!BLOCK.has(name)) { fail(id, `${i + 1}行目: 未知のディレクティブ :::${name}`); return; }
    stack.push({ name, line: i + 1 });
  });
  for (const open of stack) {
    fail(id, `${open.line}行目の :::${open.name} が閉じられていない`);
  }

  /* :::conj と :::drill の中身 */
  lines.forEach((line, i) => {
    const m = line.trim().match(/^:::(conj|drill)\s+(.*)$/);
    if (!m) return;
    const [, kind, args] = m;
    const spec = FR.conj.parseDirective(args);

    if (!spec.verbs.length) {
      fail(id, `${i + 1}行目: :::${kind} に動詞が指定されていない`);
      return;
    }
    for (const v of spec.verbs) {
      if (!FR.conj.exists(v)) {
        fail(id, `${i + 1}行目: :::${kind} の動詞 "${v}" が活用データに無い`);
      } else if (FR.conj.info(v).guessed) {
        warn(id, `${i + 1}行目: "${v}" は語尾から推測して活用している（verbs.js に未登録）`);
      }
    }
    // 時制の解決は parseDirective がすでに保証しているが、
    // 「時制として解釈されなかった余りのトークン」を取りこぼさないよう確認する
    const rest = args.trim().split(/\s+/);
    if (!spec.tenses.length && rest.length > 1 && !/^(se|s['’])/.test(rest[0])) {
      fail(id, `${i + 1}行目: :::${kind} の時制 "${rest[rest.length - 1]}" が解決できない`);
    }
  });

  /* 表の列数がそろっているか */
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].trim();
    const div = (lines[i + 1] || '').trim();
    if (head.indexOf('|') === -1) continue;
    if (!/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(div)) continue;

    const cols = splitPipes(head.replace(/^\|/, '').replace(/\|$/, '')).length;
    let r = i + 2;
    while (r < lines.length && lines[r].trim() && lines[r].indexOf('|') !== -1) {
      const n = splitPipes(lines[r].trim().replace(/^\|/, '').replace(/\|$/, '')).length;
      if (n !== cols) fail(id, `${r + 1}行目: 表の列数がずれている（見出し ${cols} 列 / この行 ${n} 列）`);
      r++;
    }
    i = r - 1;
  }

  /* 例文ブロック・語彙リストの項目数 */
  let mode = null;
  let vocabCount = 0;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^:::ex\b/.test(t)) { mode = 'ex'; return; }
    if (/^:::vocab\b/.test(t)) { mode = 'vocab'; return; }
    if (/^:::[a-z-]/.test(t) || t === ':::') { if (t === ':::') mode = null; return; }
    if (!mode || !t) return;

    const parts = splitPipes(t);
    if (mode === 'ex' && parts.length < 3) {
      warn(id, `${i + 1}行目: 例文が3項目そろっていない（仏文 | カナ | 和訳）: ${t.slice(0, 40)}`);
    }
    if (mode === 'vocab') {
      vocabCount++;
      if (parts.length < 3) {
        warn(id, `${i + 1}行目: 語彙が3項目そろっていない（語 | 品詞 | 意味）: ${t.slice(0, 40)}`);
      }
    }
  });

  /* 発音チップの形式 */
  const chips = body.match(/\[\[[^\]]*\]\]/g) || [];
  for (const chip of chips) {
    const inner = chip.slice(2, -2);
    if (!inner.trim()) fail(id, `空の発音チップ [[]] がある`);
    if (inner.split('|').length > 3) {
      fail(id, `発音チップの項目が多すぎる（仏文|カナ|訳 の3つまで）: ${chip.slice(0, 50)}`);
    }
  }

  /* 練習問題は Q. と A. が対になっているか */
  let inQuiz = false, qs = 0, as = 0, quizCount = 0;
  for (const line of lines) {
    const t = line.trim();
    if (/^:::quiz\b/.test(t)) { inQuiz = true; qs = 0; as = 0; continue; }
    if (inQuiz && t === ':::') {
      if (qs !== as) fail(id, `練習問題の Q（${qs}個）と A（${as}個）の数が合わない`);
      inQuiz = false;
      continue;
    }
    if (inQuiz && /^Q[.．:：]/.test(t)) { qs++; quizCount++; }
    if (inQuiz && /^A[.．:：]/.test(t)) as++;
  }

  /* 見出しがあるか */
  if (!/^##\s/m.test(body)) warn(id, '見出し（##）が1つも無い');

  /* 分量。「網羅的に」という目標を機械で担保する */
  sizes.push({
    id, no: ch.no, title: ch.title || '',
    chars: body.length, quizzes: quizCount, vocab: vocabCount,
    short: body.length < SIZE.warnAt || quizCount < SIZE.quizzes || vocabCount < SIZE.vocab,
    tooShort: body.length < SIZE.failAt
  });
}

/* ---------- 結果 ---------- */

console.log('');
if (problems.length) {
  console.log('問題:');
  problems.forEach(p => console.log(p));
  console.log('');
}
if (warnings.length) {
  console.log('注意:');
  warnings.forEach(w => console.log(w));
  console.log('');
}
if (missing.length) {
  console.log(`未執筆の章（${missing.length}）: ${missing.map(m => m.no + '章 ' + m.title).join(' / ')}`);
  console.log('');
}

/* ---------- 分量の一覧 ---------- */

sizes.sort((a, b) => a.chars - b.chars);

const under = sizes.filter(s => s.short);
const total = sizes.reduce((n, s) => n + s.chars, 0);

function pad(s, n) {
  // 全角を2つ分として数える。等幅で見たときに桁がそろうように。
  // 長すぎる場合は切り詰める（切り詰めないと以降の列がずれる）。
  const cells = [];
  let w = 0;
  for (const c of String(s)) {
    const cw = /[ -~｡-ﾟ]/.test(c) ? 1 : 2;
    if (w + cw > n - 1) { cells.push('…'); w += 1; break; }
    cells.push(c); w += cw;
  }
  return cells.join('') + ' '.repeat(Math.max(0, n - w));
}

console.log(`分量（目標 ${SIZE.target.toLocaleString()}字 / 練習 ${SIZE.quizzes}問 / 語彙 ${SIZE.vocab}語）`);
console.log(`  合計 ${total.toLocaleString()}字、平均 ${Math.round(total / (sizes.length || 1)).toLocaleString()}字`);

if (under.length) {
  console.log(`  未達 ${under.length} / ${sizes.length} 章（少ない順）`);
  console.log('');
  console.log('    ' + pad('章', 26) + pad('文字数', 10) + pad('練習', 8) + '語彙');
  for (const s of under) {
    const mark = s.tooShort ? '× ' : '・';
    console.log('    ' + mark + pad(`${s.no} ${s.title}`, 24)
      + pad(s.chars.toLocaleString(), 10)
      + pad(s.quizzes < SIZE.quizzes ? s.quizzes + ' /' + SIZE.quizzes : String(s.quizzes), 8)
      + (s.vocab < SIZE.vocab ? s.vocab + ' /' + SIZE.vocab : String(s.vocab)));
  }
  console.log('');
  console.log(`    × は ${SIZE.failAt.toLocaleString()}字未満。--strict を付けるとこれらも失敗として扱う`);
} else {
  console.log('  すべての章が目標に達している');
}
console.log('');

const shortFail = STRICT ? under.length : 0;

console.log(`原稿の検査: ${checked} 章を確認、問題 ${problems.length} 件 / 注意 ${warnings.length} 件`
  + (under.length ? ` / 分量の未達 ${under.length} 章` : ''));
process.exit(problems.length || shortFail ? 1 : 0);
