/* conjugation.js — 動詞活用エンジン
 *
 * 設計の中心にある考え方:
 *   フランス語の活用は「語幹 × 語尾」に分解できる。語尾は時制ごとにほぼ固定で、
 *   動詞ごとに違うのは語幹のほうだけ。しかもその語幹どうしにも依存関係がある。
 *
 *     不定詞 ──────────→ 未来語幹 ──→ 単純未来
 *                                  └─→ 条件法現在（語尾は半過去と同じ）
 *     直説法現在 nous ─→ 半過去語幹 ─→ 半過去
 *     直説法現在 ils ──→ 接続法語幹 ─→ 接続法現在
 *     過去分詞 ────────→ すべての複合時制（助動詞 + 過去分詞）
 *
 *   だから覚えるのは「現在形・未来語幹・過去分詞」の3つで、残りは導出できる。
 *   このエンジンはその導出をそのままコードにしたもので、第13章の全体図と対応する。
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};

  var PERSONS = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];

  /* ---------- 時制のメタデータ ---------- */

  var TENSES = [
    { key: 'present',          ja: '直説法現在',     fr: 'présent',              mood: '直説法' },
    { key: 'passeCompose',     ja: '複合過去',       fr: 'passé composé',        mood: '直説法', compound: 'present' },
    { key: 'imparfait',        ja: '半過去',         fr: 'imparfait',            mood: '直説法' },
    { key: 'plusQueParfait',   ja: '大過去',         fr: 'plus-que-parfait',     mood: '直説法', compound: 'imparfait' },
    { key: 'futur',            ja: '単純未来',       fr: 'futur simple',         mood: '直説法' },
    { key: 'futurAnterieur',   ja: '前未来',         fr: 'futur antérieur',      mood: '直説法', compound: 'futur' },
    { key: 'passeSimple',      ja: '単純過去',       fr: 'passé simple',         mood: '直説法', literary: true },
    { key: 'conditionnel',     ja: '条件法現在',     fr: 'conditionnel présent', mood: '条件法' },
    { key: 'conditionnelPasse',ja: '条件法過去',     fr: 'conditionnel passé',   mood: '条件法', compound: 'conditionnel' },
    { key: 'subjonctif',       ja: '接続法現在',     fr: 'subjonctif présent',   mood: '接続法', prefix: 'que ' },
    { key: 'subjonctifPasse',  ja: '接続法過去',     fr: 'subjonctif passé',     mood: '接続法', prefix: 'que ', compound: 'subjonctif' },
    { key: 'imperatif',        ja: '命令法',         fr: 'impératif',            mood: '命令法', persons: ['tu', 'nous', 'vous'] }
  ];

  var TENSE_BY_KEY = {};
  TENSES.forEach(function (t) { TENSE_BY_KEY[t.key] = t; });

  /* 原稿で使える別名。アクセント記号あり・なし、ハイフン区切りの両方を受ける。 */
  var ALIASES = {
    'present': 'present', 'présent': 'present', 'pres': 'present', '現在': 'present',
    'passecompose': 'passeCompose', 'passé-composé': 'passeCompose', 'passe-compose': 'passeCompose',
    'pc': 'passeCompose', '複合過去': 'passeCompose',
    'imparfait': 'imparfait', 'imp': 'imparfait', '半過去': 'imparfait',
    'plusqueparfait': 'plusQueParfait', 'plus-que-parfait': 'plusQueParfait', 'pqp': 'plusQueParfait', '大過去': 'plusQueParfait',
    'futur': 'futur', 'future': 'futur', 'futursimple': 'futur', 'futur-simple': 'futur', '単純未来': 'futur', '未来': 'futur',
    'futuranterieur': 'futurAnterieur', 'futur-antérieur': 'futurAnterieur', 'futur-anterieur': 'futurAnterieur', '前未来': 'futurAnterieur',
    'passesimple': 'passeSimple', 'passé-simple': 'passeSimple', 'passe-simple': 'passeSimple', 'ps': 'passeSimple', '単純過去': 'passeSimple',
    'conditionnel': 'conditionnel', 'cond': 'conditionnel', '条件法': 'conditionnel', '条件法現在': 'conditionnel',
    'conditionnelpasse': 'conditionnelPasse', 'conditionnel-passé': 'conditionnelPasse', 'conditionnel-passe': 'conditionnelPasse', '条件法過去': 'conditionnelPasse',
    'subjonctif': 'subjonctif', 'subj': 'subjonctif', '接続法': 'subjonctif', '接続法現在': 'subjonctif',
    'subjonctifpasse': 'subjonctifPasse', 'subjonctif-passé': 'subjonctifPasse', 'subjonctif-passe': 'subjonctifPasse', '接続法過去': 'subjonctifPasse',
    'imperatif': 'imperatif', 'impératif': 'imperatif', 'imper': 'imperatif', '命令法': 'imperatif', '命令形': 'imperatif'
  };

  function normalizeTense(name) {
    if (!name) return null;
    var k = String(name).trim();
    if (TENSE_BY_KEY[k]) return k;
    var lower = k.toLowerCase().replace(/\s+/g, '');
    return ALIASES[lower] || ALIASES[lower.replace(/-/g, '')] || null;
  }

  /* ---------- 語尾のセット ---------- */

  var ENDINGS = {
    er:         ['e', 'es', 'e', 'ons', 'ez', 'ent'],
    ir2:        ['is', 'is', 'it', 'issons', 'issez', 'issent'],
    re:         ['s', 's', '', 'ons', 'ez', 'ent'],
    imparfait:  ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'],
    futur:      ['ai', 'as', 'a', 'ons', 'ez', 'ont'],
    subjonctif: ['e', 'es', 'e', 'ions', 'iez', 'ent'],
    psA:        ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'],
    psI:        ['is', 'is', 'it', 'îmes', 'îtes', 'irent'],
    psU:        ['us', 'us', 'ut', 'ûmes', 'ûtes', 'urent']
  };

  /* ---------- 綴りの変化（第1群） ---------- */

  var VOWEL_ENDING = /^(e|es|ent)$/;   // 発音されない語尾 = 語幹の綴りが変わる引き金

  function isGraveType(inf) {
    return (FR.GRAVE_ELER_ETER || []).indexOf(inf) !== -1;
  }

  /**
   * 第1群動詞の語幹を、続く語尾に応じて調整する。
   * @param {string} inf 不定詞
   * @param {string} stem 素の語幹（不定詞 − er）
   * @param {string} ending 付ける語尾
   * @param {boolean} silent 語尾が発音されない（e / es / ent）か
   */
  function adjustEr(inf, stem, ending, silent) {
    // -cer → nous commençons（a, o の前で c を ç に）
    if (/cer$/.test(inf) && /^(ons|ais|ait|aient|a|â)/.test(ending)) {
      return stem.replace(/c$/, 'ç');
    }
    // -ger → nous mangeons（a, o の前に e を挟む）
    if (/ger$/.test(inf) && /^(ons|ais|ait|aient|a|â)/.test(ending)) {
      return stem + 'e';
    }
    if (!silent) return stem;

    // -eler / -eter：原則は子音を重ねる（appelle, jette）。acheter 型だけ è を使う。
    if (/(el|et)er$/.test(inf)) {
      if (isGraveType(inf)) return stem.replace(/e([lt])$/, 'è$1');
      return stem.replace(/([lt])$/, '$1$1');
    }
    // e + 子音1つ + er（lever, mener, peser）→ è
    // 子音が2つ以上ある場合（commencer, apprêter）は e が既に発音されているので変えない
    if (/e[^aeiouéèêëy]er$/.test(inf) && !/(el|et)er$/.test(inf)) {
      return stem.replace(/e([^aeiouéèêëy])$/, 'è$1');
    }
    // é + 子音1つ + er（préférer, espérer, compléter）→ è
    if (/é[^aeiouéèêëy]er$/.test(inf)) {
      return stem.replace(/é([^aeiouéèêëy])$/, 'è$1');
    }
    // -ayer / -oyer / -uyer → y を i に
    if (/[aou]yer$/.test(inf)) {
      return stem.replace(/y$/, 'i');
    }
    return stem;
  }

  /* ---------- 動詞の判別 ---------- */

  function lookup(inf) {
    if (!inf) return null;
    var key = String(inf).trim().toLowerCase();
    if (FR.VERBS && FR.VERBS[key]) return { inf: key, data: FR.VERBS[key], irregular: true };
    if (FR.REGULAR_VERBS && FR.REGULAR_VERBS[key]) return { inf: key, data: FR.REGULAR_VERBS[key], irregular: false };
    // 未登録の動詞も、語尾から規則動詞として推定して活用させる
    if (/er$/.test(key)) return { inf: key, data: { group: 1 }, irregular: false, guessed: true };
    if (/ir$/.test(key)) return { inf: key, data: { group: 2 }, irregular: false, guessed: true };
    if (/re$/.test(key)) return { inf: key, data: { group: 3 }, irregular: false, guessed: true };
    return null;
  }

  /** 助動詞に être を取る動詞か */
  function auxOf(entry) {
    return (entry.data && entry.data.aux) || 'avoir';
  }

  /* ---------- 各時制の生成 ---------- */

  function presentForms(entry) {
    var d = entry.data, inf = entry.inf;
    if (d.present) return d.present.slice();

    var stem, endings;
    if (d.group === 1) {
      stem = inf.slice(0, -2);
      endings = ENDINGS.er;
      return endings.map(function (e) {
        return adjustEr(inf, stem, e, VOWEL_ENDING.test(e)) + e;
      });
    }
    if (d.group === 2) {
      stem = inf.slice(0, -2);
      return ENDINGS.ir2.map(function (e) { return stem + e; });
    }
    // 第3群 -re（attendre 型）
    stem = inf.slice(0, -2);
    return ENDINGS.re.map(function (e) { return stem + e; });
  }

  /** 半過去語幹 = nous の現在形 − ons（être だけ例外） */
  function imparfaitStem(entry) {
    if (entry.data.impfStem) return entry.data.impfStem;
    var nous = presentForms(entry)[3];
    if (!nous) return null;
    return nous.replace(/ons$/, '');
  }

  function imparfaitForms(entry) {
    var stem = imparfaitStem(entry);
    if (!stem) return blank();
    var inf = entry.inf;
    return ENDINGS.imparfait.map(function (e, i) {
      // manger → nous mangions（i の前では e を落とす）／ commencer → nous commencions
      var s = stem;
      if (entry.data.group === 1 && /^i/.test(e)) {
        if (/ger$/.test(inf)) s = s.replace(/ge$/, 'g');
        if (/cer$/.test(inf)) s = s.replace(/ç$/, 'c');
      }
      return s + e;
    });
  }

  /** 未来語幹。規則動詞は不定詞そのもの（-re は e を落とす）。 */
  function futurStem(entry) {
    if (entry.data.futStem) return entry.data.futStem;
    var inf = entry.inf;
    if (FR.IRREGULAR_FUTURE_STEMS && FR.IRREGULAR_FUTURE_STEMS[inf]) {
      return FR.IRREGULAR_FUTURE_STEMS[inf];
    }
    if (/re$/.test(inf)) return inf.slice(0, -1);
    if (entry.data.group === 1) {
      // 綴りの変化は未来形にも及ぶ（achèterai, appellerai）が、é 型は伝統綴りでは変えない
      var stem = inf.slice(0, -2);
      if (/(el|et)er$/.test(inf)) {
        return (isGraveType(inf) ? stem.replace(/e([lt])$/, 'è$1') : stem.replace(/([lt])$/, '$1$1')) + 'er';
      }
      if (/e[^aeiouéèêëy]er$/.test(inf)) return stem.replace(/e([^aeiouéèêëy])$/, 'è$1') + 'er';
      if (/[aou]yer$/.test(inf)) return stem.replace(/y$/, 'i') + 'er';
    }
    return inf;
  }

  function futurForms(entry) {
    var s = futurStem(entry);
    return ENDINGS.futur.map(function (e) { return s + e; });
  }

  function conditionnelForms(entry) {
    var s = futurStem(entry);
    return ENDINGS.imparfait.map(function (e) { return s + e; });
  }

  /** 接続法現在。語幹 = ils の現在形 − ent。nous/vous だけ半過去語幹を使う。 */
  function subjonctifForms(entry) {
    if (entry.data.subj) return entry.data.subj.slice();
    var pres = presentForms(entry);
    var ils = pres[5];
    if (!ils) return blank();
    var stem = ils.replace(/ent$/, '');
    var impf = imparfaitStem(entry);
    var inf = entry.inf;

    return ENDINGS.subjonctif.map(function (e, i) {
      if (i === 3 || i === 4) {
        var s = impf;
        if (entry.data.group === 1) {
          if (/ger$/.test(inf)) s = s.replace(/ge$/, 'g');
          if (/cer$/.test(inf)) s = s.replace(/ç$/, 'c');
        }
        return s + e;
      }
      return stem + e;
    });
  }

  /** 命令法。第1群と ouvrir 型は tu の -s を落とす。 */
  function imperatifForms(entry) {
    if (entry.data.imper === null) return [null, null, null];
    if (entry.data.imper) return entry.data.imper.slice();
    var pres = presentForms(entry);
    var tu = pres[1];
    if (!tu) return [null, null, null];
    var dropS = entry.data.group === 1 || /^(ouvre|offre|souffre|couvre|découvre|va)/.test(tu);
    if (dropS) tu = tu.replace(/es$/, 'e').replace(/^vas$/, 'va');
    return [tu, pres[3], pres[4]];
  }

  function passeSimpleForms(entry) {
    var d = entry.data;
    if (d.psForms) return d.psForms.slice();
    if (d.ps) {
      var set = d.ps.type === 'a' ? ENDINGS.psA : d.ps.type === 'u' ? ENDINGS.psU : ENDINGS.psI;
      return set.map(function (e) { return d.ps.stem + e; });
    }
    var inf = entry.inf, stem;
    if (d.group === 1) {
      stem = inf.slice(0, -2);
      return ENDINGS.psA.map(function (e, i) {
        var s = stem;
        if (/cer$/.test(inf) && i !== 5) s = s.replace(/c$/, 'ç');
        if (/ger$/.test(inf) && i !== 5) s = s + 'e';
        return s + e;
      });
    }
    stem = inf.slice(0, -2);
    return ENDINGS.psI.map(function (e) { return stem + e; });
  }

  function participePasse(entry) {
    var d = entry.data;
    if (d.pp) return d.pp;
    var inf = entry.inf;
    if (d.group === 1) return inf.slice(0, -2) + 'é';
    if (d.group === 2) return inf.slice(0, -2) + 'i';
    return inf.slice(0, -2) + 'u';
  }

  function participePresent(entry) {
    var d = entry.data;
    if (d.presP !== undefined && d.presP !== null) return d.presP;
    if (d.presP === null) return null;
    var stem = imparfaitStem(entry);
    return stem ? stem + 'ant' : null;
  }

  function blank() { return [null, null, null, null, null, null]; }

  /* ---------- 複合時制 ---------- */

  /**
   * 過去分詞の性数一致を反映した形を返す。
   * être を助動詞に取る動詞は主語に一致する（elle est allée / ils sont allés）。
   */
  function agreePP(pp, personIndex, opts) {
    opts = opts || {};
    if (!opts.agree) return pp;
    // 過去分詞が既に -é などで終わる場合に、性数の語尾を足す
    var fem = opts.gender === 'f';
    var plural = personIndex === 3 || personIndex === 4 || personIndex === 5;
    if (opts.plural != null) plural = opts.plural;
    var out = pp;
    if (fem && !/e$/.test(out)) out += 'e';
    if (plural && !/s$/.test(out)) out += 's';
    return out;
  }

  function compoundForms(entry, auxTenseKey, opts) {
    var aux = auxOf(entry);
    var auxEntry = lookup(aux);
    var auxForms = formsFor(auxEntry, auxTenseKey);
    var pp = participePasse(entry);
    var agree = aux === 'être';

    return auxForms.map(function (a, i) {
      if (!a) return null;
      var p = agree ? agreePP(pp, i, Object.assign({ agree: true }, opts)) : pp;
      return a + ' ' + p;
    });
  }

  /* ---------- 中心の関数 ---------- */

  function formsFor(entry, tenseKey, opts) {
    if (!entry) return blank();
    var t = TENSE_BY_KEY[tenseKey];
    if (!t) return blank();

    var out;
    if (t.compound) {
      out = compoundForms(entry, t.compound, opts);
    } else {
      switch (tenseKey) {
        case 'present':      out = presentForms(entry); break;
        case 'imparfait':    out = imparfaitForms(entry); break;
        case 'futur':        out = futurForms(entry); break;
        case 'conditionnel': out = conditionnelForms(entry); break;
        case 'subjonctif':   out = subjonctifForms(entry); break;
        case 'imperatif':    out = imperatifForms(entry); break;
        case 'passeSimple':  out = passeSimpleForms(entry); break;
        default:             out = blank();
      }
    }

    // 非人称動詞（falloir, pleuvoir）は il の形しか持たない
    if (entry.data.impersonal && tenseKey !== 'imperatif') {
      out = out.map(function (f, i) { return i === 2 ? f : null; });
    }
    return out;
  }

  /* ---------- 語幹と語尾の切り分け（色分け表示用） ---------- */

  function endingSetFor(entry, tenseKey) {
    switch (tenseKey) {
      case 'present':
        if (entry.data.present) return null;                 // 不規則は機械的に切れない
        return entry.data.group === 1 ? ENDINGS.er
             : entry.data.group === 2 ? ENDINGS.ir2 : ENDINGS.re;
      case 'imparfait':    return ENDINGS.imparfait;
      case 'futur':        return ENDINGS.futur;
      case 'conditionnel': return ENDINGS.imparfait;
      case 'subjonctif':   return entry.data.subj ? null : ENDINGS.subjonctif;
      case 'passeSimple':
        if (entry.data.psForms) return null;
        var type = entry.data.ps ? entry.data.ps.type : (entry.data.group === 1 ? 'a' : 'i');
        return type === 'a' ? ENDINGS.psA : type === 'u' ? ENDINGS.psU : ENDINGS.psI;
      default: return null;
    }
  }

  /**
   * 活用形を語幹と語尾に切り分ける。切り分けられない場合は語幹のみ返す。
   * @returns {{stem:string, ending:string}}
   */
  function splitForm(entry, tenseKey, index, form) {
    if (!form) return { stem: '', ending: '' };
    var t = TENSE_BY_KEY[tenseKey];

    // 複合時制は「助動詞 + 過去分詞」で切る
    if (t && t.compound) {
      var sp = form.indexOf(' ');
      if (sp > 0) return { stem: form.slice(0, sp + 1), ending: form.slice(sp + 1) };
      return { stem: form, ending: '' };
    }

    var set = endingSetFor(entry, tenseKey);
    if (set) {
      var e = set[index];
      if (e && form.length > e.length && form.slice(-e.length) === e) {
        return { stem: form.slice(0, -e.length), ending: e };
      }
      if (e === '') return { stem: form, ending: '' };
    }
    return { stem: form, ending: '' };
  }

  /* ---------- 同じ音になる形の判定 ---------- */

  /**
   * 綴りから「発音の骨格」を取り出す。完全な音声表記ではなく、
   * 活用表の中で同音になる形（chante / chantes / chantent）を束ねるための近似。
   *
   * フランス語の語末は、次の3通りに整理できる:
   *   1. 3人称複数の語尾 -ent は丸ごと無音（chantent → chant / voient → voi）
   *   2. 無音の e / es も落ちるが、その手前の子音は発音される（chante → chant）
   *   3. それ以外の語末子音 s, t, d, x, z, p, g は発音されない（attends → atten）
   *
   * 2 と 3 の違いが肝心で、これがあるから attendre は je/tu/il だけが同音になり、
   * attendent（d を発音する）は別扱いになる。
   *
   * @param {string} form
   * @param {boolean} [is3pl] ils の形か（-ent を語尾として扱ってよいか）
   */
  function phoneticKey(form, is3pl) {
    if (!form) return '';
    var f = String(form).toLowerCase().trim();

    // 複合時制は助動詞の部分だけで判定する
    var sp = f.indexOf(' ');
    if (sp !== -1) {
      return phoneticKey(f.slice(0, sp), is3pl) + ' ' + f.slice(sp + 1);
    }

    if (is3pl && /ent$/.test(f) && f.length > 3) return f.slice(0, -3);

    var stripped;
    if (/es$/.test(f)) stripped = f.slice(0, -2);
    else if (/e$/.test(f)) stripped = f.slice(0, -1);
    if (stripped) return stripped;

    return f.replace(/[stdxzpg]+$/, '') || f;
  }

  /**
   * 同音になる人称の組を返す。例: présent の -er 動詞なら [[0,1,2,5]]
   * @param {Array<string|null>} forms 6人称ぶんの活用形
   */
  function homophoneGroups(forms) {
    var map = {};
    var lastIndex = forms.length - 1;
    forms.forEach(function (f, i) {
      if (!f) return;
      // 6人称そろっている表でのみ、末尾を ils（3人称複数）として扱う
      var k = phoneticKey(f, forms.length === 6 && i === lastIndex);
      (map[k] = map[k] || []).push(i);
    });
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .filter(function (g) { return g.length > 1; });
  }

  /* ---------- 主語代名詞（エリジオン込み） ---------- */

  function elide(pronoun, form) {
    if (pronoun === 'je' && form && /^[aeiouéèêëàâîïôûùüh]/i.test(form)) return "j'";
    return pronoun;
  }

  function pronounsFor(entry, tenseKey) {
    var t = TENSE_BY_KEY[tenseKey];
    if (tenseKey === 'imperatif') return ['(tu)', '(nous)', '(vous)'];
    var forms = formsFor(entry, tenseKey);
    return PERSONS.map(function (p, i) {
      var pr = elide(p, forms[i]);
      return (t && t.prefix ? t.prefix : '') + pr;
    });
  }

  /* ---------- 公開 API ---------- */

  var conj = {
    PERSONS: PERSONS,
    TENSES: TENSES,
    ENDINGS: ENDINGS,

    tense: function (key) { return TENSE_BY_KEY[normalizeTense(key) || key] || null; },
    normalizeTense: normalizeTense,

    /** 動詞が登録されているか（推定も含めて活用可能か） */
    exists: function (inf) { return !!lookup(inf); },

    /** 動詞の基本情報 */
    info: function (inf) {
      var e = lookup(inf);
      if (!e) return null;
      return {
        inf: e.inf,
        ja: e.data.ja || '',
        group: e.data.group,
        irregular: e.irregular,
        guessed: !!e.guessed,
        impersonal: !!e.data.impersonal,
        aux: auxOf(e),
        pp: participePasse(e),
        presP: participePresent(e),
        futStem: futurStem(e),
        impfStem: imparfaitStem(e),
        subjStem: (function () {
          if (e.data.subj) return null;
          var ils = presentForms(e)[5];
          return ils ? ils.replace(/ent$/, '') : null;
        }()),
        note: e.data.note || ''
      };
    },

    /**
     * 活用形を取得する。
     * @param {string} inf 不定詞
     * @param {string} tense 時制（別名可）
     * @param {{gender?:'m'|'f'}} [opts] être 動詞の性数一致
     * @returns {{forms:string[], pronouns:string[], tense:object, verb:string}|null}
     */
    get: function (inf, tense, opts) {
      var e = lookup(inf);
      var key = normalizeTense(tense);
      if (!e || !key) return null;
      return {
        verb: e.inf,
        tense: TENSE_BY_KEY[key],
        forms: formsFor(e, key, opts),
        pronouns: pronounsFor(e, key),
        persons: TENSE_BY_KEY[key].persons || PERSONS
      };
    },

    /** 主語つきの1文（"je chante"）を返す */
    line: function (inf, tense, index, opts) {
      var r = conj.get(inf, tense, opts);
      if (!r || !r.forms[index]) return null;
      var pr = r.pronouns[index];
      if (tense === 'imperatif' || r.tense.key === 'imperatif') return r.forms[index];
      var sep = /'$/.test(pr) ? '' : ' ';
      return pr + sep + r.forms[index];
    },

    split: function (inf, tense, index) {
      var e = lookup(inf);
      var key = normalizeTense(tense);
      if (!e || !key) return { stem: '', ending: '' };
      var forms = formsFor(e, key);
      return splitForm(e, key, index, forms[index]);
    },

    endings: function (tense) {
      var key = normalizeTense(tense);
      switch (key) {
        case 'imparfait':    return ENDINGS.imparfait.slice();
        case 'futur':        return ENDINGS.futur.slice();
        case 'conditionnel': return ENDINGS.imparfait.slice();
        case 'subjonctif':   return ENDINGS.subjonctif.slice();
        default:             return null;
      }
    },

    stem: function (inf, tense) {
      var e = lookup(inf);
      if (!e) return null;
      var key = normalizeTense(tense);
      if (key === 'futur' || key === 'conditionnel') return futurStem(e);
      if (key === 'imparfait') return imparfaitStem(e);
      if (key === 'subjonctif') {
        var ils = presentForms(e)[5];
        return ils ? ils.replace(/ent$/, '') : null;
      }
      return null;
    },

    homophoneGroups: homophoneGroups,
    phoneticKey: phoneticKey,

    /** 登録済みの動詞名を全部返す */
    list: function (filter) {
      var out = Object.keys(FR.VERBS || {}).concat(Object.keys(FR.REGULAR_VERBS || {}));
      if (filter === 'irregular') out = Object.keys(FR.VERBS || {});
      if (filter === 'regular') out = Object.keys(FR.REGULAR_VERBS || {});
      return out.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    },

    /** 答え合わせ用の正規化（アクセント記号を落とす） */
    deaccent: function (s) {
      var t = String(s == null ? '' : s).toLowerCase().trim();
      if (typeof t.normalize !== 'function') return t;
      return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
  };

  FR.conj = conj;

  // Node からもテストできるようにしておく
  if (typeof module !== 'undefined' && module.exports) module.exports = FR;

}(typeof window !== 'undefined' ? window : globalThis));
