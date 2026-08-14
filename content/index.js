/* index.js — 章の一覧
 *
 * 元の教科書の目次（0〜31章）の番号と順序はそのまま保つ。
 * 入門書が省くが大学の仏文法では必須になる項目は、巻末にまとめず、
 * 関連する章の本文に組み込むか、枝番号の節として直後に置く（sub: true）。
 */
(function (global) {
  'use strict';

  var FR = global.FR = global.FR || {};

  FR.toc = [
    { id: 'ch00', no: '0',    title: 'フラ語・発音のルール', sub: '文字と音の対応、リエゾン・エリジオン・アンシェヌマン' },
    { id: 'ch01', no: '1',    title: '名詞',                 sub: 'モノ、コトガラ、ヒト、を表す語' },
    { id: 'ch02', no: '2',    title: '冠詞',                 sub: '名詞に付いて、その性や数を表す語' },
    { id: 'ch03', no: '3',    title: '人称代名詞・主語',     sub: 'わたしは、君は、彼は' },
    { id: 'ch04', no: '4',    title: '提示の表現',           sub: 'voici / voilà 〜、c\'est / ce sont 〜、il y a 〜' },
    { id: 'ch05', no: '5',    title: '否定の表現',           sub: '《ne 動詞 pas》のワンパターン、そしてその先' },
    { id: 'ch06', no: '6',    title: '形容詞',               sub: '「かわいい」靴、欲しい？' },
    { id: 'ch06h', no: '6.5', title: '副詞',                 sub: '形容詞の隣にある、もう一つの修飾語', branch: true },
    { id: 'ch07', no: '7',    title: '前置詞と定冠詞の縮約', sub: 'café au lait の au です' },
    { id: 'ch07h', no: '7.5', title: '前置詞の詳細',         sub: 'à と de を中心に、体系として押さえる', branch: true },
    { id: 'ch08', no: '8',    title: '—er 動詞',             sub: '「歌い」、「踊り」、「愛する」ために' },
    { id: 'ch09', no: '9',    title: '疑問形',               sub: '「愛してる?」を3通りの言い方で' },
    { id: 'ch10', no: '10',   title: '指示・疑問・所有形容詞', sub: '名詞にあわせて変身' },
    { id: 'ch10h', no: '10.5', title: '不定形容詞・不定代名詞', sub: 'tout, chaque, quelque, autre, même, aucun', branch: true },
    { id: 'ch11', no: '11',   title: 'aller / venir',        sub: '近い未来・近い過去' },
    { id: 'ch12', no: '12',   title: '疑問副詞、疑問代名詞', sub: '「いつ」「どこで」「誰が」「なにを」' },
    { id: 'ch13', no: '13',   title: '動詞活用の全体図 & finir', sub: 'お役に立つ課です！' },
    { id: 'ch14', no: '14',   title: '比較級、最上級',       sub: 'マリはヴィーナスより美しい' },
    { id: 'ch15', no: '15',   title: '非人称表現',           sub: '挨拶に最適！ お天気の表現いろいろ' },
    { id: 'ch16', no: '16',   title: '命令形',               sub: '少し愛して 長く愛して……' },
    { id: 'ch17', no: '17',   title: '人称代名詞 直接目的語', sub: 'ジュテーム♥と言いたくて' },
    { id: 'ch18', no: '18',   title: '人称代名詞 間接目的語', sub: '「彼女に」伝えたいこの気持ち' },
    { id: 'ch19', no: '19',   title: '人称代名詞 強勢形',     sub: 'あなたと一緒に♥と言いたくて' },
    { id: 'ch20', no: '20',   title: '複合過去（直説法）',   sub: '一番よく使う過去形' },
    { id: 'ch20h', no: '20.5', title: '単純過去',            sub: '書き言葉だけの過去形', branch: true },
    { id: 'ch21', no: '21',   title: '関係代名詞',           sub: '英語で言えば who, which, where, when にあたります' },
    { id: 'ch22', no: '22',   title: '強調構文',             sub: 'ぼくが好きなのは、マリ' },
    { id: 'ch23', no: '23',   title: '代名動詞',             sub: '「自分を」寝かせる → 寝る' },
    { id: 'ch24', no: '24',   title: '単純未来',             sub: 'でんわしてね♥と彼女は言う（前未来まで）' },
    { id: 'ch25', no: '25',   title: 'en',                   sub: '特殊な代名詞・I 「アン」' },
    { id: 'ch26', no: '26',   title: 'y, le',                sub: '特殊な代名詞・II 「イ」「ル」' },
    { id: 'ch26h', no: '26.5', title: '代名詞の併用と語順',  sub: '2つ以上並べるときの全パターン', branch: true },
    { id: 'ch27', no: '27',   title: '半過去',               sub: '半分だけ過去？「継続／習慣」の過去です' },
    { id: 'ch27h', no: '27.5', title: '大過去',              sub: '過去のさらに前', branch: true },
    { id: 'ch27i', no: '27.6', title: '話法と時制の一致',    sub: '「彼はこう言った」を書き換える', branch: true },
    { id: 'ch28', no: '28',   title: '受動態',               sub: '「愛される」という甘美な♥地獄' },
    { id: 'ch29', no: '29',   title: '現在分詞・ジェロンディフ', sub: '「歌っている」女性歌手を「泣きながら」見つめる' },
    { id: 'ch29h', no: '29½', title: '「法」× 3',            sub: '直説法、条件法、接続法', branch: true },
    { id: 'ch30', no: '30',   title: '条件法',               sub: 'もしぼくが鳥だったら（条件法過去まで）' },
    { id: 'ch31', no: '31',   title: '接続法',               sub: 'あなたが幸せであることを、願っています' },
    { id: 'ch31h', no: '31.5', title: '接続詞と従属節の体系', sub: 'どの接続詞が直説法を取り、どれが接続法を取るか', branch: true }
  ];

  /* 目次の見出し（サイドバーの区切り） */
  FR.tocParts = [
    { before: 'ch00', label: '文字と音' },
    { before: 'ch01', label: '名詞のまわり' },
    { before: 'ch08', label: '動詞を動かす' },
    { before: 'ch17', label: '代名詞' },
    { before: 'ch20', label: '過去を語る' },
    { before: 'ch21', label: '文をつなぐ' },
    { before: 'ch24', label: '未来と仮定' },
    { before: 'ch28', label: '態と法' }
  ];

}(typeof window !== 'undefined' ? window : globalThis));
