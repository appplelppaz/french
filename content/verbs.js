/* verbs.js — 動詞データベース
 *
 * 方針: 全時制をベタ書きしない。フランス語の活用は「語幹 × 語尾」で説明でき、
 * 一見バラバラな不規則動詞も、次の4つさえ分かれば残りは機械的に導ける。
 *
 *   1. 直説法現在の6形        → ここから半過去語幹（nous形）と接続法語幹（ils形）が出る
 *   2. 未来語幹 (futStem)     → 単純未来と条件法現在の両方がここから出る
 *   3. 過去分詞 (pp)          → すべての複合時制がここから出る
 *   4. 単純過去の語幹と型 (ps)
 *
 * だから各動詞のデータはこれだけで足りる。この「実は規則的」という構造そのものが
 * 学習者にとっての武器なので、第13章ではこの図式を明示する。
 *
 * 省略可能なフィールド:
 *   impfStem  半過去語幹。既定は「nous の現在形 − ons」。être だけが例外。
 *   subj      接続法現在。既定は「ils の現在形 − ent」＋語尾（nous/vous は半過去語幹）。
 *   imper     命令法。既定は現在形の tu/nous/vous から作る。
 *   psForms   単純過去を語幹＋型で導けない動詞（venir / tenir 系）のみ明示する。
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};

  /* ---------- 不規則動詞 ---------- */

  FR.VERBS = {

    /* === 最重要の2つ（すべての複合時制の助動詞） === */

    'être': {
      ja: '〜である、いる', group: 3, aux: 'avoir', pp: 'été', presP: 'étant',
      present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
      futStem: 'ser',
      impfStem: 'ét',                                   // 唯一、nous 形から導けない
      subj: ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient'],
      imper: ['sois', 'soyons', 'soyez'],
      ps: { stem: 'f', type: 'u' },
      note: '最頻出。助動詞としても使うので、全時制を最優先で覚える。'
    },

    'avoir': {
      ja: '持つ、ある', group: 3, aux: 'avoir', pp: 'eu', presP: 'ayant',
      present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
      futStem: 'aur',
      subj: ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient'],
      imper: ['aie', 'ayons', 'ayez'],
      ps: { stem: 'e', type: 'u' },
      note: '複合過去の助動詞の大多数がこれ。過去分詞 eu は「ユ」と読む。'
    },

    /* === 移動・往来 === */

    'aller': {
      ja: '行く', group: 3, aux: 'être', pp: 'allé', presP: 'allant',
      present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'],
      futStem: 'ir',                                    // 不定詞と似ても似つかない
      subj: ['aille', 'ailles', 'aille', 'allions', 'alliez', 'aillent'],
      imper: ['va', 'allons', 'allez'],
      ps: { stem: 'all', type: 'a' },
      note: '-er で終わるが第1群ではない。近接未来 aller + 不定詞 を作る。'
    },

    'venir': {
      ja: '来る', group: 3, aux: 'être', pp: 'venu', presP: 'venant',
      present: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'],
      futStem: 'viendr',
      subj: ['vienne', 'viennes', 'vienne', 'venions', 'veniez', 'viennent'],
      psForms: ['vins', 'vins', 'vint', 'vînmes', 'vîntes', 'vinrent'],
      note: '近接過去 venir de + 不定詞 を作る。tenir と同じ型。'
    },

    'devenir': {
      ja: '〜になる', group: 3, aux: 'être', pp: 'devenu', presP: 'devenant',
      present: ['deviens', 'deviens', 'devient', 'devenons', 'devenez', 'deviennent'],
      futStem: 'deviendr',
      subj: ['devienne', 'deviennes', 'devienne', 'devenions', 'deveniez', 'deviennent'],
      psForms: ['devins', 'devins', 'devint', 'devînmes', 'devîntes', 'devinrent']
    },

    'revenir': {
      ja: '戻ってくる', group: 3, aux: 'être', pp: 'revenu', presP: 'revenant',
      present: ['reviens', 'reviens', 'revient', 'revenons', 'revenez', 'reviennent'],
      futStem: 'reviendr',
      subj: ['revienne', 'reviennes', 'revienne', 'revenions', 'reveniez', 'reviennent'],
      psForms: ['revins', 'revins', 'revint', 'revînmes', 'revîntes', 'revinrent']
    },

    'tenir': {
      ja: '持つ、保つ', group: 3, aux: 'avoir', pp: 'tenu', presP: 'tenant',
      present: ['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'],
      futStem: 'tiendr',
      subj: ['tienne', 'tiennes', 'tienne', 'tenions', 'teniez', 'tiennent'],
      psForms: ['tins', 'tins', 'tint', 'tînmes', 'tîntes', 'tinrent']
    },

    'partir': {
      ja: '出発する', group: 3, aux: 'être', pp: 'parti', presP: 'partant',
      present: ['pars', 'pars', 'part', 'partons', 'partez', 'partent'],
      futStem: 'partir',
      ps: { stem: 'part', type: 'i' },
      note: '-ir だが第2群ではない（-iss- が入らない）。sortir, dormir と同じ型。'
    },

    'sortir': {
      ja: '出る、外出する', group: 3, aux: 'être', pp: 'sorti', presP: 'sortant',
      present: ['sors', 'sors', 'sort', 'sortons', 'sortez', 'sortent'],
      futStem: 'sortir',
      ps: { stem: 'sort', type: 'i' },
      note: '「〜を持ち出す」の他動詞用法では助動詞が avoir になる。'
    },

    'dormir': {
      ja: '眠る', group: 3, aux: 'avoir', pp: 'dormi', presP: 'dormant',
      present: ['dors', 'dors', 'dort', 'dormons', 'dormez', 'dorment'],
      futStem: 'dormir',
      ps: { stem: 'dorm', type: 'i' }
    },

    'courir': {
      ja: '走る', group: 3, aux: 'avoir', pp: 'couru', presP: 'courant',
      present: ['cours', 'cours', 'court', 'courons', 'courez', 'courent'],
      futStem: 'courr',                                 // r が2つ。conditionnel と区別しにくい難所
      ps: { stem: 'cour', type: 'u' }
    },

    'naître': {
      ja: '生まれる', group: 3, aux: 'être', pp: 'né', presP: 'naissant',
      present: ['nais', 'nais', 'naît', 'naissons', 'naissez', 'naissent'],
      futStem: 'naîtr',
      ps: { stem: 'naqu', type: 'i' }
    },

    'mourir': {
      ja: '死ぬ', group: 3, aux: 'être', pp: 'mort', presP: 'mourant',
      present: ['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent'],
      futStem: 'mourr',
      ps: { stem: 'mour', type: 'u' }
    },

    /* === 基本動詞 === */

    'faire': {
      ja: 'する、作る', group: 3, aux: 'avoir', pp: 'fait', presP: 'faisant',
      present: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'],
      futStem: 'fer',
      subj: ['fasse', 'fasses', 'fasse', 'fassions', 'fassiez', 'fassent'],
      ps: { stem: 'f', type: 'i' },
      note: 'vous faites は -ez で終わらない数少ない動詞（dire, être と合わせて3つ）。'
    },

    'prendre': {
      ja: '取る、乗る、食べる', group: 3, aux: 'avoir', pp: 'pris', presP: 'prenant',
      present: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'],
      futStem: 'prendr',
      subj: ['prenne', 'prennes', 'prenne', 'prenions', 'preniez', 'prennent'],
      ps: { stem: 'pr', type: 'i' },
      note: 'comprendre, apprendre も同型。複数形で d が落ち、n が重なる。'
    },

    'mettre': {
      ja: '置く、着る', group: 3, aux: 'avoir', pp: 'mis', presP: 'mettant',
      present: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'],
      futStem: 'mettr',
      ps: { stem: 'm', type: 'i' }
    },

    'dire': {
      ja: '言う', group: 3, aux: 'avoir', pp: 'dit', presP: 'disant',
      present: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'],
      futStem: 'dir',
      ps: { stem: 'd', type: 'i' },
      note: 'vous dites に注意（× disez）。'
    },

    'lire': {
      ja: '読む', group: 3, aux: 'avoir', pp: 'lu', presP: 'lisant',
      present: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'],
      futStem: 'lir',
      ps: { stem: 'l', type: 'u' }
    },

    'écrire': {
      ja: '書く', group: 3, aux: 'avoir', pp: 'écrit', presP: 'écrivant',
      present: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'],
      futStem: 'écrir',
      ps: { stem: 'écriv', type: 'i' }
    },

    'voir': {
      ja: '見る、会う', group: 3, aux: 'avoir', pp: 'vu', presP: 'voyant',
      present: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'],
      futStem: 'verr',
      subj: ['voie', 'voies', 'voie', 'voyions', 'voyiez', 'voient'],
      ps: { stem: 'v', type: 'i' }
    },

    'croire': {
      ja: '信じる、思う', group: 3, aux: 'avoir', pp: 'cru', presP: 'croyant',
      present: ['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'],
      futStem: 'croir',
      subj: ['croie', 'croies', 'croie', 'croyions', 'croyiez', 'croient'],
      ps: { stem: 'cr', type: 'u' }
    },

    'boire': {
      ja: '飲む', group: 3, aux: 'avoir', pp: 'bu', presP: 'buvant',
      present: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'],
      futStem: 'boir',
      subj: ['boive', 'boives', 'boive', 'buvions', 'buviez', 'boivent'],
      ps: { stem: 'b', type: 'u' }
    },

    'connaître': {
      ja: '（人・場所を）知っている', group: 3, aux: 'avoir', pp: 'connu', presP: 'connaissant',
      present: ['connais', 'connais', 'connaît', 'connaissons', 'connaissez', 'connaissent'],
      futStem: 'connaîtr',
      ps: { stem: 'conn', type: 'u' },
      note: 'savoir との使い分けが要点。connaître は「面識・体験として知る」。'
    },

    'vivre': {
      ja: '生きる、暮らす', group: 3, aux: 'avoir', pp: 'vécu', presP: 'vivant',
      present: ['vis', 'vis', 'vit', 'vivons', 'vivez', 'vivent'],
      futStem: 'vivr',
      ps: { stem: 'véc', type: 'u' }
    },

    'suivre': {
      ja: 'follow、（授業を）取る', group: 3, aux: 'avoir', pp: 'suivi', presP: 'suivant',
      present: ['suis', 'suis', 'suit', 'suivons', 'suivez', 'suivent'],
      futStem: 'suivr',
      ps: { stem: 'suiv', type: 'i' },
      note: 'je suis は être（私は〜である）と同形。文脈で判断する。'
    },

    'ouvrir': {
      ja: '開ける', group: 3, aux: 'avoir', pp: 'ouvert', presP: 'ouvrant',
      present: ['ouvre', 'ouvres', 'ouvre', 'ouvrons', 'ouvrez', 'ouvrent'],
      futStem: 'ouvrir',
      ps: { stem: 'ouvr', type: 'i' },
      note: '-ir なのに現在形の語尾が第1群（-e, -es, -e）。offrir, souffrir も同型。'
    },

    'recevoir': {
      ja: '受け取る', group: 3, aux: 'avoir', pp: 'reçu', presP: 'recevant',
      present: ['reçois', 'reçois', 'reçoit', 'recevons', 'recevez', 'reçoivent'],
      futStem: 'recevr',
      ps: { stem: 'reç', type: 'u' }
    },

    /* === 助動詞的に使う4つ === */

    'pouvoir': {
      ja: '〜できる', group: 3, aux: 'avoir', pp: 'pu', presP: 'pouvant',
      present: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'],
      futStem: 'pourr',
      subj: ['puisse', 'puisses', 'puisse', 'puissions', 'puissiez', 'puissent'],
      imper: null,                                      // 命令法を持たない
      ps: { stem: 'p', type: 'u' },
      note: '疑問文の倒置では je puis…? という古形を使う（Puis-je …?）。'
    },

    'vouloir': {
      ja: '〜したい、欲しい', group: 3, aux: 'avoir', pp: 'voulu', presP: 'voulant',
      present: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'],
      futStem: 'voudr',
      subj: ['veuille', 'veuilles', 'veuille', 'voulions', 'vouliez', 'veuillent'],
      imper: ['veuille', 'veuillons', 'veuillez'],
      ps: { stem: 'voul', type: 'u' },
      note: '命令法 veuillez は「どうぞ〜してください」の丁寧表現として頻出。'
    },

    'devoir': {
      ja: '〜しなければならない', group: 3, aux: 'avoir', pp: 'dû', presP: 'devant',
      present: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'],
      futStem: 'devr',
      subj: ['doive', 'doives', 'doive', 'devions', 'deviez', 'doivent'],
      ps: { stem: 'd', type: 'u' },
      note: '過去分詞 dû のアクセント記号は男性単数のみ（女性形は due）。'
    },

    'savoir': {
      ja: '（知識として）知る、〜できる', group: 3, aux: 'avoir', pp: 'su', presP: 'sachant',
      present: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'],
      futStem: 'saur',
      subj: ['sache', 'saches', 'sache', 'sachions', 'sachiez', 'sachent'],
      imper: ['sache', 'sachons', 'sachez'],
      ps: { stem: 's', type: 'u' }
    },

    /* === 非人称動詞 === */

    'falloir': {
      ja: '〜が必要である', group: 3, aux: 'avoir', pp: 'fallu', presP: null,
      impersonal: true,
      present: [null, null, 'faut', null, null, null],
      futStem: 'faudr',
      impfStem: 'fall',
      subj: [null, null, 'faille', null, null, null],
      imper: null,
      ps: { stem: 'fall', type: 'u' },
      note: 'il 以外の主語を取らない。il faut + 不定詞／il faut que + 接続法。'
    },

    'pleuvoir': {
      ja: '雨が降る', group: 3, aux: 'avoir', pp: 'plu', presP: 'pleuvant',
      impersonal: true,
      present: [null, null, 'pleut', null, null, null],
      futStem: 'pleuvr',
      impfStem: 'pleuv',
      subj: [null, null, 'pleuve', null, null, null],
      imper: null,
      ps: { stem: 'pl', type: 'u' }
    }
  };

  /* ---------- 規則動詞の語彙（活用はエンジンが規則で生成する） ---------- */
  /* group / aux / 和訳 のみを持たせる。綴りの変化型は conjugation.js が自動判定する。 */

  FR.REGULAR_VERBS = {
    // 第1群 -er
    'parler':     { ja: '話す', group: 1 },
    'chanter':    { ja: '歌う', group: 1 },
    'aimer':      { ja: '愛する、好む', group: 1 },
    'danser':     { ja: '踊る', group: 1 },
    'habiter':    { ja: '住む', group: 1 },
    'regarder':   { ja: '見る', group: 1 },
    'écouter':    { ja: '聞く', group: 1 },
    'travailler': { ja: '働く、勉強する', group: 1 },
    'donner':     { ja: '与える', group: 1 },
    'trouver':    { ja: '見つける、〜と思う', group: 1 },
    'penser':     { ja: '考える', group: 1 },
    'chercher':   { ja: '探す', group: 1 },
    'jouer':      { ja: '遊ぶ、演奏する', group: 1 },
    'étudier':    { ja: '勉強する', group: 1 },
    'demander':   { ja: '尋ねる、頼む', group: 1 },
    'porter':     { ja: '運ぶ、身につける', group: 1 },
    'oublier':    { ja: '忘れる', group: 1 },
    'arriver':    { ja: '到着する', group: 1, aux: 'être' },
    'entrer':     { ja: '入る', group: 1, aux: 'être' },
    'rester':     { ja: 'とどまる', group: 1, aux: 'être' },
    'tomber':     { ja: '倒れる、落ちる', group: 1, aux: 'être' },
    'rentrer':    { ja: '帰る', group: 1, aux: 'être' },
    'monter':     { ja: '上がる', group: 1, aux: 'être' },
    'passer':     { ja: '通る、過ごす', group: 1, aux: 'être' },

    // 第1群・綴りが変わる型
    'manger':     { ja: '食べる', group: 1 },
    'voyager':    { ja: '旅行する', group: 1 },
    'commencer':  { ja: '始める', group: 1 },
    'appeler':    { ja: '呼ぶ', group: 1 },
    'jeter':      { ja: '投げる', group: 1 },
    'acheter':    { ja: '買う', group: 1 },
    'lever':      { ja: '上げる', group: 1 },
    'préférer':   { ja: '〜のほうが好き', group: 1 },
    'espérer':    { ja: '期待する', group: 1 },
    'répéter':    { ja: '繰り返す', group: 1 },
    'payer':      { ja: '払う', group: 1 },
    'envoyer':    { ja: '送る', group: 1 },      // 未来語幹だけ不規則（enverr-）
    'essayer':    { ja: '試す', group: 1 },
    'nettoyer':   { ja: '掃除する', group: 1 },

    // 第2群 -ir（-iss- が入る）
    'finir':      { ja: '終える', group: 2 },
    'choisir':    { ja: '選ぶ', group: 2 },
    'réussir':    { ja: '成功する', group: 2 },
    'grandir':    { ja: '大きくなる', group: 2 },
    'réfléchir':  { ja: '熟考する', group: 2 },
    'obéir':      { ja: '従う', group: 2 },
    'remplir':    { ja: '満たす', group: 2 },
    'rougir':     { ja: '赤くなる', group: 2 },

    // 第3群 -re（attendre 型）
    'attendre':   { ja: '待つ', group: 3 },
    'entendre':   { ja: '聞こえる', group: 3 },
    'répondre':   { ja: '答える', group: 3 },
    'vendre':     { ja: '売る', group: 3 },
    'perdre':     { ja: '失う', group: 3 },
    'descendre':  { ja: '降りる', group: 3, aux: 'être' },
    'rendre':     { ja: '返す', group: 3 }
  };

  /* 未来語幹だけが不規則な第1群動詞 */
  FR.IRREGULAR_FUTURE_STEMS = {
    'envoyer': 'enverr',
    'renvoyer': 'renverr'
  };

  /* -eler / -eter のうち、子音を重ねずアクサン・グラーヴを付ける動詞 */
  FR.GRAVE_ELER_ETER = [
    'acheter', 'geler', 'congeler', 'dégeler', 'peler', 'modeler', 'harceler',
    'celer', 'démanteler', 'écarteler', 'marteler', 'crocheter', 'fureter',
    'haleter', 'racheter'
  ];

}(typeof window !== 'undefined' ? window : globalThis));
