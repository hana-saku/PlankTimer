/* 合図音。Web Audio API で生成する（音声ファイルは持たない）。
   ゴングは使わない。短く静かに鳴らすこと。 */
var Sound = (function () {
  var ctx = null;
  var enabled = true;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    /* 自動再生規制やバックグラウンド復帰で suspended になる */
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  /* 単音。減衰つきなので短く、耳に刺さらない。 */
  function tone(freq, startOffset, durSec, peak) {
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + startOffset;
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);

    /* クリックノイズを出さないため、立ち上がりと減衰を必ず付ける */
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.02);
  }

  return {
    /* ユーザー操作の中から呼んで AudioContext を起こしておく */
    unlock: function () { ensure(); },

    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },

    /* 運動の開始 */
    workStart: function () {
      if (!enabled) return;
      tone(880, 0, 0.16, 0.16);
    },

    /* 運動の終了 ／ 休憩の開始 */
    restStart: function () {
      if (!enabled) return;
      tone(587.33, 0, 0.20, 0.13);
    },

    /* 全セット終了。終わったと分かる音にするが、ゴングにはしない */
    finish: function () {
      if (!enabled) return;
      tone(659.25, 0.00, 0.22, 0.14); /* E5 */
      tone(880.00, 0.16, 0.22, 0.14); /* A5 */
      tone(1174.66, 0.32, 0.42, 0.13); /* D6 */
    },

    /* バックグラウンドから戻ったときに呼ぶ */
    resume: function () {
      if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    }
  };
})();
