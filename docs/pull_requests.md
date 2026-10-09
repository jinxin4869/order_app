# PR一覧とレビュー順

既存19件のPRを作成しました。独立した2件はmain向け、他は前提ブランチをbaseにしたスタック構成です。各PR本文に変更内容・検証・前提PRを記載しています。mainへのマージ・デプロイは行っていません。

| 順 | Issue | PR | base | 追加の前提PR |
| --- | --- | --- | --- | --- |
| 1 | [#16](https://github.com/jinxin4869/order_app/issues/16) | [#21](https://github.com/jinxin4869/order_app/pull/21) | `main` | — |
| 2 | [#15](https://github.com/jinxin4869/order_app/issues/15) | [#22](https://github.com/jinxin4869/order_app/pull/22) | `main` | — |
| 3 | [#6](https://github.com/jinxin4869/order_app/issues/6) | [#23](https://github.com/jinxin4869/order_app/pull/23) | `chore/15-test-and-ci` | — |
| 4 | [#7](https://github.com/jinxin4869/order_app/issues/7) | [#24](https://github.com/jinxin4869/order_app/pull/24) | `fix/6-web-confirmations` | — |
| 5 | [#2](https://github.com/jinxin4869/order_app/issues/2) | [#25](https://github.com/jinxin4869/order_app/pull/25) | `chore/15-test-and-ci` | — |
| 6 | [#1](https://github.com/jinxin4869/order_app/issues/1) | [#26](https://github.com/jinxin4869/order_app/pull/26) | `fix/2-firestore-order-writes` | — |
| 7 | [#11](https://github.com/jinxin4869/order_app/issues/11) | [#27](https://github.com/jinxin4869/order_app/pull/27) | `fix/1-staff-api-permissions` | — |
| 8 | [#3](https://github.com/jinxin4869/order_app/issues/3) | [#28](https://github.com/jinxin4869/order_app/pull/28) | `fix/11-order-input-contract` | — |
| 9 | [#4](https://github.com/jinxin4869/order_app/issues/4) | [#29](https://github.com/jinxin4869/order_app/pull/29) | `fix/3-validate-menu-prices` | — |
| 10 | [#5](https://github.com/jinxin4869/order_app/issues/5) | [#30](https://github.com/jinxin4869/order_app/pull/30) | `fix/4-idempotent-order-creation` | — |
| 11 | [#12](https://github.com/jinxin4869/order_app/issues/12) | [#31](https://github.com/jinxin4869/order_app/pull/31) | `fix/5-transactional-order-numbers` | [#24](https://github.com/jinxin4869/order_app/pull/24) |
| 12 | [#13](https://github.com/jinxin4869/order_app/issues/13) | [#32](https://github.com/jinxin4869/order_app/pull/32) | `fix/12-scope-cart-to-table` | — |
| 13 | [#9](https://github.com/jinxin4869/order_app/issues/9) | [#33](https://github.com/jinxin4869/order_app/pull/33) | `fix/1-staff-api-permissions` | — |
| 14 | [#10](https://github.com/jinxin4869/order_app/issues/10) | [#34](https://github.com/jinxin4869/order_app/pull/34) | `fix/9-bind-translation-secret` | — |
| 15 | [#8](https://github.com/jinxin4869/order_app/issues/8) | [#35](https://github.com/jinxin4869/order_app/pull/35) | `fix/10-short-name-translations` | — |
| 16 | [#18](https://github.com/jinxin4869/order_app/issues/18) | [#36](https://github.com/jinxin4869/order_app/pull/36) | `fix/8-apply-dictionary-terms` | — |
| 17 | [#19](https://github.com/jinxin4869/order_app/issues/19) | [#37](https://github.com/jinxin4869/order_app/pull/37) | `fix/18-isolate-translation-modes` | [#32](https://github.com/jinxin4869/order_app/pull/32) |
| 18 | [#14](https://github.com/jinxin4869/order_app/issues/14) | [#38](https://github.com/jinxin4869/order_app/pull/38) | `feat/19-staff-order-console` | — |
| 19 | [#17](https://github.com/jinxin4869/order_app/issues/17) | [#39](https://github.com/jinxin4869/order_app/pull/39) | `fix/14-menu-fetch-lifecycle` | [#21](https://github.com/jinxin4869/order_app/pull/21) |

前提PRを先にmainへ反映し、後続PRのbaseをmainへ変更してから差分とCIを再確認してください。追加の前提を持つ#31・#37・#39は、現在の比較差分に別系統の前提変更も含みます。依存ブランチの削除は後続PRへの影響を確認してから行ってください。

全変更を含む先端は[PR #39](https://github.com/jinxin4869/order_app/pull/39)の `chore/17-reproducible-setup` です。最初のレビューは[PR #21](https://github.com/jinxin4869/order_app/pull/21)（機密ファイル除外）と[PR #22](https://github.com/jinxin4869/order_app/pull/22)（テスト・CI）から進められます。

[73項目の完了条件レビュー](issue_acceptance_review.md)と[検証記録](verification_results.md)はローカル検証の結果です。GitHub Actionsの実行結果は各PRのChecksで確認します。追加課題[#20](https://github.com/jinxin4869/order_app/issues/20)の依存ライブラリ更新は未対応で、PRは作成していません。
