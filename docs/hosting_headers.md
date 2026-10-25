# Hosting のセキュリティヘッダ

`firebase.json` の `hosting.headers` で、すべてのパス（`**`）に次のヘッダを付けます。

| ヘッダ                                | 値・目的                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `X-Content-Type-Options`              | `nosniff`                                                               |
| `X-Frame-Options`                     | `DENY`（ほかのサイトの iframe に埋め込ませない）                        |
| `Content-Security-Policy`             | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`（強制）    |
| `Content-Security-Policy-Report-Only` | 読み込み先を制限する CSP（下記）。違反してもブロックせず、報告だけ行う  |
| `Referrer-Policy`                     | `strict-origin-when-cross-origin`                                       |
| `Permissions-Policy`                  | `camera=(self), microphone=(), geolocation=()`（QR の読み取りだけ許可） |

## 読み込み先を制限する CSP（Report-Only）

| ディレクティブ | 許可する先                                                                                                                                              | 理由                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `script-src`   | `'self'`、`'wasm-unsafe-eval'`、`www.google.com/recaptcha/`、`www.gstatic.com/recaptcha/`                                                               | アプリのバンドル、QR 読み取りの WASM、App Check の reCAPTCHA |
| `style-src`    | `'self'`、`'unsafe-inline'`                                                                                                                             | React Native Web と Expo が `<style>` を動的に挿入する       |
| `img-src`      | `'self'`、`data:`、`blob:`、`https:`                                                                                                                    | メニューの画像 URL はマスターで自由に設定できる              |
| `connect-src`  | `'self'`、Identity Toolkit、Secure Token、App Check、`*.cloudfunctions.net`、reCAPTCHA、Sentry の取り込み先、`fastly.jsdelivr.net/npm/zxing-wasm@<版>/` | スタッフのログイン、Callable、エラー送信、QR 読み取りの WASM |
| `frame-src`    | `www.google.com/recaptcha/`、`recaptcha.google.com/recaptcha/`                                                                                          | reCAPTCHA Enterprise                                         |
| そのほか       | `default-src 'self'`、`font-src 'self' data:`、`media-src 'self' blob:`、`form-action 'self'`                                                           |                                                              |

クライアントは Firestore を直接読まない設計（ルールで拒否）なので、Firestore の接続先は許可していません。

### QR 読み取りの WASM（外部 CDN への依存）

Web 版のトップ（`/`）はアプリ内の QR スキャナーです。`BarcodeDetector` を持たないブラウザ（iPhone の Safari など）では、expo-camera が使う `barcode-detector` が、QR を解析する WASM を実行時に `https://fastly.jsdelivr.net/npm/zxing-wasm@<版>/dist/` から取得します。

- CSP はこのバージョンのパスだけを許可します。expo-camera の更新で zxing-wasm の版が変わると、`npm run test:web` がバンドル内の URL と CSP を照合して失敗するので、`firebase.json` の版を合わせてください。
- jsDelivr が使えないと、そのブラウザではアプリ内の QR 読み取りができません。標準のカメラアプリで QR を読み、`/order?...` を直接開く流れには影響しません。
- 外部 CDN に依存しないようにするには、WASM を Hosting から配信し、`barcode-detector` の `prepareZXingModule` で取得先を変えます（Metro のアセット設定の追加が必要）。

## 検証

`npm run test:web` は、テスト用のサーバーで `firebase.json` と同じヘッダを付けて配信し、注文とスタッフ画面の操作中に `securitypolicyviolation` が 0 件であることを確認します。合成の設定では App Check（reCAPTCHA）と Sentry は動かないため、この 2 つは本番で確認が必要です。

## 強制に切り替える手順

1. 本番の Hosting にデプロイし、QR からの注文、スタッフ画面、App Check を有効にした状態で、ブラウザの開発者ツールのコンソールに `[Report Only]` の違反が出ないことを確認します（iPhone の Safari でのアプリ内 QR 読み取りも確認します）。
2. 違反があれば、許可する先を追加して 1. をやり直します。
3. 違反がなければ、`Content-Security-Policy-Report-Only` の値を `Content-Security-Policy` に移します（既存の `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` とまとめます）。テストの `csp` も同じヘッダを読むように変えます。

戻すときは、`Content-Security-Policy` を元の 3 つのディレクティブだけにして、Hosting を再デプロイします。
