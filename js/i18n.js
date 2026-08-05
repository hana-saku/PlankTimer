/* 多言語。辞書は i18n/ja.js, i18n/en.js が window.PT_I18N に登録する。 */
var I18N = (function () {
  var STORE_KEY = 'pt_lang';
  var current = 'ja';
  var mode = 'auto'; /* 'auto' | 'ja' | 'en' */
  var listeners = [];

  function detect() {
    var l = (navigator.language || navigator.userLanguage || 'ja').toLowerCase();
    return l.indexOf('ja') === 0 ? 'ja' : 'en';
  }

  function dict() {
    return (window.PT_I18N && window.PT_I18N[current]) || window.PT_I18N.ja;
  }

  function t(key) {
    var d = dict();
    return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : key;
  }

  function apply() {
    current = mode === 'auto' ? detect() : mode;
    document.documentElement.lang = current === 'ja' ? 'ja' : 'en';

    /* data-i18n を持つ要素のテキストを差し替える */
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    var attrNodes = document.querySelectorAll('[data-i18n-aria]');
    for (var j = 0; j < attrNodes.length; j++) {
      attrNodes[j].setAttribute('aria-label', t(attrNodes[j].getAttribute('data-i18n-aria')));
    }

    for (var k = 0; k < listeners.length; k++) listeners[k]();
  }

  function setMode(m) {
    mode = m === 'ja' || m === 'en' ? m : 'auto';
    try { localStorage.setItem(STORE_KEY, mode); } catch (e) {}
    apply();
  }

  function init() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved) mode = saved;
    } catch (e) {}
    apply();
  }

  return {
    init: init,
    apply: apply,
    t: t,
    setMode: setMode,
    getMode: function () { return mode; },
    getLang: function () { return current; },
    bcp47: function () { return t('bcp47'); },
    onChange: function (fn) { listeners.push(fn); }
  };
})();
