# 対応順とブランチ構成

基点はレビュー時の`main`（`8ec219ff060fbd3100dfee3d6b3efcf182c7930e`）です。`main`を直接変更せず、独立した課題は分岐、依存する課題は前提の上に積みました。

| 順  | Issue                                                    | ブランチ                            | 前提ブランチ                                                     |
| --- | -------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| 1   | [#16](https://github.com/jinxin4869/order_app/issues/16) | `fix/16-ignore-sensitive-files`     | `main`                                                           |
| 2   | [#15](https://github.com/jinxin4869/order_app/issues/15) | `chore/15-test-and-ci`              | `main`                                                           |
| 3   | [#6](https://github.com/jinxin4869/order_app/issues/6)   | `fix/6-web-confirmations`           | `chore/15-test-and-ci`                                           |
| 4   | [#7](https://github.com/jinxin4869/order_app/issues/7)   | `feat/7-qr-web-entry`               | `fix/6-web-confirmations`                                        |
| 5   | [#2](https://github.com/jinxin4869/order_app/issues/2)   | `fix/2-firestore-order-writes`      | `chore/15-test-and-ci`                                           |
| 6   | [#1](https://github.com/jinxin4869/order_app/issues/1)   | `fix/1-staff-api-permissions`       | `fix/2-firestore-order-writes`                                   |
| 7   | [#11](https://github.com/jinxin4869/order_app/issues/11) | `fix/11-order-input-contract`       | `fix/1-staff-api-permissions`                                    |
| 8   | [#3](https://github.com/jinxin4869/order_app/issues/3)   | `fix/3-validate-menu-prices`        | `fix/11-order-input-contract`                                    |
| 9   | [#4](https://github.com/jinxin4869/order_app/issues/4)   | `fix/4-idempotent-order-creation`   | `fix/3-validate-menu-prices`                                     |
| 10  | [#5](https://github.com/jinxin4869/order_app/issues/5)   | `fix/5-transactional-order-numbers` | `fix/4-idempotent-order-creation`                                |
| 11  | [#12](https://github.com/jinxin4869/order_app/issues/12) | `fix/12-scope-cart-to-table`        | `fix/5-transactional-order-numbers`, `feat/7-qr-web-entry`       |
| 12  | [#13](https://github.com/jinxin4869/order_app/issues/13) | `fix/13-cart-quantity-limit`        | `fix/12-scope-cart-to-table`                                     |
| 13  | [#9](https://github.com/jinxin4869/order_app/issues/9)   | `fix/9-bind-translation-secret`     | `fix/1-staff-api-permissions`                                    |
| 14  | [#10](https://github.com/jinxin4869/order_app/issues/10) | `fix/10-short-name-translations`    | `fix/9-bind-translation-secret`                                  |
| 15  | [#8](https://github.com/jinxin4869/order_app/issues/8)   | `fix/8-apply-dictionary-terms`      | `fix/10-short-name-translations`                                 |
| 16  | [#18](https://github.com/jinxin4869/order_app/issues/18) | `fix/18-isolate-translation-modes`  | `fix/8-apply-dictionary-terms`                                   |
| 17  | [#19](https://github.com/jinxin4869/order_app/issues/19) | `feat/19-staff-order-console`       | `fix/18-isolate-translation-modes`, `fix/13-cart-quantity-limit` |
| 18  | [#14](https://github.com/jinxin4869/order_app/issues/14) | `fix/14-menu-fetch-lifecycle`       | `feat/19-staff-order-console`                                    |
| 19  | [#17](https://github.com/jinxin4869/order_app/issues/17) | `chore/17-reproducible-setup`       | `fix/14-menu-fetch-lifecycle`, `fix/16-ignore-sensitive-files`   |

注文・QR・翻訳の系統を#19で統合し、#17で機密ファイル除外も統合しています。`chore/17-reproducible-setup`が全変更を含む確認用の先端です。これは作成時の分岐構成です。その後#21・#22がmainへ、#23・#26・#39が各前提ブランチへマージされました。最新の先端は `fix/14-menu-fetch-lifecycle`（PR #38）です。

[現在のPR一覧と残り14本のマージ順](pull_requests.md)を参照してください。残りのPRはmain向けに修正し、#28・#36で系統間の競合を事前解消しました。エージェントによるGitHub上のマージ・デプロイ・本番データ投入は実施していません。ブランチの公開先は[GitHubのブランチ一覧](https://github.com/jinxin4869/order_app/branches)です。検証手順は[テストガイド](TESTING.md)、仕様上の制限は[README](../README.md)を参照してください。

最終統合ブランチでは、画像レビューに基づくカテゴリ領域の高さ・翻訳状態の表示・文字コントラストの修正も行っています。確認範囲は[UIレビュー記録](ui_review.md)を参照してください。

追加監査で見つかったFunctionsの依存ライブラリの脆弱性は[追加課題 #20](https://github.com/jinxin4869/order_app/issues/20)に登録しました。これは既存19件とは別の未対応課題で、実店舗公開前に更新と互換性の検証が必要です。

実行結果と残る確認は[検証記録](verification_results.md)にまとめています。

push前に既存19件・73項目の完了条件を再レビューしました。[完了条件レビュー](issue_acceptance_review.md)に根拠と再レビューで修正した内容を記録しています。
