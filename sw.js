/* ネットワーク優先 + オフライン時はキャッシュにフォールバック。

   ファイルを変えたら必ず CACHE の番号を上げること。
   上げ忘れると、修正が利用者に届かない。 */
var CACHE = 'plank-timer-v1';

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './i18n/ja.js',
  './i18n/en.js',
  './js/i18n.js',
  './js/sound.js',
  './js/speech.js',
  './js/session.js',
  './js/keepalive.js',
  './js/timer.js',
  './js/tip.js',
  './js/app.js',
  './brand-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* 1つでも取れないと addAll は失敗する。導入自体は続行させる */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function (res) {
        /* 取れたものは控えておく（オフライン用） */
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          /* ページ遷移はトップに落とす */
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        });
      })
  );
});
