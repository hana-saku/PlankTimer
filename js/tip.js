/* 応援導線。押したかどうかだけ端末内に記録する。サーバーへは送らない。
   PayPal からは戻り通知が来ないので「押した」ことしか判定できない。それでよい。 */
var Tip = (function () {
  var TAPPED_KEY = 'pt_tip_tapped';   /* メニューのリンクとバナーで共通 */
  var COUNT_KEY = 'pt_tip_count';
  var PAYPAL = 'https://paypal.me/hanafulpop';

  var BEFORE_TAP_EVERY = 5;    /* 押す前は5回に1回 */
  var AFTER_TAP_EVERY = 30;    /* 一度でも押した後は30回に1回 */
  var AUTO_HIDE_MS = 6000;

  var el = null;
  var hideTimer = null;

  function tapped() {
    try { return localStorage.getItem(TAPPED_KEY) === '1'; } catch (e) { return false; }
  }

  function markTapped() {
    try { localStorage.setItem(TAPPED_KEY, '1'); } catch (e) {}
  }

  function bumpCount() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) || 0; } catch (e) {}
    n += 1;
    try { localStorage.setItem(COUNT_KEY, String(n)); } catch (e) {}
    return n;
  }

  function hide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (el) el.classList.remove('show');
  }

  function show() {
    if (!el) return;
    el.classList.add('show');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, AUTO_HIDE_MS);
  }

  return {
    init: function () {
      el = document.getElementById('tip-banner');
      if (!el) return;

      var btn = el.querySelector('.tip-go');
      var close = el.querySelector('.tip-close');

      if (btn) {
        btn.addEventListener('click', function () {
          markTapped();
          hide();
          window.open(PAYPAL, '_blank', 'noopener');
        });
      }
      if (close) close.addEventListener('click', hide);

      /* メニューの「アプリ開発を応援する」もバナーと同じ記録を残す */
      var menuLink = document.getElementById('link-support');
      if (menuLink) menuLink.addEventListener('click', markTapped);
    },

    /* 全セット終了時に呼ぶ */
    maybeShow: function () {
      if (!el) return;
      var n = bumpCount();
      var every = tapped() ? AFTER_TAP_EVERY : BEFORE_TAP_EVERY;
      if (n % every === 0) show();
    },

    hide: hide
  };
})();
