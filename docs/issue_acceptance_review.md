# push前のIssue完了条件レビュー

確認日: 2026-10-09。既存19件の完了条件73項目を、ソース・回帰テスト・非本番の動作確認と照合しました。以下のチェックは**実装とローカル検証での達成**を示します。公開環境での動作保証やmainへのマージ完了を意味しません。

独立したブランチと依存するスタックを[対応順](implementation_order.md)のとおりレビューします。スタッフの読み取り経路など後続Issueと連携する条件は、全変更を含む `chore/17-reproducible-setup` で確認しています。個々のブランチを単独で本番配備する想定ではありません。

再レビューで見つかった2点を#12・#18の各ブランチで修正し、#13・#19・#14・#17へ必要な依存をマージしました。変更履歴を残すためrebase・force pushは使いません。

## [#16](https://github.com/jinxin4869/order_app/issues/16) 認証情報と環境ファイルをGitの追跡対象から確実に除外する

ブランチ: `fix/16-ignore-sensitive-files`。判定: 実装・ローカル検証で達成。

- [x] 認証情報の指定保存先と.env.*を除外し、例示用ファイルだけ例外にする。
- [x] 開発手順に秘密鍵をコミットしない保存方法を明記する。
- [x] 架空のパスを使ってignore動作を検証する。

指定のcredentials.json、環境ファイルの派生名、サービスアカウント名、秘密鍵をignoreし、例示用の.env.example/.env.sampleだけ例外にします。認証情報はリポジトリ外で管理する手順です。架空のパスでignoreと例外を検証し、実際の機密ファイルの内容・履歴は調べていません。

実装: [.gitignore](../.gitignore)、[README.md](../README.md)

検証: [docs/verification_results.md](../docs/verification_results.md)

## [#15](https://github.com/jinxin4869/order_app/issues/15) バックエンドの失敗テストを修正し、実ハンドラをCIで検証する

ブランチ: `chore/15-test-and-ci`。判定: 実装・ローカル検証で達成。

- [x] 失敗5件の仕様と期待値を整理して修正する。
- [x] 実注文ハンドラ・翻訳ハンドラ・Firestoreルールの許可／拒否をテストする。
- [x] functions用ESLint設定を明示し、実ファイルが検証されるようにする。
- [x] フロント／バックエンドのテストとlintをCIで実行する。

旧失敗5件の期待値を、推測で漢字とかなを同一視しない／登録済み読みを使う仕様に修正しています。注文・翻訳の実ハンドラ、ルール許可／拒否を検証します。Functions lintは設定を明示して実ファイルを処理し、CIに両方のlint・テストとエミュレーター・Web確認を定義しました。リモートActions実行はPR作成またはmain push時です。

実装: [.github/workflows/checks.yml](../.github/workflows/checks.yml)、[functions/scripts/lint.js](../functions/scripts/lint.js)、[functions/.eslintrc.js](../functions/.eslintrc.js)、[package.json](../package.json)

検証: [functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)、[functions/src/__tests__/translation.test.js](../functions/src/__tests__/translation.test.js)、[functions/src/__tests__/synonyms.test.js](../functions/src/__tests__/synonyms.test.js)、[test/firestore.rules.test.cjs](../test/firestore.rules.test.cjs)

## [#6](https://github.com/jinxin4869/order_app/issues/6) Web版の注文・削除確認を動作するダイアログに置き換える

ブランチ: `fix/6-web-confirmations`。判定: 実装・ローカル検証で達成。

- [x] Webでも利用できる共通確認ダイアログを用意する。
- [x] 注文・削除の決定／キャンセルと、QRエラー後の再スキャンを動作させる。
- [x] ブラウザ用テストで注文API呼び出しまで検証する。
- [x] 操作中の二重決定を防止する。

共通ダイアログはWebでconfirm/alert、NativeでAlertを使用します。注文／削除の決定・キャンセル、QRエラー後の再スキャン、送信のrefロックを確認しました。ブラウザ操作では注文APIの1回送信を確認しました。

実装: [src/utils/dialogs.js](../src/utils/dialogs.js)、[src/screens/CartScreen.js](../src/screens/CartScreen.js)、[src/screens/QRScannerScreen.js](../src/screens/QRScannerScreen.js)

検証: [src/utils/__tests__/dialogs.test.js](../src/utils/__tests__/dialogs.test.js)、[src/screens/__tests__/CartScreen.test.js](../src/screens/__tests__/CartScreen.test.js)、[src/screens/__tests__/QRScannerScreen.test.js](../src/screens/__tests__/QRScannerScreen.test.js)、[test/web.smoke.cjs](../test/web.smoke.cjs)

## [#7](https://github.com/jinxin4869/order_app/issues/7) 店舗QRのURLからブラウザで直接注文セッションを開始できるようにする

ブランチ: `feat/7-qr-web-entry`。判定: 実装・ローカル検証で達成。

- [x] Web URL形式のQRと、そのURLの店舗・テーブルパラメータを処理する入口を実装する。
- [x] URLから受け取った識別子もサーバーで検証し、言語選択へ進める。
- [x] 無効／停止中の店舗・テーブルを案内する。
- [x] QRからの初回アクセス、再読み込み、直接URLアクセスをブラウザで検証する。

Web URLの識別子を解析し、サーバーで店舗・テーブルの存在と利用可否を検証して言語選択へ進めます。無効／停止状態、初回・直接URL・再読み込みを確認しました。公開Hostingは未デプロイです。

実装: [src/utils/orderLinks.js](../src/utils/orderLinks.js)、[src/screens/OrderEntryScreen.js](../src/screens/OrderEntryScreen.js)、[functions/src/utils/qr.js](../functions/src/utils/qr.js)、[functions/src/menu/index.js](../functions/src/menu/index.js)、[firebase.json](../firebase.json)

検証: [src/utils/__tests__/orderLinks.test.js](../src/utils/__tests__/orderLinks.test.js)、[src/screens/__tests__/OrderEntryScreen.test.js](../src/screens/__tests__/OrderEntryScreen.test.js)、[functions/src/__tests__/qr.test.js](../functions/src/__tests__/qr.test.js)、[test/web.smoke.cjs](../test/web.smoke.cjs)

## [#2](https://github.com/jinxin4869/order_app/issues/2) Firestoreへの無条件の注文直接作成を禁止する

ブランチ: `fix/2-firestore-order-writes`。判定: 実装・ローカル検証で達成。

- [x] 注文作成をサーバー処理に集約し、クライアントの直接createを拒否する。
- [x] 匿名クライアントの直接作成拒否と、正規Callableによる作成成功をエミュレーターで検証する。
- [x] スタッフ画面のread権限は別途、所属店舗の注文だけに制限する。

クライアントの注文create/read/update/deleteを拒否し、スタッフは所属店舗を検証するCallable経由で取得します。匿名／staffの直接作成拒否と実注文ハンドラ成功をエミュレーターで確認しました。スタッフ取得経路は#19で追加しています。

実装: [firestore.rules](../firestore.rules)、[functions/src/orders/index.js](../functions/src/orders/index.js)

検証: [test/firestore.rules.test.cjs](../test/firestore.rules.test.cjs)

## [#1](https://github.com/jinxin4869/order_app/issues/1) 管理者向けCallable APIに店舗単位の認証・権限チェックを追加する

ブランチ: `fix/1-staff-api-permissions`。判定: 実装・ローカル検証で達成。

- [x] 未認証・スタッフ以外・他店舗所属の呼び出しを拒否する。
- [x] スタッフの所属店舗と対象注文・メニューの店舗を照合する。
- [x] 許可・拒否の両方を実ハンドラでテストする。

認証・role・所属店舗をDB参照前に検証し、対象注文・翻訳先店舗も照合します。許可／拒否の実ハンドラテストを確認しました。

実装: [functions/src/utils/staffAuth.js](../functions/src/utils/staffAuth.js)、[functions/src/orders/index.js](../functions/src/orders/index.js)、[functions/src/translation/index.js](../functions/src/translation/index.js)

検証: [functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)、[functions/src/__tests__/translation.test.js](../functions/src/__tests__/translation.test.js)

## [#11](https://github.com/jinxin4869/order_app/issues/11) 注文入力の型・数量・備考・多言語項目の契約を統一する

ブランチ: `fix/11-order-input-contract`。判定: 実装・ローカル検証で達成。

- [x] 入力スキーマでID・配列・要素・有限の数値・整数数量・文字列長を先に確認する。
- [x] notesとspecial_requestを一本化し、保存するフィールドを検証する。
- [x] 商品名をマスターから確定して必要な多言語スナップショットを保存する。
- [x] 不正入力は一貫してinvalid-argumentを返す。

DB参照前にID・配列・要素・金額・整数数量・文字数を検証します。備考はnotesに統一しspecial_requestを拒否します。商品名はマスターの多言語スナップショットを保存します。不正形式はinvalid-argumentで、商品不存在・販売停止等の業務エラーとは区別します。

実装: [functions/src/utils/orderInput.js](../functions/src/utils/orderInput.js)、[functions/src/orders/index.js](../functions/src/orders/index.js)、[docs/order_api.md](../docs/order_api.md)

検証: [functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)

## [#3](https://github.com/jinxin4869/order_app/issues/3) 注文時にメニューマスターの価格・販売可否・営業状態を検証する

ブランチ: `fix/3-validate-menu-prices`。判定: 実装・ローカル検証で達成。

- [x] 店舗配下の商品を取得し、存在・販売可否・マスター価格を確認する。
- [x] 商品名・単価・税・合計をサーバーで確定し、クライアント値をそのまま信用しない。
- [x] 受付停止・品切れ・他店舗商品・改変価格のテストを追加する。
- [x] 価格変更時に利用者へ再確認させるか、エラーにするかを決める。

店舗配下の商品・販売可否・マスター価格と名前を取得し、税・小計・合計をサーバー計算します。価格不一致はprice_changedで拒否し、カート破棄後に選び直す方針です。停止店舗・品切れ・他店舗商品・改変価格／合計の拒否テストを確認しました。

実装: [functions/src/orders/index.js](../functions/src/orders/index.js)、[docs/order_api.md](../docs/order_api.md)

検証: [functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)

## [#4](https://github.com/jinxin4869/order_app/issues/4) 注文作成を冪等化し、注文保存とテーブル更新を原子的に行う

ブランチ: `fix/4-idempotent-order-creation`。判定: 実装・ローカル検証で達成。

- [x] 利用者の一回の注文操作に固定のリクエストIDを付け、再試行時も再利用する。
- [x] 同じリクエストIDでは同じ注文ID・番号を返す。
- [x] 注文保存・冪等性記録・テーブル更新をトランザクション等で一括確定する。
- [x] 応答消失、テーブル更新失敗、二重送信のテストを追加する。

内容が同じ再送でrequestIdを再利用し、同じIDでは同じ注文ID・番号を返します。注文・処理済み記録・テーブル更新・採番が同一トランザクションです。応答消失、並列同一ID、テーブル更新失敗時のロールバックを確認しました。

実装: [src/hooks/useCart.js](../src/hooks/useCart.js)、[src/services/api.js](../src/services/api.js)、[functions/src/orders/index.js](../functions/src/orders/index.js)

検証: [functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)、[src/hooks/__tests__/useCart.test.js](../src/hooks/__tests__/useCart.test.js)、[test/firestore.rules.test.cjs](../test/firestore.rules.test.cjs)

## [#5](https://github.com/jinxin4869/order_app/issues/5) 日次注文番号をトランザクションで採番し、営業日のタイムゾーンを統一する

ブランチ: `fix/5-transactional-order-numbers`。判定: 実装・ローカル検証で達成。

- [x] 店舗・営業日ごとのカウンターをトランザクションで更新する。
- [x] 日本での営業を想定したタイムゾーンと日付切り替え規則を明示する。
- [x] 並列注文と日付境界のテストを追加する。
- [x] 全注文の読み出しで採番しない。

店舗・日本時間の日付ごとのカウンターを注文と同時に更新します。切替はユーザー指定のJST 00:00。並列採番と日付境界、翌日の再送を確認しました。旧データ移行の検査は最大1件で、全注文数から採番しません。

実装: [functions/src/utils/businessDay.js](../functions/src/utils/businessDay.js)、[functions/src/orders/index.js](../functions/src/orders/index.js)、[docs/order_api.md](../docs/order_api.md)

検証: [functions/src/__tests__/businessDay.test.js](../functions/src/__tests__/businessDay.test.js)、[functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)、[test/firestore.rules.test.cjs](../test/firestore.rules.test.cjs)

## [#12](https://github.com/jinxin4869/order_app/issues/12) カートを店舗・テーブルのセッション単位で管理する

ブランチ: `fix/12-scope-cart-to-table`。判定: 実装・ローカル検証で達成。

- [x] カートをrestaurantId/tableIdまたは明示的なsessionIdに関連付ける。
- [x] 別セッション開始時の破棄・確認を実装する。
- [x] 同一セッションの追加注文と、他店舗への移動を区別する。
- [x] 店舗・テーブル変更をまたぐ画面遷移テストを追加する。

店舗／テーブルでカートを分け、別セッションでは未注文カート・送信IDを破棄します。同じテーブルの画面移動と成功後の追加注文を区別します。再レビューで、旧セッションの遅い成功／失敗・価格変更確認が新しいカートに影響する不足を修正し、回帰テストを追加しました。

実装: [src/hooks/useCart.js](../src/hooks/useCart.js)、[src/utils/cartSession.js](../src/utils/cartSession.js)、[src/navigation/AppNavigator.js](../src/navigation/AppNavigator.js)、[src/screens/CartScreen.js](../src/screens/CartScreen.js)

検証: [src/navigation/__tests__/cartSession.test.js](../src/navigation/__tests__/cartSession.test.js)、[src/hooks/__tests__/useCart.test.js](../src/hooks/__tests__/useCart.test.js)

## [#13](https://github.com/jinxin4869/order_app/issues/13) カートの数量上限を画面・フック・APIで統一する

ブランチ: `fix/13-cart-quantity-limit`。判定: 実装・ローカル検証で達成。

- [x] 数量範囲を共通の仕様として定義する。
- [x] 追加合算・カート更新でも上限を適用する。
- [x] 上限到達時にボタン無効化または分かるメッセージを表示する。
- [x] 99への追加と100への更新の境界をテストする。

1〜99個の共通定義を画面・フック・APIで使用します。同一商品＋備考の合算と更新にも上限を適用し、詳細の残数・カートの上限表示とボタン無効化を確認しました。98→99、99への追加、100への更新、APIで99受理／100拒否を確認しました。

実装: [functions/src/utils/orderLimits.js](../functions/src/utils/orderLimits.js)、[src/hooks/useCart.js](../src/hooks/useCart.js)、[src/screens/ItemDetailScreen.js](../src/screens/ItemDetailScreen.js)、[src/screens/CartScreen.js](../src/screens/CartScreen.js)

検証: [src/hooks/__tests__/useCart.test.js](../src/hooks/__tests__/useCart.test.js)、[src/screens/__tests__/ItemDetailScreen.test.js](../src/screens/__tests__/ItemDetailScreen.test.js)、[src/screens/__tests__/CartScreen.test.js](../src/screens/__tests__/CartScreen.test.js)、[functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)

## [#9](https://github.com/jinxin4869/order_app/issues/9) メニュー一括翻訳にもDeepL Secretを明示的にバインドする

ブランチ: `fix/9-bind-translation-secret`。判定: 実装・ローカル検証で達成。

- [x] 一括翻訳に必要なSecretをバインドする。
- [x] 設定不足と翻訳API失敗を検出し、正常完了として不完全な訳を保存しない。
- [x] Secretの値を使わず、関数定義のオプションと失敗時挙動をテストする。

単発・一括の両方にDeepL Secretを明示しました。設定不足は処理前に、API失敗は確定前にエラーにします。原文の正常訳扱いと不完全なメニュー更新を防ぎ、値を使わず定義オプションと失敗経路を検証しました。

実装: [functions/src/translation/index.js](../functions/src/translation/index.js)

検証: [functions/src/__tests__/translation.test.js](../functions/src/__tests__/translation.test.js)

## [#10](https://github.com/jinxin4869/order_app/issues/10) 2文字以下の料理名を翻訳から除外しない

ブランチ: `fix/10-short-name-translations`。判定: 実装・ローカル検証で達成。

- [x] 短さだけで翻訳を省略せず、数字のみ等の明確な非翻訳対象に限定する。
- [x] 英語・中国語の短い料理名と数字のケースをテストする。
- [x] 単件・一括で共通の翻訳ロジックと結果メタデータを使う。

短さによる省略を撤廃し、数字・空白だけを明示的な非翻訳対象にします。1〜2文字の料理名について英語／中国語、数字、単発／一括の共通処理とメタデータを確認しました。

実装: [functions/src/translation/index.js](../functions/src/translation/index.js)

検証: [functions/src/__tests__/translation.test.js](../functions/src/__tests__/translation.test.js)

## [#8](https://github.com/jinxin4869/order_app/issues/8) 辞書による翻訳補正が誤訳を実際に修正するようにする

ブランチ: `fix/8-apply-dictionary-terms`。判定: 実装・ローカル検証で達成。

- [x] 原文の用語と訳文を結び付ける実効性のある補正方式を設計する。
- [x] 誤訳・未訳・複合語・英語と中国語の回帰テストを追加する。
- [x] 辞書が実際に適用された場合のmethodと、通常翻訳のmethodを区別する。
- [x] フォールバックで部分的に日本語が残る場合の表示も決める。

原文の辞書語を文字位置で特定し、長い複合語を優先してXML保護した訳語をDeepLへ渡します。英語／中国語、誤訳・未訳・保護タグ欠落・複合語を合成応答で検証しました。適用時だけhybrid、部分的な参考訳はpartialとして識別します。実APIの翻訳品質は未評価です。

実装: [functions/src/translation/index.js](../functions/src/translation/index.js)、[functions/src/morphological/synonyms.js](../functions/src/morphological/synonyms.js)、[docs/translation_contract.md](../docs/translation_contract.md)

検証: [functions/src/__tests__/translation.test.js](../functions/src/__tests__/translation.test.js)、[functions/src/__tests__/synonyms.test.js](../functions/src/__tests__/synonyms.test.js)、[src/utils/__tests__/translationDisplay.test.js](../src/utils/__tests__/translationDisplay.test.js)

## [#18](https://github.com/jinxin4869/order_app/issues/18) 翻訳比較モードで辞書なし結果への辞書あり混入を防ぐ

ブランチ: `fix/18-isolate-translation-modes`。判定: 実装・ローカル検証で達成。

- [x] 辞書なし生成に失敗した結果へ辞書あり訳を保存しない。
- [x] 未生成・失敗を識別し、比較不可または代替表示と分かるUIにする。
- [x] カテゴリ・料理名・説明に適用モードと生成状態をそろえる。
- [x] 両モードのキャッシュ・生成・表示の分離をテストする。

両モードの生成・キャッシュ・メニュー返却・表示を分離し、辞書なしへの辞書ありフォールバックを防ぎます。カテゴリ・名前・説明の生成状態をそろえ、未生成／失敗／旧データ／部分訳を識別します。再レビューで詳細→カート時のメタデータ欠落を修正し、実フックを使う画面遷移とブラウザで検証しました。

実装: [functions/src/translation/index.js](../functions/src/translation/index.js)、[functions/src/menu/index.js](../functions/src/menu/index.js)、[src/utils/translationDisplay.js](../src/utils/translationDisplay.js)、[src/screens/ItemDetailScreen.js](../src/screens/ItemDetailScreen.js)、[src/hooks/useCart.js](../src/hooks/useCart.js)

検証: [functions/src/__tests__/translation.test.js](../functions/src/__tests__/translation.test.js)、[src/utils/__tests__/translationDisplay.test.js](../src/utils/__tests__/translationDisplay.test.js)、[src/screens/__tests__/cartTranslationFlow.test.js](../src/screens/__tests__/cartTranslationFlow.test.js)、[test/web.smoke.cjs](../test/web.smoke.cjs)

## [#19](https://github.com/jinxin4869/order_app/issues/19) 店舗スタッフ向けの注文受付・状態更新画面を実装する

ブランチ: `feat/19-staff-order-console`。判定: 実装・ローカル検証で達成。

- [x] スタッフ認証と所属店舗の注文一覧／詳細を用意する。
- [x] 新規注文の確認と、適切な状態遷移を操作できるようにする。
- [x] 更新競合時に古い状態で上書きせず、再取得・再確認する。
- [x] スタッフの権限と一覧取得経路を保護する。
- [x] 会計・POSは本Issueの実装範囲に含めず、連携方針が決まった後に別途扱う。

メール／パスワード認証と管理者付与Claimsで自店舗の一覧・詳細を取得し、新着を15秒ごとに確認します。有効な状態遷移だけを許可し、expectedStatusとトランザクションで競合上書きを拒否します。競合後の再取得・再選択、権限拒否、ページ送りとログアウトを確認しました。会計・POSは含みません。

実装: [src/services/staffAuth.js](../src/services/staffAuth.js)、[src/screens/StaffScreen.js](../src/screens/StaffScreen.js)、[functions/src/orders/index.js](../functions/src/orders/index.js)、[functions/src/utils/orderStatus.js](../functions/src/utils/orderStatus.js)、[docs/staff_access.md](../docs/staff_access.md)

検証: [src/services/__tests__/staffAuth.test.js](../src/services/__tests__/staffAuth.test.js)、[src/screens/__tests__/StaffScreen.test.js](../src/screens/__tests__/StaffScreen.test.js)、[functions/src/__tests__/orders.test.js](../functions/src/__tests__/orders.test.js)、[test/firestore.rules.test.cjs](../test/firestore.rules.test.cjs)、[test/web.smoke.cjs](../test/web.smoke.cjs)

## [#14](https://github.com/jinxin4869/order_app/issues/14) メニューのカテゴリ切替で全メニューを再取得しない

ブランチ: `fix/14-menu-fetch-lifecycle`。判定: 実装・ローカル検証で達成。

- [x] 取得処理をカテゴリ選択の状態から切り離す。
- [x] 初回表示・明示的な更新・必要な店舗変更だけで取得する。
- [x] カテゴリが削除された場合の選択状態も補正する。
- [x] タブ切替でAPI呼び出し回数が増えないことをテストする。

店舗単位の初回表示・明示更新に取得を限定し、カテゴリ／言語／モードはローカル切替です。削除カテゴリの選択補正、新店舗への切替、古い応答の無視、切替時のAPI呼出回数を確認しました。

実装: [src/screens/MenuScreen.js](../src/screens/MenuScreen.js)

検証: [src/screens/__tests__/MenuScreen.test.js](../src/screens/__tests__/MenuScreen.test.js)、[test/web.smoke.cjs](../test/web.smoke.cjs)

## [#17](https://github.com/jinxin4869/order_app/issues/17) READMEの初期構築・テスト・データ投入手順を現行実装に合わせる

ブランチ: `chore/17-reproducible-setup`。判定: 実装・ローカル検証で達成。

- [x] Node・Functions・Secret設定の手順を一致させる。
- [x] ルートテストとFunctionsテストの違い、両方の実行方法を明記する。
- [x] 必要なscriptsのソースと説明を追跡する際は機密ファイルを除外する。
- [x] 壊れた内部リンクと、古いQR・スキャナーの説明を修正する。
- [x] クリーンクローン＋エミュレーター等の非本番環境で手順を確認する。

Node22、Functions、Secretとスタッフ設定、両方のテスト範囲をREADMEに統一しました。合成データseedだけを追跡し、旧未追跡スクリプトや実データを前提にしません。内部リンク・QR説明を修正し、クリーンクローンで依存インストール、エミュレーターとWeb手順を確認しました。

実装: [README.md](../README.md)、[docs/TESTING.md](../docs/TESTING.md)、[docs/demo_setup.md](../docs/demo_setup.md)、[scripts/seed-demo.cjs](../scripts/seed-demo.cjs)、[config/firebase.env.example](../config/firebase.env.example)、[docs/development_environment.md](../docs/development_environment.md)、[docs/qr_code_design.md](../docs/qr_code_design.md)

検証: [test/run-rules.cjs](../test/run-rules.cjs)、[test/build-web.cjs](../test/build-web.cjs)、[docs/verification_results.md](../docs/verification_results.md)

## 対象外の未対応課題と確認限界

[#20](https://github.com/jinxin4869/order_app/issues/20)は追加の依存ライブラリ更新課題で、今回pushする19本の実装には含めません。未達のまま残します。実店舗公開前に対応が必要です。

本番のFirebase・実アカウント・実DeepL・実データには接続していません。実際の翻訳品質・公開URL・実端末・店舗運用は公開前の確認として残ります。機密ファイルの内容は参照していません。

各検証のコマンドと結果は[検証記録](verification_results.md)を参照してください。Issueはmainへのマージまでオープンのままです。
