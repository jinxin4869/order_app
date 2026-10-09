# テストガイド

Node.js 22、エミュレーターにはJava 21を使用します。まずルートと`functions`の両方で`npm ci`を実行します。

| コマンド                                     | 対象・接続先                                                       |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `npm test -- --runInBand`                    | フロントのJestテスト。Firebase初期化をモックしdotenvを読み込まない |
| `npm test --prefix functions -- --runInBand` | 実FunctionsハンドラをモックFirestore・合成DeepL応答で検証          |
| `npm run check`                              | 両方のlintと単体テスト                                             |
| `npm run test:rules`                         | ローカルFirestoreでルール・実注文API・スタッフ一覧／更新競合を検証 |
| `npm run test:demo`                          | ローカルFirestore・Authの起動、合成データ投入・取得・Claims確認    |
| `npm run test:web`                           | 合成設定でExpo WebをビルドしPlaywrightで操作検証                   |

ルートの`npm test`だけではFunctions・ルール・ブラウザは検証されません。CIは上表の各検証を実行します。pre-commitはステージ済みファイルのlint-staged、pre-pushは`check`を実行します。Functionsのlintは専用の設定を明示して実ソースを検証します。

## Firestore・Authエミュレーター

テストランナーはプロジェクト`demo-order-app`とローカル接続先を使用し、新しいCLI設定ディレクトリで開発者のFirebaseログインを引き継がないようにします。8080番（Firestore）と9099番（Auth、demoのみ）が空いている必要があります。初回はエミュレーターのダウンロードにネットワーク接続が必要です。

直接注文create/read/update/deleteの拒否、公開メニューの取得、正規ハンドラによる注文、同一requestIdの重複抑止、並列採番、スタッフ一覧のページ送り・所属店舗制限、同時更新の片方だけの成功を検証します。ルール拒否のテストではPERMISSION_DENIEDのログが出ますが、終了コード0なら期待どおりです。

## ブラウザ

```bash
npx playwright install --with-deps chromium
npm run test:web
```

`test/build-web.cjs`が合成環境ファイルを一時生成し、通常の環境ファイルを読み込まずExpoをビルドします。`test/web.smoke.cjs`はローカルHTTPサーバーと合成API応答だけを許可し、それ以外の通信を遮断します。実アカウント・DeepL・本番Firestoreを使いません。

1280×900と390×844でQR URLの初回／再読み込み、無効・停止テーブル、カテゴリのローカル切替と明示更新、翻訳欠損の表示と自由切替、カート削除・注文の決定／キャンセル、注文API1回、スタッフログイン・状態変更・競合後の再取得・ログアウトを検証します。

出力は一時ディレクトリの`order-app-web-test`と`order-app-*.png`です。`ORDER_APP_WEB_DIR`／`ORDER_APP_WEB_ARTIFACTS`で変更できます。CIは画像をArtifactとして保存します。日本語フォントがない実行環境では画像に四角が表示されるため、フォントを追加してから目視確認してください。

合成応答での成功は本番の疎通・認証設定・翻訳品質を保証しません。実際の公開URLでのQR到達、モバイル端末、店舗のアカウント・食材情報・接続不良時の運用は公開前に確認します。
