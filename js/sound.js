/* 合図音。Web Audio API で生成する（音声ファイルは持たない）。
   ゴングは使わない。短く静かに鳴らすこと。

   音の役目は3つだけ。
     カウントダウン  同じ音を3回（3・2・1）
     運動の開始      高い音。上がるので「行く」に聞こえる
     休憩の開始      低い音。下がるので「休む」に聞こえる
   全セット終了では鳴らさない。カウントダウンのあと何も鳴らないことが、
   そのまま「終わった」の合図になる。 */
var Sound = (function () {
  var ctx = null;
  var enabled = true;

  /* 基音に2倍・3倍の倍音を弱く重ねると、鐘や木琴のような柔らかい音になる。
     合計を 1.4 で割って、単音のときと音量が揃うようにしている。 */
  var HARMONICS = [[1, 1.00], [2, 0.30], [3, 0.10]];

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      /* iOS は他の音が割り込むだけで AudioContext を止める。
         止まったら黙って何も鳴らなくなるので、気づいたら起こし直す。 */
      try {
        ctx.onstatechange = function () {
          if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
        };
      } catch (e) {}
    }
    /* 自動再生規制やバックグラウンド復帰で suspended になる */
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  /* 一音。立ち上がりは速く、あとは指数で減衰する。
     gain に 0 を入れると exponentialRamp が使えないので 0.0001 を使う。
     ここを 0 にするとプツッというクリックノイズが出る。 */
  function bell(freq, startOffset, durSec, peak) {
    var c = ensure();
    if (!c) return;
    /* ぴったり currentTime に置くと、iOS では起動が間に合わず頭が欠ける。
       10ms だけ先に置く。 */
    var t0 = c.currentTime + startOffset + 0.01;

    var out = c.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
    out.connect(c.destination);

    for (var i = 0; i < HARMONICS.length; i++) {
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * HARMONICS[i][0], t0);
      g.gain.setValueAtTime(HARMONICS[i][1] / 1.4, t0);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + durSec + 0.02);
    }
  }

  return {
    /* ユーザー操作の中から呼んで AudioContext を起こしておく。

       iOS は resume() を呼ぶだけでは足りない。
       同じ操作の中で「実際に音源を1回鳴らす」まで、以降ずっと無音のままになる。
       だから長さ1サンプルの無音バッファを鳴らして、確実に解錠する。 */
    unlock: function () {
      var c = ensure();
      if (!c) return;
      try {
        var b = c.createBuffer(1, 1, c.sampleRate);
        var src = c.createBufferSource();
        src.buffer = b;
        src.connect(c.destination);
        src.start(0);
      } catch (e) {}
    },

    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },

    /* 残り 3・2・1。毎回まったく同じ音にする。
       音程を動かすと「次に何か起きる」と身構えてしまい、
       運動の最後の3秒に余計な情報が増える。 */
    countdown: function () {
      if (!enabled) return;
      bell(880.00, 0, 0.45, 0.24);    /* A5 */
    },

    /* 運動の開始。カウントダウンより高い音にする。
       同じ高さだと、3・2・1 の4つめなのか開始なのか聞き分けられない。 */
    workStart: function () {
      if (!enabled) return;
      bell(1046.50, 0, 0.60, 0.24);   /* C6 */
    },

    /* 運動の終了 ／ 休憩の開始。カウントダウンより低い音。 */
    restStart: function () {
      if (!enabled) return;
      bell(587.33, 0, 0.75, 0.20);    /* D5 */
    },

    /* バックグラウンドから戻ったときに呼ぶ */
    resume: function () {
      if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    }
  };
})();
