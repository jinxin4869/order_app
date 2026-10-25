# QRコード対応多言語注文システム

飲食店のお客様がテーブルのQRからスマートフォンのブラウザで注文するアプリです。日本語・英語・中国語に対応し、専門用語辞書を使った翻訳とDeepLだけの翻訳を参加者が自由に切り替えて比較できます。お客様は来店中に自分の端末から送った注文と進行状況を確認できます。

スタッフは同じアプリの`/staff`で、注文の受付から提供までの状態の更新、商品の減数・取消、来店の終了、売り切れと注文受付の停止、商品情報の編集（権限のあるスタッフ）、日次の集計を行います。

課題提出後の段階的な改善版です。POS・決済・会計は未実装です。翻訳の自然さ・食材やアレルゲンの正確さ、実端末・実店舗での運用は別途確認が必要です（[受け入れ確認](docs/acceptance_test_plan.md)）。

## 構成

| 場所                             | 内容                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens`                    | QR入口、言語、メニュー、商品詳細、カート、注文完了、注文履歴、スタッフ画面（注文受付・メニュー管理・集計・訂正・商品情報の編集） |
| `src/components`                 | 復旧の案内、受付停止の案内、メニュー画像                                                                                         |
| `src/hooks`                      | 言語・比較モード、店舗／テーブル単位のカート（送信の復旧・来店ID）、販売状態の確認、接続状態                                     |
| `src/services`                   | FirebaseとCallable API、スタッフ認証                                                                                             |
| `functions/src`                  | 注文（作成・復旧・来店・訂正・集計）、メニュー（取得・販売状態・編集）、翻訳、形態素解析、共通仕様（連投制限・QRトークン）       |
| `test`                           | Firestoreルール・実ハンドラのエミュレーターテスト、復元の訓練、Web操作テスト                                                     |
| `scripts/seed-demo.cjs`          | ローカル専用の合成データ投入                                                                                                     |
| `scripts/issue-table-tokens.cjs` | テーブルのQRトークンの発行（管理者用）                                                                                           |
| `docs`                           | [文書の一覧](docs/README.md)：現行仕様、運用、開発・テスト、研究・評価、初期設計・記録                                           |

React Native / Expo SDK 58、React 19、React Navigation 7、Firebase Cloud Functions v2（`asia-northeast1`）、Firestore、Firebase Authentication、DeepL、kuromojiを使います。

## 初期構築

Node.js **24**（FunctionsとCIも24。`.nvmrc` で指定）、npm、Gitを使用します。エミュレーター検証にはJava **21**、ブラウザ検証にはPlaywrightのChromiumが必要です。Firebase CLIは開発依存に含まれるため`npx firebase`で実行できます。

```bash
git clone https://github.com/jinxin4869/order_app.git
cd order_app
npm ci
npm ci --prefix functions
```

### 機密値なしで検証する

```bash
npm run check
npm run test:audit
npm run audit:dependencies
npm run test:sdk
npm run test:rules
npm run test:demo
npm run test:backup
npx playwright install --with-deps chromium
npm run test:web
```

`check`はフロントとFunctions両方のlint・単体テストです。ルートの`npm test`はフロントのみで、Functionsを含みません。`test:rules`はローカルFirestore・Authで直接書き込みの拒否と実注文API・スタッフAPIの権限停止を検証します。`test:demo`はFirestoreとAuthエミュレーターへ合成データを投入して確認します。`test:backup`は合成データを書き出して新しいエミュレーターへ読み込み、復元後の採番・再送・来店・記録・QRトークンを確認します（[バックアップと復元](docs/backup_restore.md)）。`test:web`は専用の合成設定でWebをビルドし、外部通信を合成応答へ置き換えてスマホ幅・デスクトップ幅の操作を検証します。既存の`.env`やFirebaseログインを使用せず、DeepLへ接続しません。

ブラウザテストの出力先はOSの一時ディレクトリです。`ORDER_APP_WEB_DIR`でビルド先、`ORDER_APP_WEB_ARTIFACTS`でスクリーンショット先を指定できます。日本語表示の目視確認には実行環境の日本語フォントも必要です。

依存更新の範囲・残る監査指摘・期限は[依存ライブラリ更新記録](docs/dependency_updates.md)を参照してください。

詳細は[テストガイド](docs/TESTING.md)、[ローカルデモ投入](docs/demo_setup.md)を参照してください。CIでも同じ各検証を実行します。

### 自分のFirebase環境で起動する

```bash
cp config/firebase.env.example .env
```

`.env`に自分のFirebase Webアプリ設定を記入します。DeepLキーやサービスアカウント秘密鍵をフロントへ入れないでください。`.env.*`・`credentials.json`・秘密鍵はGitの除外対象です。認証情報はリポジトリ外の適切な場所で管理します。例示ファイルにはプレースホルダーだけを記載します。

```bash
npm run web
```

通常のWeb起動は`.env`で指定したFirebaseへ接続します。ローカルエミュレーターへの自動切替はありません。Expo Go・Android/iOS用の`npm run android`／`npm run ios`もありますが、今回の主対象はお客様のスマホブラウザです。

### FunctionsのSecretとスタッフ認証

管理者が対象Firebaseプロジェクトを明示し、DeepLキーを対話入力します。キーをコマンド引数やコミットへ記載しないでください。

```bash
npx firebase functions:secrets:set DEEPL_API_KEY --project <project-id>
```

単発・一括翻訳の両関数が`secrets: ["DEEPL_API_KEY"]`を指定しています。旧Runtime Configの設定手順は使用しません。Secretを変更した場合は対象Functionsを再デプロイします。[Firebase公式のSecret設定](https://firebase.google.com/docs/functions/config-env?gen=2nd#secret-manager)を参照してください。

スタッフはメールアドレスとパスワードでログインします。管理者がFirebase Authenticationのメール／パスワードを有効にし、アカウントを発行したうえで、信頼できるAdmin SDK環境から`{ role: "staff", restaurantId: "所属店舗ID" }`のCustom Claimsを付与します。商品情報を編集するスタッフには`canEditMenu: true`も付与します。[スタッフ認証・店舗権限](docs/staff_access.md)に取得経路と更新競合の扱いを記載しています。お客様のログインは不要です。

### 公開する場合

対象プロジェクトと環境設定を確認し、インデックスを先に反映して準備完了を待ちます。これは手順の例であり、自動テストではデプロイしません。

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project <project-id>
npx firebase deploy --only functions --project <project-id>
npx expo export --platform web --output-dir dist
npx firebase deploy --only hosting --project <project-id>
```

Functionsの強制のスイッチ（App Check・連投制限・QRトークン）は`functions/.env`で設定します（例は`functions/.env.example`。既定はすべてオフ）。それぞれの手順書（[App Check](docs/app_check.md)、[連投制限](docs/order_limits.md)、[QRトークン](docs/table_tokens.md)）の順序で、確認してから有効にしてください。

Hostingには`/order`と`/staff`を`index.html`へ返すSPAリライトが必要です。セキュリティヘッダとCSPの強制への切り替えは[Hostingのセキュリティヘッダ](docs/hosting_headers.md)を参照してください。既存データがある場合の採番カウンター初期化は[注文API契約](docs/order_api.md)を先に確認してください。検証済みのローカル動作と、本番デプロイ・実APIの品質評価は別です。

## 利用フロー

お客様：標準カメラでQR → ブラウザで店舗・テーブル検証 → 言語選択 → メニュー（売り切れ・受付停止の表示） → 商品詳細 → カート → 注文番号 → 注文履歴（来店中の自分の注文と進行状況）。送信の結果がわからなかった注文は、再読み込みのあとも重複させずに復旧します。

テーブルQRには次のWeb URLを使います。

```text
https://<公開ドメイン>/order?restaurant=<店舗ID>&table=<テーブルID>&token=<トークン>
```

トークンつきのURLは`scripts/issue-table-tokens.cjs`で発行します（[テーブルのQRトークン](docs/table_tokens.md)）。`src/utils/orderLinks.js`の`buildOrderLink`でも生成できます。初回・再読み込みともサーバーで店舗とテーブルを検証します。従来の`restaurantId/tableId`形式はアプリ内スキャナーでの互換入力として残します。Expo開発サーバーのQRはアプリ起動用であり、店舗テーブルのQRとは別です。

スタッフ：`/staff` → ログイン →「注文受付」（一覧・詳細、状態の更新、新着の通知、待ち時間、訂正、来店の終了）／「メニュー管理」（売り切れ、受付停止、商品情報の編集、翻訳の更新）／「集計」。新着を15秒ごとに取得し、状態が競合した場合は再取得して再確認を求めます。取得が1分以上止まると画面で知らせます（[注文障害の手順](docs/incident_runbook.md)）。

## 現行仕様

- [注文API契約](docs/order_api.md)：価格・入力・冪等性・数量上限、営業日（日本時間0時）と移行手順
- [スタッフ認証・店舗権限](docs/staff_access.md)：アカウント、一覧・詳細、状態遷移、操作履歴、来店の終了
- [メニュー管理](docs/menu_management.md)：売り切れ・販売再開、注文受付の停止・再開、公開状態と既存データの扱い
- [新規注文の連投制限](docs/order_limits.md)：単位・時間枠・しきい値、強制のスイッチ、記録と対応
- [テーブルのQRトークン](docs/table_tokens.md)：QRの形式、ハッシュの保存、発行・再発行、強制の手順
- [日次の集計](docs/daily_stats.md)：注文数・商品数量・人気の商品・提供までの時間の定義
- [注文障害の検知と代替受付・復旧](docs/incident_runbook.md)：スタッフ向けの手順、検知の対象、紙での受付、照合と再開の判定
- [バックアップと復元](docs/backup_restore.md)：対象と対象外、頻度と目標、復元の手順と確認、照合、訓練
- [翻訳の生成・比較](docs/translation_contract.md)：辞書適用、キャッシュ、未生成・部分訳・旧データの扱い
- [App Checkと同時実行数](docs/app_check.md)、[Hostingのセキュリティヘッダ](docs/hosting_headers.md)
- [実店舗導入前の受け入れ確認](docs/acceptance_test_plan.md)：想定と合否の基準、シナリオ、記録、引き継ぎ
- [評価実験計画](docs/evaluation_plan.md)／[記録テンプレート](docs/tables_template.md)

すべての文書は[文書の一覧](docs/README.md)にまとめています。`docs/database_design.md`・`docs/translation_system_design.md`・`docs/qr_code_design.md`などは初期設計資料、`docs/implementation_order.md`などはその時点の記録です。現在の実装と異なる例や将来構想があるため、上記の現行仕様とREADMEを優先してください。未追跡の旧seedスクリプトや実データは初期構築の前提にしません。
