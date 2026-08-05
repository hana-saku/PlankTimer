/* 端末内の保存。サーバーへは何も送らない。
   キーは他アプリと衝突しないよう pt_ を付ける。 */
var Store = (function () {
  var SESSION_KEY = 'pt_session';
  var SETTINGS_KEY = 'pt_settings';

  var DEFAULTS = { workSec: 60, restSec: 30, sets: 3, sound: true, voice: true };

  var LIMITS = {
    workSec: { min: 5, max: 600 },
    restSec: { min: 0, max: 600 },
    sets: { min: 1, max: 30 }
  };

  function clamp(v, lim, fallback) {
    v = parseInt(v, 10);
    if (isNaN(v)) return fallback;
    if (v < lim.min) return lim.min;
    if (v > lim.max) return lim.max;
    return v;
  }

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function write(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  return {
    LIMITS: LIMITS,
    DEFAULTS: DEFAULTS,

    normalizeSettings: function (s) {
      s = s || {};
      return {
        workSec: clamp(s.workSec, LIMITS.workSec, DEFAULTS.workSec),
        restSec: clamp(s.restSec, LIMITS.restSec, DEFAULTS.restSec),
        sets: clamp(s.sets, LIMITS.sets, DEFAULTS.sets),
        sound: s.sound === undefined ? DEFAULTS.sound : !!s.sound,
        voice: s.voice === undefined ? DEFAULTS.voice : !!s.voice
      };
    },

    loadSettings: function () { return this.normalizeSettings(read(SETTINGS_KEY)); },
    saveSettings: function (s) { write(SETTINGS_KEY, s); },

    loadSession: function () {
      var s = read(SESSION_KEY);
      if (!s || (s.state !== 'running' && s.state !== 'paused')) return null;
      if (s.phase !== 'work' && s.phase !== 'rest') return null;
      if (typeof s.currentSet !== 'number') return null;
      if (!Array.isArray(s.spoken)) s.spoken = [];
      return s;
    },
    saveSession: function (s) { write(SESSION_KEY, s); },
    clearSession: function () { remove(SESSION_KEY); }
  };
})();
