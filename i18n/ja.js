/* 日本語 */
(function (g) {
  g.PT_I18N = g.PT_I18N || {};
  g.PT_I18N.ja = {
    /* BCP-47。speechSynthesis の lang に渡す */
    bcp47: 'ja-JP',

    appName: 'プランクタイマー',
    appNameShort: 'Plank Timer',

    /* フェーズ表示 */
    ready: '準備',
    work: '運動中',
    rest: '休憩中',
    finished: 'おつかれさまでした',

    /* セット表示 */
    setLabel: 'セット',

    /* 操作 */
    start: 'スタート',
    pause: '一時停止',
    resume: '再開',
    reset: 'リセット',

    /* 設定パネル */
    settings: '設定',
    close: '閉じる',
    workTime: '運動の時間',
    restTime: '休憩の時間',
    setsCount: 'セット数',
    restZeroNote: '0秒にすると休憩なしで続けます',
    sound: '合図音',
    voice: '声',
    language: '言語',
    langAuto: '自動',
    langJa: '日本語',
    langEn: 'English',
    on: 'ON',
    off: 'OFF',

    /* 応援の一言（画面に出すだけ。声には出さない） */
    cheerIdle: 'はじめましょう',
    cheerWork: 'その調子！',
    cheerRest: 'ひと息ついて',
    cheerDone: 'よくがんばりました',

    /* 単位 */
    unitMin: '分',
    unitSec: '秒',
    unitSets: 'セット',

    /* メニューのリンク */
    officialSite: '公式サイト',
    supportDev: 'アプリ開発を応援する',

    /* 投げ銭バナー */
    tipText: 'このアプリが役に立ったら、開発を応援してもらえると励みになります。',
    tipButton: '応援する',
    tipClose: '閉じる',

    /* 読み上げ（これ以外は喋らせない） */
    speakTenLeft: '残り10秒',
    speak3: '3',
    speak2: '2',
    speak1: '1'
  };
})(window);
