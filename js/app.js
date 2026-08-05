/* 画面と各部品の配線。 */
(function () {
  var el = {};
  var settings = Store.DEFAULTS;
  var panelOpen = false;
  var closeTimer = null;

  function $(id) { return document.getElementById(id); }

  function cache() {
    el.body = document.body;
    el.phase = $('phase-label');
    el.time = $('time');
    el.setNow = $('set-now');
    el.setAll = $('set-all');
    el.barFill = $('bar-fill');
    el.primary = $('primary-btn');
    el.reset = $('reset-btn');
    el.menuBtn = $('menu-btn');
    el.panel = $('panel');
    el.scrim = $('scrim');
    el.panelClose = $('panel-close');
    el.inWork = $('in-work');
    el.inRest = $('in-rest');
    el.inSets = $('in-sets');
    el.inSound = $('in-sound');
    el.inVoice = $('in-voice');
    el.inLang = $('in-lang');
    el.workMmss = $('work-mmss');
    el.restMmss = $('rest-mmss');
  }

  /* ---------- 表示 ---------- */

  function mmss(totalSec) {
    var s = Math.max(0, totalSec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : r);
  }

  function render() {
    var v = Timer.view();

    var phaseAttr = v.state === 'idle' ? 'idle'
                  : v.state === 'finished' ? 'finished'
                  : v.phase;
    if (el.body.getAttribute('data-phase') !== phaseAttr) {
      el.body.setAttribute('data-phase', phaseAttr);
    }

    /* 色だけに頼らないための文字表示 */
    el.phase.textContent =
      v.state === 'idle' ? I18N.t('ready')
      : v.state === 'finished' ? I18N.t('finished')
      : I18N.t(v.phase);

    /* 残り秒は切り上げ。0.2秒残っているときに 0 と出すと止まって見える。
       60秒未満は秒だけを大きく出す。4文字だと横幅が先に足りなくなり、
       床から見上げたときに読みにくくなるため。 */
    var sec = Math.ceil(v.remainingMs / 1000);
    var wide = sec >= 60;
    el.time.textContent = wide ? mmss(sec) : String(sec);
    if (wide) el.time.classList.add('mmss');
    else el.time.classList.remove('mmss');

    el.setNow.textContent = v.set;
    el.setAll.textContent = v.totalSets;

    /* 帯は残り時間を表す。始めは満ちていて、終わりに向かって減る。点滅はしない。 */
    var left = v.state === 'finished' ? 0 : 1 - Math.min(1, Math.max(0, v.progress));
    el.barFill.style.transform = 'scaleX(' + left + ')';

    el.primary.textContent =
      v.state === 'running' ? I18N.t('pause')
      : v.state === 'paused' ? I18N.t('resume')
      : I18N.t('start');

    el.reset.disabled = (v.state === 'idle');
  }

  /* ---------- 設定 ---------- */

  function readInputs() {
    return Store.normalizeSettings({
      workSec: el.inWork.value,
      restSec: el.inRest.value,
      sets: el.inSets.value,
      sound: el.inSound.checked,
      voice: el.inVoice.checked
    });
  }

  function writeInputs(s) {
    el.inWork.value = s.workSec;
    el.inRest.value = s.restSec;
    el.inSets.value = s.sets;
    el.inSound.checked = s.sound;
    el.inVoice.checked = s.voice;
    el.workMmss.textContent = mmss(s.workSec);
    el.restMmss.textContent = mmss(s.restSec);
  }

  function applySettings(persist) {
    settings = readInputs();
    writeInputs(settings);
    Sound.setEnabled(settings.sound);
    Speech.setEnabled(settings.voice);
    Timer.setConfig({ workSec: settings.workSec, restSec: settings.restSec, sets: settings.sets });
    if (persist !== false) Store.saveSettings(settings);
    render();
  }

  /* ---------- 設定パネル ---------- */

  function openPanel() {
    if (panelOpen) return;
    panelOpen = true;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    el.scrim.hidden = false;
    el.panel.hidden = false;
    /* hidden を外した直後だと transition が走らないので、1フレーム待つ */
    setTimeout(function () {
      el.scrim.classList.add('open');
      el.panel.classList.add('open');
    }, 16);
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    el.scrim.classList.remove('open');
    el.panel.classList.remove('open');
    closeTimer = setTimeout(function () {
      el.scrim.hidden = true;
      el.panel.hidden = true;
    }, 300);
  }

  /* ---------- 配線 ---------- */

  function wire() {
    el.menuBtn.addEventListener('click', openPanel);
    el.panelClose.addEventListener('click', closePanel);
    el.scrim.addEventListener('click', closePanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panelOpen) closePanel();
    });

    /* ＋ − ボタン */
    var steps = document.querySelectorAll('.step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].addEventListener('click', function () {
        var input = $(this.getAttribute('data-target'));
        var delta = parseInt(this.getAttribute('data-delta'), 10);
        var min = parseInt(input.min, 10);
        var max = parseInt(input.max, 10);
        var next = (parseInt(input.value, 10) || 0) + delta;
        input.value = Math.min(max, Math.max(min, next));
        applySettings();
      });
    }

    el.inWork.addEventListener('change', function () { applySettings(); });
    el.inRest.addEventListener('change', function () { applySettings(); });
    el.inSets.addEventListener('change', function () { applySettings(); });
    el.inSound.addEventListener('change', function () { applySettings(); });
    el.inVoice.addEventListener('change', function () { applySettings(); });

    el.inLang.addEventListener('change', function () { I18N.setMode(this.value); });

    /* スタート／一時停止／再開 */
    el.primary.addEventListener('click', function () {
      /* 音は必ずユーザー操作の中から起こす */
      Sound.unlock();

      var s = Timer.getState();
      if (s === 'running') {
        Timer.pause();
        Keepalive.pause();
      } else if (s === 'paused') {
        Timer.resume();
        Keepalive.start(I18N.t('appName'), I18N.t(Timer.view().phase));
      } else {
        Tip.hide();
        Timer.start();
        Keepalive.start(I18N.t('appName'), I18N.t('work'));
      }
    });

    el.reset.addEventListener('click', function () {
      Timer.reset();
      Keepalive.stop();
      Tip.hide();
    });

    Keepalive.setActionHandlers(
      function () {
        if (Timer.getState() === 'paused') {
          Timer.resume();
          Keepalive.start(I18N.t('appName'), I18N.t(Timer.view().phase));
        }
      },
      function () {
        if (Timer.getState() === 'running') { Timer.pause(); Keepalive.pause(); }
      }
    );

    /* 表示に戻ったら、間引かれた分をその場で追いつかせる */
    Keepalive.onResume(function () {
      Timer.poke();
      render();
    });

    /* 閉じられる直前に、読み上げ済みの記録まで含めて保存する */
    window.addEventListener('pagehide', function () { Timer.flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') Timer.flush();
    });
  }

  /* ---------- タイマーからの通知 ---------- */

  function bindTimer() {
    Timer.on({
      onTick: render,
      onPhase: function () {
        render();
        Keepalive.updateMetadata(I18N.t('appName'), I18N.t(Timer.view().phase));
      },
      onState: render,
      onFinish: function (silent) {
        Keepalive.stop();
        render();
        /* 復元で「もう過ぎていた」場合はバナーも出さない */
        if (!silent) Tip.maybeShow();
      }
    });
  }

  /* ---------- 起動 ---------- */

  function boot() {
    cache();
    I18N.init();
    I18N.onChange(render);

    settings = Store.loadSettings();
    writeInputs(settings);
    el.inLang.value = I18N.getMode();
    Sound.setEnabled(settings.sound);
    Speech.setEnabled(settings.voice);
    Timer.setConfig({ workSec: settings.workSec, restSec: settings.restSec, sets: settings.sets });

    bindTimer();
    wire();
    Tip.init();

    /* 保存されていた状態があれば、そこから続ける */
    var saved = Store.loadSession();
    if (saved) {
      var ok = Timer.restore(saved);
      if (ok) {
        /* 走っていたときの設定を画面にも合わせる */
        settings = Store.normalizeSettings({
          workSec: saved.workSec, restSec: saved.restSec, sets: saved.sets,
          sound: settings.sound, voice: settings.voice
        });
        writeInputs(settings);
        Store.saveSettings(settings);
        if (Timer.getState() === 'running') {
          Keepalive.start(I18N.t('appName'), I18N.t(Timer.view().phase));
        }
      }
    }

    render();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
