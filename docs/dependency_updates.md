# 依存ライブラリ更新と監査

確認日: **2026-10-10（日本時間）**。対象はmain `e411cde`を基点にした[Issue #20](https://github.com/jinxin4869/order_app/issues/20)の更新です。Node.js 22.22.1 / npm 10.9.4 / Java 21で検証しました。

## 更新した範囲

通常のsemver範囲でlockfileを更新したコミットと、SDKのメジャー移行を分けています。`npm audit fix --force`は使用していません。

| ライブラリ             | 更新前のlockfile | 更新後  |
| ---------------------- | ---------------- | ------- |
| Expo                   | 54.0.32          | 54.0.37 |
| Firebase Web SDK       | 10.14.1          | 12.19.0 |
| Firebase Admin SDK     | 13.6.0           | 14.5.0  |
| Firebase Functions SDK | 7.0.2            | 7.4.0   |
| DeepL SDK              | 1.24.0           | 1.28.1  |
| Firebase CLI           | 14.27.0          | 15.33.0 |
| Rules unit testing     | 3.0.4            | 5.0.2   |
| lint-staged            | 15.5.2           | 17.6.0  |
| React Native Web       | 0.21.2           | 0.21.4  |
| Functions側Jest        | 29.7.0           | 30.5.2  |

React / React DOM / react-test-rendererは19.1.0で揃え、React NativeはExpo SDK 54指定の0.81.5を維持しています。rendererの指定を完全一致にして、React 19.3系のrendererが混入する問題を防ぎました。Babel設定が直接参照する`babel-preset-expo@~54.0.12`は明示的な開発依存にしました。

未使用だった`firebase-functions-test`を削除しました。既存テストは実ハンドラと独自Firestoreモックを使用しており、このパッケージの旧Admin SDK peer依存は不要です。

`@grpc/grpc-js`、`undici@6`、`postcss`は依存元による古い固定バージョンを、同じmajorの修正済みバージョンへoverrideしています。lockfile上はそれぞれ1.14.6、6.29.0、8.5.29です。

## SDK・検査ルールへの対応

- Admin 14がlegacy namespace APIを削除したため、Functions・エミュレーターテスト・合成データ投入・旧サンプル投入スクリプトを`firebase-admin/app`、`firestore`、`auth`のmodular APIへ移行しました。実プロジェクトの設定は変更していません。
- DeepLの実SDKが汎用`EN`を拒否することをローカルHTTP試験で確認しました。アプリの`en` / `zh`を`EN-US` / `ZH-HANS`へ明示的に対応付け、単体テストと実SDKの送受信試験を追加しました。実際の翻訳APIには接続していません。
- React Hooksの検査更新に合わせ、メニュー取得の状態更新を通信完了コールバックへ移し、再読込の状態変更は操作時に行います。スタッフの詳細表示をrefからstateへ変更し、一覧フィルタのリセットを操作時に行います。遅れて届く旧フィルタの応答を表示しない回帰テストを追加しました。
- Node 22に合わせWeb SDK 12 / Rules SDK 5を採用しました。最新版という理由だけでNode要件やExpoの互換範囲を越える更新は行っていません。

根拠は[Admin公式リリースノート](https://firebase.google.com/support/release-notes/admin/node)、[Web SDK公式リリースノート](https://firebase.google.com/support/release-notes/js)、[DeepL SDK変更履歴](https://github.com/DeepL/deepl-node/blob/main/CHANGELOG.md)、[DeepL APIの言語定義](https://github.com/DeepL/openapi/blob/main/openapi.yaml)です。

## 監査の再現と結果

```bash
npm ci
npm ci --prefix functions
npm run test:audit
npm run audit:dependencies
```

監査スクリプトは公開npmレジストリに対し、ルート／Functionsそれぞれで`npm audit --json`と`npm audit --omit=dev --json`を実行します。通常のアプリ起動や本番Firebaseには接続しません。JSONは既定でOS一時領域の`order-app-dependency-audit`へ保存し、CIではArtifactとして保存します。

| 範囲                   | 更新前 critical / high / moderate / low | 更新後 critical / high / moderate / low |
| ---------------------- | --------------------------------------- | --------------------------------------- |
| Functions 本番依存     | 4 / 9 / 13 / 1                          | **0 / 0 / 0 / 0**                       |
| Functions 開発依存込み | 4 / 43 / 19 / 2                         | **0 / 0 / 19 / 0**                      |
| ルート 本番指定        | 3 / 35 / 26 / 1                         | **0 / 23 / 18 / 0**                     |
| ルート 開発依存込み    | 3 / 67 / 34 / 2                         | **0 / 51 / 22 / 0**                     |

数値は監査のパッケージ数であり、伝播した依存元の指摘を含みます。独立した脆弱性件数・悪用可能性・ブラウザへの同梱数とは異なります。ルートのdependenciesにはExpoとそのビルドツールも含まれるため、`--omit=dev`もブラウザ実行経路だけの集計ではありません。

更新前の`protobufjs`はFirestore/gRPCおよびFunctions、`proxy-addr`はFunctionsのExpress依存、`fast-xml-parser`はAdmin経由のCloud Storage依存に含まれていました。Firestoreを使う注文・メニュー・翻訳ハンドラとCallable HTTP処理は実アプリの経路です。一方、アプリの当該ハンドラにはCloud Storage利用は見当たらず、XML攻撃の到達は確認していません。`websocket-driver`はAdminのRealtime Database → faye-websocket経由ですが、当該ハンドラにRealtime Database利用は見当たりません。指摘の悪用や侵害を確認したものではなく、依存ごと更新して解消しました。

## 残る指摘と期限

継続対応は[Issue #40](https://github.com/jinxin4869/order_app/issues/40)です。**対応期限は2026-10-23 JST、high例外は2026-10-24 00:00 JSTに失効**します。実店舗公開前にも再評価します。

highの原因は以下4パッケージ・5アドバイザリです。対象scope・GHSA・バージョン・lockfile内のパス・理由・期限を[例外ファイル](dependency-audit-exceptions.json)で限定します。

| 対象                    | 主な依存経路・到達処理                                 | 残した理由・暫定対策                                                                           |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| basic-ftp 5.3.1         | Firebase CLI → proxy-agent → get-uri。プロキシ/FTP処理 | 修正6.2.3は親の5.x指定外。FTP/PAC経由接続を避け、CLI系統を移行する                             |
| braces 3.0.3            | Jest/Metro/chokidar。ファイル選択パターン              | 確認時点の最新版も該当。外部入力をglobへ渡さず信頼済みソースのみをビルドし、上流修正を追跡する |
| image-size 1.2.1（2件） | Expo → Metro。ビルド時の画像解析                       | 修正版2.xのAPI変更を一律overrideで回避せずSDK移行時に検証する。信頼済み静的画像のみ扱う        |
| node-forge 1.4.0        | Expo CLI/コード署名。証明書解析                        | 確認時点で修正版未公開。外部提供の証明書を扱わず上流修正を追跡する                             |

Functionsにはhigh/criticalの例外を設けていません。CIは新しいhigh、対象バージョン／パスの変化、期限切れ、全critical、監査の通信失敗・不正応答で失敗します。moderateもJSONに記録しますが、現行CIの失敗閾値はhighです。

moderateの主な残存経路も同じ期限で再評価します。

- `decode-uri-component@0.2.2`: Navigation 6 → query-string。ブラウザのURL処理に到達し得るためNavigation 7移行を優先します。
- `sprintf-js@1.0.3`: Jest/ESLint → js-yaml → argparse。設定・カバレッジ処理です。Functions開発依存19件もこの指摘の伝播で、本番依存には含まれません。上流対応またはテスト・lint依存元の移行を検討します。
- `@opentelemetry/core@1.30.1`: Firebase CLI → Pub/Sub。CLIの計測系統です。
- `re2@1.24.1`: Firebase CLI → superstatic。ローカル配信時のパターン処理です。
- `uuid@9.0.1 / 7.0.3`: Firebase CLI → gaxios、Expo設定 → xcode。CLI/設定系統です。

Expoは[公式の段階的更新手順](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)に従い54→55→56→57でReact/React Native/関連パッケージを揃えて検証する方針です。未公開修正の例外は自動延長せず、期限前に到達条件・代替策・上流状況を再レビューします。

## 動作検証

| 検証                         | 結果                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| ルート・Functionsの`npm ci`  | 成功                                                                                                       |
| `npm run check`              | 両lint成功、フロント20スイート183件、Functions7スイート170件成功                                           |
| `npm run test:audit`         | 例外の期限・scope・バージョン・critical拒否・監査エラー等9件成功                                           |
| `npm run audit:dependencies` | 上記の限定したhigh例外を適用して成功                                                                       |
| `npm run test:sdk`           | 実DeepL SDKの英語・中国語リクエストと応答解析をloopback HTTPで確認                                         |
| `npm run test:rules`         | 実注文ハンドラ、冪等性、並列採番、所属店舗制限・更新競合、直接書込拒否をローカルFirestoreで確認            |
| `npm run test:demo`          | Admin 14でローカルFirestore/Authの投入・取得・スタッフClaims確認成功                                       |
| `npm run test:web`           | 合成設定でWebビルド、1280×900 / 390×844のQR再読込・注文・スタッフログイン/更新/競合/ログアウト成功         |
| ExpoのSDK依存整合            | `EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 npx expo install --check`成功。オフラインのためオンラインの全検証ではない |

既存の機密ファイル・Firebaseログイン・本番データは参照していません。合成テストは実DeepLの翻訳品質、公開環境の接続・認証設定、実端末や店舗運用を保証しません。Android/iOSネイティブビルドは今回検証していません。旧`import_sample_data.js`はAPIの移行と構文検査のみ行い、実プロジェクトへ接続するため実行していません。
