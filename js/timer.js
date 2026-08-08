/* インターバルタイマー本体。

   時間の計測は必ず Date.now() の絶対値で行う。経過を足し込む方式は使わない。
   バックグラウンドで間引かれてもズレないのはこのため。
   駆動は setInterval。requestAnimationFrame は画面オフで完全に止まるので使わない。 */
var Timer = (function () {
  var TICK_MS = 100;

  var cfg = { workSec: 60, restSec: 30, sets: 3 };
  var phases = [];          /* {phase:'work'|'rest', set:n, dur:ms} */
  var st = {
    state: 'idle',          /* 'idle' | 'running' | 'paused' | 'finished' */
    idx: 0,
    endAt: 0,
    remainingMs: 0,         /* 一時停止中のみ使用 */
    spoken: []              /* このフェーズで読み上げ済みの秒 */
  };
  var handle = null;
  var cb = {};

  /* -------- フェーズ列を組み立てる -------- */
  function buildPhases() {
    phases = [];
    for (var i = 1; i <= cfg.sets; i++) {
      phases.push({ phase: 'work', set: i, dur: cfg.workSec * 1000 });
      /* 最後のセットの後に休憩は入れない。休憩0秒なら休憩そのものを作らない。 */
      if (i < cfg.sets && cfg.restSec > 0) {
        phases.push({ phase: 'rest', set: i, dur: cfg.restSec * 1000 });
      }
    }
  }

  function cur() { return phases[st.idx] || null; }

  /* 読み上げる秒。フェーズがその秒数より長いときだけ対象にする
     （5秒の運動でいきなり「残り10秒」と言わせないため） */
  function cuesFor(p) {
    var base = p.phase === 'work' ? [10, 3, 2, 1] : [3, 2, 1];
    var out = [];
    for (var i = 0; i < base.length; i++) {
      if (p.dur > base[i] * 1000) out.push(base[i]);
    }
    return out;
  }

  function findIdx(phase, set) {
    for (var i = 0; i < phases.length; i++) {
      if (phases[i].phase === phase && phases[i].set === set) return i;
    }
    return -1;
  }

  /* -------- 保存 -------- */
  function save() {
    if (st.state !== 'running' && st.state !== 'paused') { Store.clearSession(); return; }
    var p = cur();
    if (!p) { Store.clearSession(); return; }
    Store.saveSession({
      state: st.state,
      phase: p.phase,
      endAt: st.endAt,
      remainingMs: st.remainingMs,
      currentSet: p.set,
      workSec: cfg.workSec,
      restSec: cfg.restSec,
      sets: cfg.sets,
      spoken: st.spoken.slice()
    });
  }

  /* -------- 音と声 -------- */
  function entryCue(p) {
    if (p.phase === 'work') Sound.workStart();
    else Sound.restStart();
  }

  /* 3・2・1 は音で鳴らす。数字は音では伝えられないので、
     「残り10秒」だけは声のまま残す（言語設定に従って読み上げる）。
     このため 3・2・1 は「合図音」、「残り10秒」は「声」の設定に属する。 */
  function playCue(sec) {
    if (sec === 10) Speech.speak(I18N.t('speakTenLeft'), I18N.bcp47(), 0);
    else Sound.countdown();
  }

  /* 既に過ぎた読み上げを「済み」として記録する（喋らせない）。
     これをしないと復帰した瞬間に一斉に鳴る。 */
  function markPassedCues() {
    var p = cur();
    if (!p) return;
    var remaining = st.endAt - Date.now();
    var list = cuesFor(p);
    for (var i = 0; i < list.length; i++) {
      if (remaining <= list[i] * 1000 && st.spoken.indexOf(list[i]) < 0) st.spoken.push(list[i]);
    }
  }

  function fireCues(now) {
    var p = cur();
    if (!p) return;
    var remaining = st.endAt - now;
    var list = cuesFor(p);
    var due = [];
    for (var i = 0; i < list.length; i++) {
      if (remaining <= list[i] * 1000 && st.spoken.indexOf(list[i]) < 0) {
        st.spoken.push(list[i]);
        due.push(list[i]);
      }
    }
    /* 同時に複数来たら最後の1つだけ鳴らす。
       全部渡すと声が互いに打ち消し合って何も聞こえなくなる。 */
    if (due.length) playCue(Math.min.apply(null, due));
  }

  /* -------- 進行 -------- */
  /* 全セット終了では音を鳴らさない。
     3・2・1 のあと、いつもは開始音が続くところに何も来ない。
     その静けさ自体が「終わった」の合図になる。ゴングは鳴らさないアプリなので、
     最後だけ大きな音を出すのは筋が通らない。 */
  function finish(silent) {
    stopLoop();
    st.state = 'finished';
    st.remainingMs = 0;
    Store.clearSession();
    if (cb.onFinish) cb.onFinish(silent);
    if (cb.onState) cb.onState();
  }

  /* 経過した分だけフェーズを進める。戻り値は今のフェーズに入り直したかどうか。 */
  function advanceTo(now, silent) {
    var crossed = 0;
    while (now >= st.endAt) {
      var prevEnd = st.endAt;
      st.idx++;
      if (st.idx >= phases.length) { finish(silent); return -1; }
      st.endAt = prevEnd + phases[st.idx].dur;  /* 前の終了時刻から積む。now から取り直すとズレる */
      st.spoken = [];
      crossed++;
    }
    return crossed;
  }

  function tick() {
    if (st.state !== 'running') return;
    var now = Date.now();

    var crossed = advanceTo(now, false);
    if (crossed < 0) return;           /* 全セット終了した */

    if (crossed > 0) {
      markPassedCues();                /* 飛ばした分の読み上げは今さら喋らない */
      entryCue(cur());
      save();
      if (cb.onPhase) cb.onPhase();
    }

    fireCues(now);
    if (cb.onTick) cb.onTick();
  }

  function startLoop() {
    stopLoop();
    handle = setInterval(tick, TICK_MS);
  }

  function stopLoop() {
    if (handle) { clearInterval(handle); handle = null; }
  }

  /* -------- 外から使う -------- */
  return {
    on: function (handlers) { cb = handlers || {}; },

    /* 動作中は反映しない。走っている最中にセット数が減ると
       保存した状態と噛み合わなくなり、復元できなくなるため。
       設定そのものは app.js が pt_settings に保存しているので、次回から効く。 */
    setConfig: function (c) {
      if (st.state === 'running' || st.state === 'paused') return false;
      cfg.workSec = c.workSec;
      cfg.restSec = c.restSec;
      cfg.sets = c.sets;
      buildPhases();
      return true;
    },

    getConfig: function () { return { workSec: cfg.workSec, restSec: cfg.restSec, sets: cfg.sets }; },

    start: function () {
      buildPhases();
      st.idx = 0;
      st.spoken = [];
      st.remainingMs = 0;
      st.endAt = Date.now() + phases[0].dur;
      st.state = 'running';
      entryCue(phases[0]);
      save();
      startLoop();
      if (cb.onPhase) cb.onPhase();
      if (cb.onState) cb.onState();
      if (cb.onTick) cb.onTick();
    },

    pause: function () {
      if (st.state !== 'running') return;
      stopLoop();
      st.remainingMs = Math.max(0, st.endAt - Date.now());
      st.state = 'paused';
      Speech.cancel();
      save();
      if (cb.onState) cb.onState();
      if (cb.onTick) cb.onTick();
    },

    resume: function () {
      if (st.state !== 'paused') return;
      st.endAt = Date.now() + st.remainingMs;
      st.remainingMs = 0;
      st.state = 'running';
      save();
      startLoop();
      if (cb.onState) cb.onState();
      if (cb.onTick) cb.onTick();
    },

    reset: function () {
      stopLoop();
      st.state = 'idle';
      st.idx = 0;
      st.spoken = [];
      st.endAt = 0;
      st.remainingMs = 0;
      Speech.cancel();
      Store.clearSession();
      buildPhases();
      if (cb.onState) cb.onState();
      if (cb.onTick) cb.onTick();
    },

    /* 保存されていた状態から復元する。
       離れているあいだに過ぎた読み上げは、いまさら喋らせない。 */
    restore: function (saved) {
      cfg.workSec = saved.workSec;
      cfg.restSec = saved.restSec;
      cfg.sets = saved.sets;
      buildPhases();

      var idx = findIdx(saved.phase, saved.currentSet);
      if (idx < 0) { Store.clearSession(); return false; }
      st.idx = idx;
      st.spoken = Array.isArray(saved.spoken) ? saved.spoken.slice() : [];

      if (saved.state === 'paused') {
        st.remainingMs = Math.max(0, saved.remainingMs || 0);
        st.endAt = 0;
        st.state = 'paused';
        if (cb.onState) cb.onState();
        if (cb.onTick) cb.onTick();
        return true;
      }

      /* running。フェーズをまたいで時間が過ぎていたら、そのぶん歩かせる。 */
      st.endAt = saved.endAt;
      st.remainingMs = 0;
      st.state = 'running';

      var crossed = advanceTo(Date.now(), true);   /* 過ぎていたら音を鳴らさず終了へ */
      if (crossed < 0) return true;                /* 全セット過ぎていた → 終了画面 */

      markPassedCues();
      save();
      startLoop();
      if (cb.onPhase) cb.onPhase();
      if (cb.onState) cb.onState();
      if (cb.onTick) cb.onTick();
      return true;
    },

    /* 画面に出すための現在値 */
    view: function () {
      var p = cur();
      var totalSets = cfg.sets;

      if (st.state === 'idle') {
        return { state: 'idle', phase: 'work', set: 1, totalSets: totalSets,
                 remainingMs: cfg.workSec * 1000, dur: cfg.workSec * 1000, progress: 0 };
      }
      if (st.state === 'finished' || !p) {
        return { state: 'finished', phase: 'work', set: totalSets, totalSets: totalSets,
                 remainingMs: 0, dur: 0, progress: 1 };
      }

      var remaining = st.state === 'paused'
        ? st.remainingMs
        : Math.max(0, st.endAt - Date.now());

      return {
        state: st.state,
        phase: p.phase,
        set: p.set,
        totalSets: totalSets,
        remainingMs: remaining,
        dur: p.dur,
        progress: p.dur > 0 ? 1 - remaining / p.dur : 1
      };
    },

    isRunning: function () { return st.state === 'running'; },
    getState: function () { return st.state; },

    /* バックグラウンドから戻ったときに、間引かれた分をその場で追いつかせる */
    poke: function () { tick(); },

    /* ページが閉じられる直前に、読み上げ済みの記録まで含めて保存する。
       動作中でないときは何もしない — 別のタブが走らせている記録を消さないため。 */
    flush: function () {
      if (st.state === 'running' || st.state === 'paused') save();
    }
  };
})();
