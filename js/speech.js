/* 読み上げ。おしゃべりはさせない — カウントダウンと「残り10秒」だけ。 */
var Speech = (function () {
  var enabled = true;
  var voices = [];
  var warmed = false;

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
  }

  if ('speechSynthesis' in window) {
    loadVoices();
    /* Chrome は非同期で声一覧を返す */
    try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
  }

  function pickVoice(bcp47) {
    if (!voices.length) loadVoices();
    if (!voices.length) return null;
    var prefix = bcp47.split('-')[0].toLowerCase();
    var i;
    /* 完全一致を優先 */
    for (i = 0; i < voices.length; i++) {
      if ((voices[i].lang || '').toLowerCase() === bcp47.toLowerCase()) return voices[i];
    }
    /* 言語だけ一致 */
    for (i = 0; i < voices.length; i++) {
      if ((voices[i].lang || '').toLowerCase().indexOf(prefix) === 0) return voices[i];
    }
    return null;
  }

  function speakNow(text, bcp47) {
    if (!enabled) return;
    if (!('speechSynthesis' in window)) return;

    /* Chrome は放置されると内部的に一時停止したまま固まり、
       以降の読み上げを黙って捨てる。喋る前に必ず resume する。 */
    try { speechSynthesis.resume(); } catch (e) {}

    /* ここで cancel() は呼ばない。
       iOS は cancel() の直後の speak() を黙って捨てる。
       喋らせるのは「残り10秒」の1種類だけなので、溜まって打ち消し合うこともない。 */

    var u;
    try { u = new SpeechSynthesisUtterance(text); } catch (e) { return; }
    u.lang = bcp47;
    var v = pickVoice(bcp47);
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;

    try { speechSynthesis.speak(u); } catch (e) {}
  }

  return {
    setEnabled: function (v) {
      enabled = !!v;
      if (!enabled && 'speechSynthesis' in window) {
        try { speechSynthesis.cancel(); } catch (e) {}
      }
    },
    isEnabled: function () { return enabled; },

    /* 合図音と重ならないよう少しだけずらす。
       ただし画面が見えていないときは setTimeout が最大1分まで
       間引かれるので、待たずにその場で喋る。 */
    speak: function (text, bcp47, delayMs) {
      if (!enabled) return;
      var d = typeof delayMs === 'number' ? delayMs : 0;
      if (d > 0 && document.visibilityState === 'visible') {
        setTimeout(function () { speakNow(text, bcp47); }, d);
      } else {
        speakNow(text, bcp47);
      }
    },

    /* ユーザー操作の中から1回だけ呼ぶ。

       iOS は「最初の speak() がユーザー操作の中で行われた」ページでないと、
       以降の読み上げをすべて黙って捨てる。エラーも出ない。
       スタートを押した瞬間に、音量0の空文字を1回喋らせて解錠しておく。
       設定の ON/OFF とは無関係に必要なので enabled は見ない。 */
    warmUp: function () {
      if (warmed) return;
      if (!('speechSynthesis' in window)) return;
      warmed = true;
      try {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch (e) {}
    },

    cancel: function () {
      if (!('speechSynthesis' in window)) return;
      try { speechSynthesis.cancel(); } catch (e) {}
    },

    /* バックグラウンドから戻ったときに呼ぶ */
    kick: function () {
      if (!('speechSynthesis' in window)) return;
      try { speechSynthesis.resume(); } catch (e) {}
    }
  };
})();
