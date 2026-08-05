# Plank Timer

運動と休憩を交互に繰り返すインターバルタイマー。
プランクを想定して作っているが、腹筋・スクワット・ストレッチなど
「時間を区切って繰り返す運動」全般に使える。

**ゴングは鳴らさない。** キックボクシングタイマーのゴングが「うるさい」という
実際の利用者の声から、このアプリが生まれている。

- 公開URL: https://planktimer.hanafulpop.com
- 提供形態: Web / PWA のみ（Google Play・App Store には出さない）
- 収益: 広告なし。PayPal投げ銭のみ

仕様は [`PLANKTIMER_SPEC.md`](PLANKTIMER_SPEC.md) が唯一の正。
仕様を変える必要が出たら、勝手に変えずに提案し、決まってからこのファイルを更新すること。

---

## ⚠️ 変更したら必ずキャッシュ番号を上げる

**`sw.js` の `CACHE` を上げ忘れると、修正が利用者に届かない。**
既存アプリで実際にこれが起きている。**コードを変更したら必ず確認すること。**

```js
// sw.js の先頭
var CACHE = 'plank-timer-v2';   // ← 変更のたびに v3, v4 … と上げる
```

上げ忘れると、利用者の端末には古い Service Worker がキャッシュを握ったまま残り、
`index.html` も `js/*.js` も古いままになる。本人の端末では
（キャッシュを消しているので）直ったように見えるため、気づきにくい。

ファイルを追加したときは、`sw.js` の `ASSETS` にも追加すること。

---

## 構成

ビルド工程は無い。リポジトリ直下をそのまま Cloudflare が配信する。
外部ライブラリも CDN も読み込まない。

```
index.html            画面の骨格
css/style.css         配色とレイアウト
js/timer.js           タイマー本体。Date.now() の絶対値で計測、setInterval 駆動
js/session.js         localStorage への保存・読み出しと、設定値の丸め込み
js/keepalive.js       Wake Lock / 無音ループ再生 / MediaSession / 復帰処理
js/speech.js          読み上げ
js/sound.js           合図音（Web Audio で生成。音声ファイルは持たない）
js/i18n.js            言語の判定と適用
js/tip.js             投げ銭バナー
js/app.js             画面と各部品の配線
i18n/ja.js            日本語の辞書
i18n/en.js            英語の辞書
manifest.json         PWA
sw.js                 Service Worker
_headers              manifest の Content-Type ほか
icons/                アイコン（any と maskable の2種。原本は icons/source-icon.png）
brand-logo.png        メニュー最下部のブランドロゴ
```

---

## 触るときに壊しやすいところ

仕様書の4〜6章に、既存3アプリで実際に踏んだ不具合とその対処が書いてある。
次の4つは、後から直すと大掛かりになる。

### 1. 時間の計測は `Date.now()` の絶対値で行う

経過を足し込む方式（`remainingMs -= 250`）は使わない。
バックグラウンドで間引かれた分だけズレていく。

```js
endAt = Date.now() + durationMs;
remainingMs = Math.max(0, endAt - Date.now());
```

フェーズを進めるときも、`Date.now()` から取り直さず**前のフェーズの終了時刻から積む**。
そうしないと切り替えのたびに誤差が溜まる（`js/timer.js` の `advanceTo`）。

### 2. `requestAnimationFrame` を使わない

バックグラウンドと画面オフで完全に止まる。駆動は `setInterval`。

### 3. `setTimeout` で読み上げを遅らせない

バックグラウンドのタブでは `setTimeout` が最大1分まで間引かれる。
合図音は鳴るのに声だけ鳴らない、という不具合になる。

```js
if (document.visibilityState === 'visible') setTimeout(() => speak(text), 400);
else speak(text);
```

### 4. 復元時に、過ぎた読み上げを「済み」として記録してから再開する

これをしないと、復帰した瞬間に「残り10秒」「3」「2」「1」が一斉に鳴る
（`js/timer.js` の `markPassedCues`）。

なお、他のアプリが音声の主導権（audio focus）を取ると Android はページを破棄する。
これは Web アプリである限り防げない。だから `localStorage` への保存と復元が必須になる。

---

## アイコン

| ファイル | 用途 |
|---|---|
| `icon-192.png` / `icon-512.png` | `purpose: "any"`。全面塗り、角丸なし |
| `icon-192-maskable.png` / `icon-512-maskable.png` | `purpose: "maskable"`。絵柄を78%に縮めて安全圏に収めたもの |
| `icon.svg` | 512px の PNG を埋め込んだラッパー（元絵がラスターのため） |
| `source-icon.png` | 原本。作り直すときはこれから |

作るときの決まりごと（仕様書8章）。

- **背景は透過にしない。**単色で塗る。透過だと白い余白が出る端末がある
- **角丸にしない。**角丸は OS が付ける。自前で丸めると角に白が残る
- **`maskable` は絵柄を内側に寄せる。**OS が円などで切り抜くため、
  外側は消える。`any` とは別ファイルにしてある
- 原本には外周に白い余白と角丸があるので、**角丸の内側で正方形に切り出して**いる。
  外側を推定で塗り足すと絵柄（白い人物や文字）を壊す
- 背景に細かいノイズがあり PNG が圧縮できないため、**背景だけ均して256色に減色**している。
  見た目は変わらず、大きさは3分の1になる

---

## 配色

| | 色 | 用途 |
|---|---|---|
| 背景 | `#14161a` | 深い墨色。**純黒にしない**（暗い部屋でコントラストが強すぎて目が疲れる） |
| 文字 | `#f2ede4` | 生成り。**純白にしない**（眩しい） |
| 運動中 | `#ff7a59` | 温かいオレンジ〜珊瑚色 |
| 休憩中 | `#3d8f87` | 落ち着いた青緑 |

背景に対するコントラストは運動 6.96:1、休憩 4.66:1。
両者の**明るさの比は約 1.5:1** あるので、色の見え方が異なる方でも明暗で区別できる。

当初案の休憩色 `#4fb3a8` は運動色と明るさがほぼ同じ（比 1.02:1）で、
明暗による区別ができなかったため暗くしてある。

それでも**色だけに頼らないこと。**「運動中」「休憩中」の文字は必ず併記する。

**明滅・強い点滅は入れない。** 運動中ずっと見続けるので疲れる。

---

## やってはいけないこと

- Google Play / App Store に出さない。Web/PWA のみ
- 広告を入れない（`ads.txt` も `adsbygoogle.js` も置かない）
- 利用者のデータをサーバーへ送らない。すべて端末内で完結させる
- アカウント登録・ログインを作らない
- 課金・有料機能を作らない。収益は投げ銭のみ
- 外部のライブラリを読み込まない。CDN も使わない

---

## 端末内に保存しているもの

すべて `localStorage`。**サーバーへは何も送らない。**

| キー | 中身 |
|---|---|
| `pt_session` | 動作中の状態（復元用）。終了・リセットで削除 |
| `pt_settings` | 運動時間・休憩時間・セット数・音・声 |
| `pt_lang` | 言語の選択（自動 / ja / en） |
| `pt_tip_tapped` | 応援リンクを押したことがあるか |
| `pt_tip_count` | 全セット終了の回数（バナーの表示頻度に使う） |

---

## デプロイ

`main` へ push すると GitHub Actions が Cloudflare Workers へ自動デプロイする
（`.github/workflows/deploy.yml`）。既存の hanafulpop.com / kickboxing と同じ仕組み。

- 配信されるのはリポジトリ直下。ビルド工程は無い
- カスタムドメインは `wrangler.jsonc` の `routes` で指定してあるので、
  **Cloudflare の DNS 画面で手動で CNAME を追加してはいけない。**
  wrangler がデプロイ時に DNS レコードを作る
- 配信したくないファイルは `.assetsignore` に書く（仕様書・README・原本アイコンなど）
- リポジトリの Secrets に `CLOUDFLARE_API_TOKEN` が必要

---

## 手元で動かす

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

`file://` では Service Worker が動かないので、必ず HTTP で開くこと。
