# QRコード対応多言語注文システム

飲食店のお客様がテーブルのQRからスマートフォンのブラウザで注文するアプリです。日本語・英語・中国語に対応し、専門用語辞書を使った翻訳とDeepLだけの翻訳を参加者が自由に切り替えて比較できます。スタッフは同じアプリの`/staff`で注文を確認し、受付から提供までの状態を更新します。

課題提出後の段階的な改善版です。POS・決済・会計後のテーブル解放は未実装です。翻訳の自然さ・食材やアレルゲンの正確さ、実端末・実店舗での運用は別途確認が必要です。

## 構成

| 場所                    | 内容                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `src/screens`           | QR入口、言語、メニュー、商品詳細、カート、注文完了、スタッフ画面 |
| `src/hooks`             | 言語・比較モード、店舗／テーブル単位のカート、接続状態           |
| `src/services`          | FirebaseとCallable API、スタッフ認証                             |
| `functions/src`         | 注文、メニュー、翻訳、形態素解析、共通仕様                       |
| `test`                  | Firestoreルール・実ハンドラのエミュレーターテスト、Web操作テスト |
| `scripts/seed-demo.cjs` | ローカル専用の合成データ投入                                     |
| `docs`                  | 現行API契約、運用・テスト手順、初期設計・評価計画                |

React Native / Expo SDK 54、React 19、React Navigation 6、Firebase Cloud Functions v2（`asia-northeast1`）、Firestore、Firebase Authentication、DeepL、kuromojiを使います。

## 初期構築

Node.js **22**（FunctionsとCIも22）、npm、Gitを使用します。エミュレーター検証にはJava **21**、ブラウザ検証にはPlaywrightのChromiumが必要です。Firebase CLIは開発依存に含まれるため`npx firebase`で実行できます。

```bash
git clone https://github.com/jinxin4869/order_app.git
cd order_app
npm ci
npm ci --prefix functions
```

### 機密値なしで検証する

```bash
npm run check
npm run test:rules
npm run test:demo
npx playwright install --with-deps chromium
npm run test:web
```

`check`はフロントとFunctions両方のlint・単体テストです。ルートの`npm test`はフロントのみで、Functionsを含みません。`test:rules`はローカルFirestoreで直接書き込みの拒否と実注文API・スタッフAPIを検証します。`test:demo`はFirestoreとAuthエミュレーターへ合成データを投入して確認します。`test:web`は専用の合成設定でWebをビルドし、外部通信を合成応答へ置き換えてスマホ幅・デスクトップ幅の操作を検証します。既存の`.env`やFirebaseログインを使用せず、DeepLへ接続しません。

ブラウザテストの出力先はOSの一時ディレクトリです。`ORDER_APP_WEB_DIR`でビルド先、`ORDER_APP_WEB_ARTIFACTS`でスクリーンショット先を指定できます。日本語表示の目視確認には実行環境の日本語フォントも必要です。

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

スタッフはメールアドレスとパスワードでログインします。管理者がFirebase Authenticationのメール／パスワードを有効にし、アカウントを発行したうえで、信頼できるAdmin SDK環境から`{ role: "staff", restaurantId: "所属店舗ID" }`のCustom Claimsを付与します。[スタッフ認証・店舗権限](docs/staff_access.md)に取得経路と更新競合の扱いを記載しています。お客様のログインは不要です。

### 公開する場合

対象プロジェクトと環境設定を確認し、インデックスを先に反映して準備完了を待ちます。これは手順の例であり、自動テストではデプロイしません。

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project <project-id>
npx firebase deploy --only functions --project <project-id>
npx expo export --platform web --output-dir dist
npx firebase deploy --only hosting --project <project-id>
```

Hostingには`/order`と`/staff`を`index.html`へ返すSPAリライトが必要です。既存データがある場合の採番カウンター初期化は[注文API契約](docs/order_api.md)を先に確認してください。検証済みのローカル動作と、本番デプロイ・実APIの品質評価は別です。

## 利用フロー

お客様：標準カメラでQR → ブラウザで店舗・テーブル検証 → 言語選択 → メニュー → 商品詳細 → カート → 注文番号。

テーブルQRには次のWeb URLを使います。

```text
https://<公開ドメイン>/order?restaurant=<店舗ID>&table=<テーブルID>
```

`src/utils/orderLinks.js`の`buildOrderLink`で生成できます。初回・再読み込みともサーバーで店舗とテーブルを検証します。従来の`restaurantId/tableId`形式はアプリ内スキャナーでの互換入力として残します。Expo開発サーバーのQRはアプリ起動用であり、店舗テーブルのQRとは別です。

スタッフ：`/staff` → ログイン → 自店舗の注文一覧／詳細 → 受付・調理・提供・対応完了。新着を15秒ごとに取得し、状態が競合した場合は再取得して再確認を求めます。

## 現行仕様と改善ブランチ

- [注文API契約](docs/order_api.md)：価格・入力・冪等性・数量上限、営業日（日本時間0時）と移行手順
- [スタッフ認証・店舗権限](docs/staff_access.md)：アカウント、一覧・詳細、状態遷移
- [翻訳の生成・比較](docs/translation_contract.md)：辞書適用、キャッシュ、未生成・部分訳・旧データの扱い
- [対応順とブランチ構成](docs/implementation_order.md)：Issueごとのブランチと依存関係
- [評価実験計画](docs/evaluation_plan.md)／[記録テンプレート](docs/tables_template.md)

`docs/database_design.md`・`docs/translation_system_design.md`・`docs/qr_code_design.md`などは初期設計資料です。現在の実装と異なる例や将来構想があるため、上記の現行仕様とREADMEを優先してください。未追跡の旧seedスクリプトや実データは初期構築の前提にしません。
