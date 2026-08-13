/* conj.test.js — 活用エンジンの検証（依存なし。node test/conj.test.js で実行）
 *
 * 教材である以上、活用形の誤りは致命的なので、規則動詞・綴りが変わる動詞・
 * 不規則動詞・複合時制・非人称動詞の代表例をここで固定する。
 */
'use strict';

const path = require('path');

// ブラウザ用スクリプトを Node に読み込む
global.window = undefined;
require(path.join(__dirname, '..', 'content', 'verbs.js'));
require(path.join(__dirname, '..', 'assets', 'js', 'conjugation.js'));

const FR = globalThis.FR;
const conj = FR.conj;

let pass = 0;
let fail = 0;
const failures = [];

function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    failures.push(`  ${label}\n      期待: ${e}\n      実際: ${a}`);
  }
}

/** 6人称の活用形をまとめて検証する */
function forms(verb, tense, expected) {
  const r = conj.get(verb, tense);
  eq(`${verb} / ${tense}`, r ? r.forms : null, expected);
}

/* ==================== 第1群 -er（規則） ==================== */

forms('chanter', 'present',
  ['chante', 'chantes', 'chante', 'chantons', 'chantez', 'chantent']);
forms('chanter', 'imparfait',
  ['chantais', 'chantais', 'chantait', 'chantions', 'chantiez', 'chantaient']);
forms('chanter', 'futur',
  ['chanterai', 'chanteras', 'chantera', 'chanterons', 'chanterez', 'chanteront']);
forms('chanter', 'conditionnel',
  ['chanterais', 'chanterais', 'chanterait', 'chanterions', 'chanteriez', 'chanteraient']);
forms('chanter', 'subjonctif',
  ['chante', 'chantes', 'chante', 'chantions', 'chantiez', 'chantent']);
forms('chanter', 'passeSimple',
  ['chantai', 'chantas', 'chanta', 'chantâmes', 'chantâtes', 'chantèrent']);
forms('chanter', 'imperatif', ['chante', 'chantons', 'chantez']);
eq('chanter 過去分詞', conj.info('chanter').pp, 'chanté');
eq('chanter 現在分詞', conj.info('chanter').presP, 'chantant');

/* ==================== 第2群 -ir（finir 型） ==================== */

forms('finir', 'present',
  ['finis', 'finis', 'finit', 'finissons', 'finissez', 'finissent']);
forms('finir', 'imparfait',
  ['finissais', 'finissais', 'finissait', 'finissions', 'finissiez', 'finissaient']);
forms('finir', 'futur',
  ['finirai', 'finiras', 'finira', 'finirons', 'finirez', 'finiront']);
forms('finir', 'subjonctif',
  ['finisse', 'finisses', 'finisse', 'finissions', 'finissiez', 'finissent']);
forms('finir', 'passeSimple',
  ['finis', 'finis', 'finit', 'finîmes', 'finîtes', 'finirent']);
eq('finir 過去分詞', conj.info('finir').pp, 'fini');

/* ==================== 第3群 -re（attendre 型） ==================== */

forms('attendre', 'present',
  ['attends', 'attends', 'attend', 'attendons', 'attendez', 'attendent']);
forms('attendre', 'futur',
  ['attendrai', 'attendras', 'attendra', 'attendrons', 'attendrez', 'attendront']);
forms('attendre', 'imparfait',
  ['attendais', 'attendais', 'attendait', 'attendions', 'attendiez', 'attendaient']);
eq('attendre 過去分詞', conj.info('attendre').pp, 'attendu');
forms('répondre', 'present',
  ['réponds', 'réponds', 'répond', 'répondons', 'répondez', 'répondent']);

/* ==================== 綴りが変わる第1群 ==================== */

forms('manger', 'present',
  ['mange', 'manges', 'mange', 'mangeons', 'mangez', 'mangent']);
forms('manger', 'imparfait',
  ['mangeais', 'mangeais', 'mangeait', 'mangions', 'mangiez', 'mangeaient']);

forms('commencer', 'present',
  ['commence', 'commences', 'commence', 'commençons', 'commencez', 'commencent']);
forms('commencer', 'imparfait',
  ['commençais', 'commençais', 'commençait', 'commencions', 'commenciez', 'commençaient']);

forms('appeler', 'present',
  ['appelle', 'appelles', 'appelle', 'appelons', 'appelez', 'appellent']);
forms('appeler', 'futur',
  ['appellerai', 'appelleras', 'appellera', 'appellerons', 'appellerez', 'appelleront']);

forms('jeter', 'present',
  ['jette', 'jettes', 'jette', 'jetons', 'jetez', 'jettent']);

forms('acheter', 'present',
  ['achète', 'achètes', 'achète', 'achetons', 'achetez', 'achètent']);
forms('acheter', 'futur',
  ['achèterai', 'achèteras', 'achètera', 'achèterons', 'achèterez', 'achèteront']);

forms('lever', 'present',
  ['lève', 'lèves', 'lève', 'levons', 'levez', 'lèvent']);

forms('préférer', 'present',
  ['préfère', 'préfères', 'préfère', 'préférons', 'préférez', 'préfèrent']);
// 伝統的な綴りでは未来・条件法の é は変わらない
forms('préférer', 'futur',
  ['préférerai', 'préféreras', 'préférera', 'préférerons', 'préférerez', 'préféreront']);

forms('payer', 'present',
  ['paie', 'paies', 'paie', 'payons', 'payez', 'paient']);

// envoyer は未来語幹だけが不規則
forms('envoyer', 'futur',
  ['enverrai', 'enverras', 'enverra', 'enverrons', 'enverrez', 'enverront']);
forms('envoyer', 'present',
  ['envoie', 'envoies', 'envoie', 'envoyons', 'envoyez', 'envoient']);

/* ==================== 不規則動詞 ==================== */

forms('être', 'present', ['suis', 'es', 'est', 'sommes', 'êtes', 'sont']);
forms('être', 'imparfait', ['étais', 'étais', 'était', 'étions', 'étiez', 'étaient']);
forms('être', 'futur', ['serai', 'seras', 'sera', 'serons', 'serez', 'seront']);
forms('être', 'conditionnel', ['serais', 'serais', 'serait', 'serions', 'seriez', 'seraient']);
forms('être', 'subjonctif', ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient']);
forms('être', 'passeSimple', ['fus', 'fus', 'fut', 'fûmes', 'fûtes', 'furent']);
forms('être', 'imperatif', ['sois', 'soyons', 'soyez']);

forms('avoir', 'present', ['ai', 'as', 'a', 'avons', 'avez', 'ont']);
forms('avoir', 'imparfait', ['avais', 'avais', 'avait', 'avions', 'aviez', 'avaient']);
forms('avoir', 'futur', ['aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront']);
forms('avoir', 'subjonctif', ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient']);
forms('avoir', 'passeSimple', ['eus', 'eus', 'eut', 'eûmes', 'eûtes', 'eurent']);

forms('aller', 'present', ['vais', 'vas', 'va', 'allons', 'allez', 'vont']);
forms('aller', 'futur', ['irai', 'iras', 'ira', 'irons', 'irez', 'iront']);
forms('aller', 'imparfait', ['allais', 'allais', 'allait', 'allions', 'alliez', 'allaient']);
forms('aller', 'subjonctif', ['aille', 'ailles', 'aille', 'allions', 'alliez', 'aillent']);
forms('aller', 'imperatif', ['va', 'allons', 'allez']);

forms('faire', 'present', ['fais', 'fais', 'fait', 'faisons', 'faites', 'font']);
forms('faire', 'futur', ['ferai', 'feras', 'fera', 'ferons', 'ferez', 'feront']);
forms('faire', 'subjonctif', ['fasse', 'fasses', 'fasse', 'fassions', 'fassiez', 'fassent']);
forms('faire', 'passeSimple', ['fis', 'fis', 'fit', 'fîmes', 'fîtes', 'firent']);

forms('venir', 'present', ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent']);
forms('venir', 'futur', ['viendrai', 'viendras', 'viendra', 'viendrons', 'viendrez', 'viendront']);
forms('venir', 'passeSimple', ['vins', 'vins', 'vint', 'vînmes', 'vîntes', 'vinrent']);

forms('prendre', 'present', ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent']);
forms('prendre', 'subjonctif', ['prenne', 'prennes', 'prenne', 'prenions', 'preniez', 'prennent']);
forms('prendre', 'passeSimple', ['pris', 'pris', 'prit', 'prîmes', 'prîtes', 'prirent']);

forms('pouvoir', 'present', ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent']);
forms('pouvoir', 'futur', ['pourrai', 'pourras', 'pourra', 'pourrons', 'pourrez', 'pourront']);
forms('pouvoir', 'subjonctif', ['puisse', 'puisses', 'puisse', 'puissions', 'puissiez', 'puissent']);
forms('pouvoir', 'imperatif', [null, null, null]);

forms('vouloir', 'present', ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent']);
forms('vouloir', 'futur', ['voudrai', 'voudras', 'voudra', 'voudrons', 'voudrez', 'voudront']);
forms('vouloir', 'imperatif', ['veuille', 'veuillons', 'veuillez']);

forms('devoir', 'present', ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent']);
forms('devoir', 'futur', ['devrai', 'devras', 'devra', 'devrons', 'devrez', 'devront']);

forms('savoir', 'present', ['sais', 'sais', 'sait', 'savons', 'savez', 'savent']);
forms('savoir', 'futur', ['saurai', 'sauras', 'saura', 'saurons', 'saurez', 'sauront']);
forms('savoir', 'subjonctif', ['sache', 'saches', 'sache', 'sachions', 'sachiez', 'sachent']);
eq('savoir 現在分詞', conj.info('savoir').presP, 'sachant');

forms('voir', 'present', ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient']);
forms('voir', 'futur', ['verrai', 'verras', 'verra', 'verrons', 'verrez', 'verront']);
forms('voir', 'imparfait', ['voyais', 'voyais', 'voyait', 'voyions', 'voyiez', 'voyaient']);

forms('dire', 'present', ['dis', 'dis', 'dit', 'disons', 'dites', 'disent']);
forms('boire', 'present', ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent']);
forms('boire', 'subjonctif', ['boive', 'boives', 'boive', 'buvions', 'buviez', 'boivent']);
forms('partir', 'present', ['pars', 'pars', 'part', 'partons', 'partez', 'partent']);
forms('ouvrir', 'present', ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent']);
forms('ouvrir', 'imperatif', ['ouvre', 'ouvrons', 'ouvrez']);
eq('ouvrir 過去分詞', conj.info('ouvrir').pp, 'ouvert');
forms('recevoir', 'present', ['reçois', 'reçois', 'reçoit', 'recevons', 'recevez', 'reçoivent']);
forms('mourir', 'present', ['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent']);
eq('mourir 過去分詞', conj.info('mourir').pp, 'mort');
eq('naître 過去分詞', conj.info('naître').pp, 'né');
eq('vivre 過去分詞', conj.info('vivre').pp, 'vécu');

/* ==================== 複合時制 ==================== */

// avoir を助動詞に取る
forms('chanter', 'passeCompose',
  ['ai chanté', 'as chanté', 'a chanté', 'avons chanté', 'avez chanté', 'ont chanté']);
forms('chanter', 'plusQueParfait',
  ['avais chanté', 'avais chanté', 'avait chanté', 'avions chanté', 'aviez chanté', 'avaient chanté']);
forms('chanter', 'futurAnterieur',
  ['aurai chanté', 'auras chanté', 'aura chanté', 'aurons chanté', 'aurez chanté', 'auront chanté']);
forms('chanter', 'conditionnelPasse',
  ['aurais chanté', 'aurais chanté', 'aurait chanté', 'aurions chanté', 'auriez chanté', 'auraient chanté']);
forms('chanter', 'subjonctifPasse',
  ['aie chanté', 'aies chanté', 'ait chanté', 'ayons chanté', 'ayez chanté', 'aient chanté']);

// être を助動詞に取る → 主語に性数一致する
forms('aller', 'passeCompose',
  ['suis allé', 'es allé', 'est allé', 'sommes allés', 'êtes allés', 'sont allés']);
eq('aller 複合過去（女性）',
  conj.get('aller', 'passeCompose', { gender: 'f' }).forms,
  ['suis allée', 'es allée', 'est allée', 'sommes allées', 'êtes allées', 'sont allées']);

forms('venir', 'passeCompose',
  ['suis venu', 'es venu', 'est venu', 'sommes venus', 'êtes venus', 'sont venus']);
forms('mourir', 'passeCompose',
  ['suis mort', 'es mort', 'est mort', 'sommes morts', 'êtes morts', 'sont morts']);

eq('avoir の複合過去', conj.get('avoir', 'passeCompose').forms[0], 'ai eu');
eq('être の複合過去', conj.get('être', 'passeCompose').forms[0], 'ai été');

/* ==================== 非人称動詞 ==================== */

forms('falloir', 'present', [null, null, 'faut', null, null, null]);
forms('falloir', 'futur', [null, null, 'faudra', null, null, null]);
forms('falloir', 'imparfait', [null, null, 'fallait', null, null, null]);
forms('falloir', 'subjonctif', [null, null, 'faille', null, null, null]);
forms('pleuvoir', 'present', [null, null, 'pleut', null, null, null]);
forms('pleuvoir', 'passeCompose', [null, null, 'a plu', null, null, null]);

/* ==================== 代名動詞 ==================== */

forms('se coucher', 'present',
  ['me couche', 'te couches', 'se couche', 'nous couchons', 'vous couchez', 'se couchent']);

// 母音で始まる動詞では再帰代名詞がエリジオンする
forms('s\'appeler', 'present',
  ["m'appelle", "t'appelles", "s'appelle", 'nous appelons', 'vous appelez', "s'appellent"]);

// 代名動詞の助動詞は例外なく être。
// 助動詞 es / est は母音で始まるので、再帰代名詞がここでもエリジオンする
forms('se coucher', 'passeCompose',
  ['me suis couché', "t'es couché", "s'est couché", 'nous sommes couchés', 'vous êtes couchés', 'se sont couchés']);

eq('代名動詞の助動詞は être', conj.info('se coucher').aux, 'être');
eq('代名動詞と分かる', conj.info('se coucher').pronominal, true);
eq('代名動詞の表示名', conj.info('se coucher').inf, 'se coucher');
eq('代名動詞の意味を引く', conj.info('se lever').ja, '起きる');

// 命令形は動詞の後ろにハイフンでつなぎ、te は toi になる
forms('se coucher', 'imperatif', ['couche-toi', 'couchons-nous', 'couchez-vous']);
forms('se lever', 'imperatif', ['lève-toi', 'levons-nous', 'levez-vous']);

eq('主語つきの代名動詞', conj.line('se coucher', 'present', 0), 'je me couche');
eq("代名動詞のエリジオン", conj.line("s'appeler", 'present', 0), "je m'appelle");

// il se couche と ils se couchent は同音
eq('代名動詞の同音判定',
  conj.homophoneGroups(conj.get('se coucher', 'present').forms), [[2, 5]]);

// ":::conj se coucher présent" のような指定を正しく分解できるか
eq('指定の分解（代名動詞）',
  conj.parseDirective('se coucher présent'), { verbs: ['se coucher'], tenses: ['présent'] });
eq('指定の分解（複数時制）',
  conj.parseDirective('chanter présent,futur'), { verbs: ['chanter'], tenses: ['présent', 'futur'] });
eq('指定の分解（複数動詞）',
  conj.parseDirective('chanter,finir présent'), { verbs: ['chanter', 'finir'], tenses: ['présent'] });
eq('指定の分解（時制なし）',
  conj.parseDirective('chanter'), { verbs: ['chanter'], tenses: [] });
eq('指定の分解（代名動詞・時制なし）',
  conj.parseDirective('se lever'), { verbs: ['se lever'], tenses: [] });

/* ==================== 主語つきの行（エリジオン） ==================== */

eq('je + chante', conj.line('chanter', 'present', 0), 'je chante');
eq("j' + ai（エリジオン）", conj.line('avoir', 'present', 0), "j'ai");
eq("j' + aime（エリジオン）", conj.line('aimer', 'present', 0), "j'aime");
eq('nous + chantons', conj.line('chanter', 'present', 3), 'nous chantons');
eq('que je + chante', conj.line('chanter', 'subjonctif', 0), 'que je chante');
eq("que j' + aie", conj.line('avoir', 'subjonctif', 0), "que j'aie");
eq('命令法は主語なし', conj.line('chanter', 'imperatif', 0), 'chante');

/* ==================== 語幹と語尾の切り分け ==================== */

eq('chanter/futur の切り分け', conj.split('chanter', 'futur', 0), { stem: 'chanter', ending: 'ai' });
eq('finir/present の切り分け', conj.split('finir', 'present', 3), { stem: 'fin', ending: 'issons' });
eq('複合時制の切り分け', conj.split('chanter', 'passeCompose', 0), { stem: 'ai ', ending: 'chanté' });

eq('未来語幹（規則）', conj.stem('chanter', 'futur'), 'chanter');
eq('未来語幹（不規則）', conj.stem('aller', 'futur'), 'ir');
eq('半過去語幹', conj.stem('finir', 'imparfait'), 'finiss');
eq('接続法語幹', conj.stem('prendre', 'subjonctif'), 'prenn');

/* ==================== 同音の判定 ==================== */
/* 活用表で最も気づきにくい「綴りは違うが音は同じ」を正しく束ねられるか */

eq('-er 現在は je/tu/il/ils が同音',
  conj.homophoneGroups(conj.get('chanter', 'present').forms), [[0, 1, 2, 5]]);

eq('finir 現在は je/tu/il が同音',
  conj.homophoneGroups(conj.get('finir', 'present').forms), [[0, 1, 2]]);

// attendre: attends/attends/attend は同音だが attendent は d を発音するので別
eq('attendre 現在は je/tu/il のみ同音',
  conj.homophoneGroups(conj.get('attendre', 'present').forms), [[0, 1, 2]]);

// prendre: prends/prends/prend が同音、prennent は別
eq('prendre 現在は je/tu/il のみ同音',
  conj.homophoneGroups(conj.get('prendre', 'present').forms), [[0, 1, 2]]);

// 半過去は je/tu/il/ils の4つが同音（-ais, -ais, -ait, -aient はすべて [ɛ]）
eq('半過去は4つが同音',
  conj.homophoneGroups(conj.get('chanter', 'imparfait').forms), [[0, 1, 2, 5]]);

// voir: vois / vois / voit / voient はすべて [vwa]
eq('voir 現在は4つが同音',
  conj.homophoneGroups(conj.get('voir', 'present').forms), [[0, 1, 2, 5]]);

// être: tu es と il est が同音 [ɛ]
eq('être 現在は tu/il が同音',
  conj.homophoneGroups(conj.get('être', 'present').forms), [[1, 2]]);

// avoir: tu as と il a が同音 [a]
eq('avoir 現在は tu/il が同音',
  conj.homophoneGroups(conj.get('avoir', 'present').forms), [[1, 2]]);

// 単純未来は2組できる。tu -as / il -a が [a]、
// さらに nous -ons / ils -ont がどちらも [ɔ̃] で完全に同音になる（学習者の難所）
eq('単純未来は tu/il と nous/ils の2組が同音',
  conj.homophoneGroups(conj.get('chanter', 'futur').forms), [[1, 2], [3, 5]]);

// 条件法現在も半過去と同じ語尾なので4つが同音。単純未来との聞き分けが難所になる
eq('条件法現在は4つが同音',
  conj.homophoneGroups(conj.get('chanter', 'conditionnel').forms), [[0, 1, 2, 5]]);

// 命令法は3形しかないので、末尾を ils 扱いしてはいけない
eq('命令法に同音の組はない',
  conj.homophoneGroups(conj.get('chanter', 'imperatif').forms), []);

/* ==================== 情報の取得 ==================== */

eq('aller の助動詞', conj.info('aller').aux, 'être');
eq('chanter の助動詞', conj.info('chanter').aux, 'avoir');
eq('être は不規則', conj.info('être').irregular, true);
eq('chanter は規則', conj.info('chanter').irregular, false);
eq('未登録動詞も推定できる', conj.get('bavarder', 'present').forms[0], 'bavarde');

eq('時制の別名（日本語）', conj.normalizeTense('複合過去'), 'passeCompose');
eq('時制の別名（アクセントあり）', conj.normalizeTense('passé-composé'), 'passeCompose');
eq('時制の別名（略記）', conj.normalizeTense('pc'), 'passeCompose');

eq('アクセント除去', conj.deaccent('achète'), 'achete');
eq('アクセント除去（複数）', conj.deaccent('préférerions'), 'prefererions');

/* ==================== 結果 ==================== */

console.log('');
if (fail) {
  console.log('失敗した検証:');
  failures.forEach(f => console.log(f));
  console.log('');
}
console.log(`活用エンジン: ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
