# 依存ライブラリ更新と監査

確認日: **2026-10-25（日本時間）**。main `b36c6ea`（Expo SDK 58）で、Node.js 22 / Java 21 を使って確認しました。

## 現在の主なバージョン

| 対象                 | バージョン                                                         |
| -------------------- | ------------------------------------------------------------------ |
| Expo SDK             | 58.0.19                                                            |
| React / React DOM    | 19.3.0                                                             |
| React Native         | 0.88.0                                                             |
| React Native Web     | 0.21.4                                                             |
| React Navigation     | 7.5                                                                |
| Firebase Web SDK     | 13.1.0                                                             |
| Sentry React Native  | 8.28.0                                                             |
| Firebase CLI（開発） | 15.34.1                                                            |
| Rules unit testing   | 6.0.0                                                              |
| Jest（フロント）     | 30.5.2（jest-expo 58、`@react-native/jest-preset` 0.88.0）         |
| Functions            | firebase-admin 14.5.0、firebase-functions 7.4.0、deepl-node 1.28.1 |
| ESLint               | 10.13（ルートと Functions）                                        |

Expo 管理下のパッケージ（react、react-native、expo-\*、jest-expo、babel-preset-expo など）は、`npx expo install --fix` が決めるバージョンに揃えます。Dependabot のバージョン更新の対象からは外しています（下の「Dependabot の方針」）。

## Dependabot の方針

設定は `.github/dependabot.yml` と `.github/workflows/dependabot-auto-merge.yml` です。

- **待機期間：** npm のバージョン更新は、公開から 7 日たった版だけを提案します。セキュリティ更新は待ちません。
- **まとめ方：** patch・minor は、ルートと `/functions` のそれぞれで、本番依存（`production`）と開発依存（`development`）の 2 本にまとめます。メジャー更新は 1 パッケージ 1 本のままです。セキュリティ更新は、それぞれ `security` の 1 本にまとめます。
- **自動マージ：** 対象は、開発依存と間接依存の patch・minor だけです。次のどれかを 1 つでも含む PR は、まとめた PR 全体を人が確認します：直接の本番依存（GitHub Actions を含む）、メジャー更新、0.x の minor 更新、Expo 管理下のパッケージ、更新の種類や更新前の版を読み取れない依存。
- **Expo 管理下のパッケージ：** Dependabot のバージョン更新では提案しません（`ignore`）。Dependabot は npm の最新版を選ぶため、Expo の期待する版とずれることがあるためです。本番依存の PR を確認するときに `npx expo install --check` を実行し、差があれば `npx expo install --fix` で揃えます。セキュリティ更新は届きます。
- **見送るメジャー更新：** ルートの `@babel/core`（Expo・Metro・jest 系が Babel 7 を要求）と `jest`（jest-expo の peer が対応するメジャーのみ）は、メジャー更新を提案しません。Expo SDK を上げるときに見直します。

## Expo SDK の更新手順と注意点

[公式の段階的更新手順](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)に従い、1 世代ずつ上げます（54 → 55 → 56 → 57 → 58 は #97〜#100）。各世代で次を行います。

1. `npx expo install expo@^<SDK>.0.0 --fix` を実行し、`package.json` の `expo` を `~` 指定に戻す。
2. `npx expo install --check` が「最新」になるまで確認する。
3. `npm dedupe` で重複を整理し、`npx expo-doctor@latest` を実行する。
4. 下の「監査の再現」と「動作検証」のコマンドをすべて実行する。

更新で見つかった注意点です。

- **jest-expo と `@react-native/jest-preset`：** jest-expo 57 以降は `@react-native/jest-preset` を必須の peer にしています。react-native を上げるときは、jest-expo と `@react-native/jest-preset` を同じ版に合わせて同時に入れてください。古い jest-expo が残っていると、`npx expo install --fix` が ERESOLVE で止まります。
- **Sentry の設定プラグイン：** Sentry 7.11 の設定プラグインは `@expo/config-plugins` をルートから `require` します。SDK 56 への更新直後は、このパッケージが expo の配下にだけ置かれ、Web のビルドが `Cannot find module '@expo/config-plugins'` で失敗しました。`npm dedupe` で解消します。Sentry 8 では `expo/config-plugins` に直っています。
- **ネイティブ版：** Android / iOS は、SDK を上げるたびに新しい development build が必要です。Expo Go のストア版は最新の SDK にしか対応しません。

## 監査の再現

```bash
npm ci
npm ci --prefix functions
npm run test:audit
npm run audit:dependencies
```

監査スクリプトは公開 npm レジストリに対し、ルートと Functions それぞれで `npm audit --json` と `npm audit --omit=dev --json` を実行します。アプリの起動や本番の Firebase には接続しません。JSON は既定で OS の一時領域の `order-app-dependency-audit` に保存し、CI では Artifact として保存します。

| 範囲                   | critical / high / moderate / low |
| ---------------------- | -------------------------------- |
| Functions 本番依存     | 0 / 0 / 0 / 0                    |
| Functions 開発依存込み | 0 / 0 / 0 / 0                    |
| ルート 本番指定        | 0 / 5 / 0 / 0                    |
| ルート 開発依存込み    | 0 / 5 / 5 / 0                    |

数値は監査のパッケージ数で、依存元へ伝播した指摘を含みます。独立した脆弱性の件数や、ブラウザに含まれる件数とは異なります。ルートの dependencies には Expo とそのビルドツールも含まれるため、`--omit=dev` もブラウザで動くコードだけの集計ではありません。

## 残る指摘と期限

high / critical の例外は現在ありません。[例外ファイル](dependency-audit-exceptions.json)の `exceptions` は空です。例外を追加するときは、対象の scope・GHSA・バージョン・lockfile 内のパス・理由・期限を限定します。例外は期限だけを自動で延長しません。

moderate は次の 2 件で、どちらも開発用の Firebase CLI（エミュレーターとデプロイ）からだけ入ります。アプリ、Functions、Hosting には含まれません。Firebase CLI の更新で解消を確認します。

- `@opentelemetry/core` 1.30.1：Firebase CLI → Pub/Sub。CLI の計測処理です。
- `uuid` 9.0.1：Firebase CLI → gaxios。バッファーを渡す v3/v5/v6 の生成だけが対象です。

Functions には high / critical の例外を設けていません。CI は、新しい high、対象バージョンやパスの変化、期限切れ、すべての critical、監査の通信失敗・不正な応答で失敗します。moderate も JSON に記録しますが、CI の失敗の基準は high です。

解消済みの指摘：image-size 1.2.1（2 件）は SDK 55 で依存から外れました。basic-ftp、braces、decode-uri-component、sprintf-js、re2 などは、#20 と #60 以降の更新で解消しています。node-forge 1.4.0 の指摘（例外にしていた GHSA-86w9-cpqp-85rv を含む）は 1.4.3 への更新で対象外になり、例外を削除しました。zod 3.25.76 の指摘（例外にしていた GHSA-mrhx-c7xc-m3w5）は、expo 58.0.25 への更新で `@expo/cli` が zod に依存しなくなって対象外になり、例外を削除しました。

## 動作検証

| 検証                         | 内容                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run check`              | 両方の lint、フロント 20 スイート 183 件、Functions 9 スイート 202 件                                                |
| `npm run test:audit`         | 例外の期限・scope・バージョン・critical の拒否・監査エラーなど 9 件                                                  |
| `npm run audit:dependencies` | high / critical の指摘も例外もなしで成功                                                                             |
| `npm run test:sdk`           | 実際の DeepL SDK の英語・中国語のリクエストと応答の解析を loopback HTTP で確認                                       |
| `npm run test:rules`         | 実際の注文ハンドラ、冪等性、並列の採番、所属店舗の制限・更新の競合、直接書き込みの拒否をローカルの Firestore で確認  |
| `npm run test:demo`          | ローカルの Firestore / Auth への合成データの投入・取得・スタッフの Claims の確認                                     |
| `npm run test:web`           | 合成の設定で Web をビルドし、1280×900 / 390×844 で QR の再読み込み・注文・スタッフのログイン・更新・競合・ログアウト |
| `npx expo-doctor@latest`     | 20/20 成功                                                                                                           |

機密ファイル・Firebase のログイン・本番データは使っていません。合成テストは、実際の DeepL の翻訳品質、公開環境の接続・認証の設定、実機や店舗での運用を保証しません。Android / iOS のネイティブビルドは、この確認には含まれていません。
