# PR一覧とマージ順

2026-10-09のマージ状況を反映しています。残り14本のマージ先はすべて `main` に変更しました。前提PRの変更も差分に含まれるため、下記の順に進めてください。

## すでにマージされたPR

- #21・#22は `main` へマージ済みです。
- #23は `chore/15-test-and-ci` へマージ済みで、変更は **#24** から `main` へ入ります。
- #26は `fix/2-firestore-order-writes` へマージ済みで、変更は **#25** から `main` へ入ります。
- #39は `fix/14-menu-fetch-lifecycle` へマージ済みで、変更は **#38** から `main` へ入ります。

## 残りの順番

| 順 | PR | 内容 | マージ先 |
| --- | --- | --- | --- |
| 1 | [#24](https://github.com/jinxin4869/order_app/pull/24) | Webの確認ダイアログ・QRからの直接アクセス | `main` |
| 2 | [#25](https://github.com/jinxin4869/order_app/pull/25) | 注文の直接書込制限・スタッフAPIの店舗権限 | `main` |
| 3 | [#27](https://github.com/jinxin4869/order_app/pull/27) | 注文入力の型・数量・備考の契約 | `main` |
| 4 | [#28](https://github.com/jinxin4869/order_app/pull/28) | メニュー価格・販売可否・営業状態の検証 | `main` |
| 5 | [#29](https://github.com/jinxin4869/order_app/pull/29) | 注文作成の冪等化・原子的な保存 | `main` |
| 6 | [#30](https://github.com/jinxin4869/order_app/pull/30) | 日本時間0時での日次注文番号採番 | `main` |
| 7 | [#31](https://github.com/jinxin4869/order_app/pull/31) | 店舗・テーブル単位のカート管理 | `main` |
| 8 | [#32](https://github.com/jinxin4869/order_app/pull/32) | 数量上限の統一 | `main` |
| 9 | [#33](https://github.com/jinxin4869/order_app/pull/33) | 翻訳APIへのSecretバインド | `main` |
| 10 | [#34](https://github.com/jinxin4869/order_app/pull/34) | 短い料理名の翻訳 | `main` |
| 11 | [#35](https://github.com/jinxin4869/order_app/pull/35) | 辞書による翻訳補正 | `main` |
| 12 | [#36](https://github.com/jinxin4869/order_app/pull/36) | 翻訳比較モードの分離 | `main` |
| 13 | [#37](https://github.com/jinxin4869/order_app/pull/37) | スタッフのメール・パスワード認証と注文管理画面 | `main` |
| 14 | [#38](https://github.com/jinxin4869/order_app/pull/38) | メニュー取得の最適化・初期構築と検証手順 | `main` |

**Create a merge commit** を使い、各PRの差分とCI成功を確認してから1本ずつマージしてください。Squash/Rebaseでは前提コミットの履歴が変わり、後続PRの差分や競合が増えるため、この構成では使用しません。依存ブランチは一連のマージが完了するまで残してください。

## 競合と検証

#28には#24のWeb/QR変更、#36には#32のカート変更を事前統合し、順次マージした際の競合を解消しています。別のローカル作業領域で現在の `main` から上記14本を順に取り込めることを確認しました。GitHub上のマージ操作は行っていません。

全19課題の変更を含む先端は [PR #38](https://github.com/jinxin4869/order_app/pull/38) です。[73項目の完了条件レビュー](issue_acceptance_review.md)と[検証記録](verification_results.md)も参照してください。追加課題[#20](https://github.com/jinxin4869/order_app/issues/20)の依存ライブラリ更新は未対応で、PRは作成していません。
