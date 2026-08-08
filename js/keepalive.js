/* 画面を消しても、他のアプリを開いても、タイマーを止めさせないための仕組み。
   1. Screen Wake Lock  — 使用中に画面を暗くさせない
   2. 無音のループ再生   — ページを「再生中」扱いにして止められにくくする
   3. MediaSession      — 同上
   4. visibilitychange  — 復帰したら取り直す

   なお、他のアプリが audio focus を取ると Android はページを破棄する。
   これは Web アプリである限り防げないので、session.js の復元で受け止める。 */
var Keepalive = (function () {
  var wakeLock = null;
  var audio = null;
  var audioUrl = null;
  var active = false;
  var hooks = { onResume: null };

  /* -------- 無音の音声を生成する（ファイルは持たない） -------- */
  function silentWavUrl() {
    if (audioUrl) return audioUrl;

    var rate = 8000;
    var seconds = 1;
    var samples = rate * seconds;
    var bytes = new Uint8Array(44 + samples);
    var dv = new DataView(bytes.buffer);

    function ascii(offset, s) {
      for (var i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
    }

    ascii(0, 'RIFF');
    dv.setUint32(4, 36 + samples, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    dv.setUint32(16, 16, true);      /* fmt チャンクの長さ */
    dv.setUint16(20, 1, true);       /* PCM */
    dv.setUint16(22, 1, true);       /* モノラル */
    dv.setUint32(24, rate, true);
    dv.setUint32(28, rate, true);    /* バイト/秒 = rate * 1ch * 1byte */
    dv.setUint16(32, 1, true);       /* ブロックサイズ */
    dv.setUint16(34, 8, true);       /* 8bit */
    ascii(36, 'data');
    dv.setUint32(40, samples, true);

    /* 8bit PCM の無音は 0 ではなく 128 */
    for (var i = 0; i < samples; i++) bytes[44 + i] = 128;

    audioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    return audioUrl;
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(silentWavUrl());
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 1.0;      /* 中身が無音なので音量は下げない（muted にすると再生扱いされない） */
    audio.setAttribute('playsinline', '');
    return audio;
  }

  function playSilent() {
    var a = ensureAudio();
    if (!a.paused) return;
    var p = a.play();
    if (p && typeof p.catch === 'function') p.catch(function () { /* 自動再生規制。次の操作で再試行される */ });
  }

  function stopSilent() {
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch (e) {}
  }

  /* -------- Screen Wake Lock -------- */
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    try {
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        lock.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () { /* 未対応・拒否。致命的ではない */ });
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    try { wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }

  /* -------- MediaSession -------- */
  function setMediaSession(title, artist) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: title,
        artist: artist,
        album: 'HANAFULPOP',
        artwork: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    } catch (e) {}
  }

  function setPlaybackState(s) {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = s; } catch (e) {}
  }

  /* -------- 表示に戻ったときの復帰処理 -------- */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    Sound.resume();
    Speech.kick();
    if (active) {
      requestWakeLock();
      playSilent();
    }
    if (hooks.onResume) hooks.onResume();
  });

  /* iOS で音声が中断されたときに拾う */
  window.addEventListener('pageshow', function () {
    if (active) playSilent();
  });

  return {
    /* 無音ループだけを先に始める。
       iOS の音声セッションを確定させてから AudioContext を起こすため、
       スタートを押した直後、他の何より先に呼ぶ。 */
    prime: playSilent,

    /* タイマー開始・再開時に呼ぶ（ユーザー操作の中から呼ぶこと） */
    start: function (title, artist) {
      active = true;
      requestWakeLock();
      playSilent();
      setMediaSession(title || 'Plank Timer', artist || '');
      setPlaybackState('playing');
    },

    /* 一時停止時。Wake Lock は外すが無音再生は続ける
       （止めるとページが復帰しにくくなるため） */
    pause: function () {
      releaseWakeLock();
      setPlaybackState('paused');
    },

    /* 終了・リセット時 */
    stop: function () {
      active = false;
      releaseWakeLock();
      stopSilent();
      setPlaybackState('none');
    },

    updateMetadata: setMediaSession,

    /* 再生・一時停止のハードキーやロック画面からの操作を受ける */
    setActionHandlers: function (onPlay, onPause) {
      if (!('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.setActionHandler('play', onPlay);
        navigator.mediaSession.setActionHandler('pause', onPause);
      } catch (e) {}
    },

    onResume: function (fn) { hooks.onResume = fn; }
  };
})();
