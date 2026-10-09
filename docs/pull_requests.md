# PR一覧とマージ順

2026-10-09のマージ状況を反映しています。残り11本のマージ先はすべて `main` に変更しました。前提PRの変更も差分に含まれるため、下記の順に進めてください。

## すでにマージされたPR

- #21・#22・#24・#25・#27は `main` へマージ済みです。
- #23の変更は **#24** 経由で `main` へ反映済みです。
- #26の変更は **#25** 経由で `main` へ反映済みです。
- #39は `fix/14-menu-fetch-lifecycle` へマージ済みで、変更は **#38** から `main` へ入ります。

## 残りの順番

| 順 | PR | 内容 | マージ先 |
| --- | --- | --- | --- |
| 1 | [#28](https://github.com/jinxin4869/order_app/pull/28) | メニュー価格・販売可否・営業状態の検証 | `main` |
| 2 | [#29](https://github.com/jinxin4869/order_app/pull/29) | 注文作成の冪等化・原子的な保存 | `main` |
| 3 | [#30](https://github.com/jinxin4869/order_app/pull/30) | 日本時間0時での日次注文番号採番 | `main` |
| 4 | [#31](https://github.com/jinxin4869/order_app/pull/31) | 店舗・テーブル単位のカート管理 | `main` |
| 5 | [#32](https://github.com/jinxin4869/order_app/pull/32) | 数量上限の統一 | `main` |
| 6 | [#33](https://github.com/jinxin4869/order_app/pull/33) | 翻訳APIへのSecretバインド | `main` |
| 7 | [#34](https://github.com/jinxin4869/order_app/pull/34) | 短い料理名の翻訳 | `main` |
| 8 | [#35](https://github.com/jinxin4869/order_app/pull/35) | 辞書による翻訳補正 | `main` |
| 9 | [#36](https://github.com/jinxin4869/order_app/pull/36) | 翻訳比較モードの分離 | `main` |
| 10 | [#37](https://github.com/jinxin4869/order_app/pull/37) | スタッフのメール・パスワード認証と注文管理画面 | `main` |
| 11 | [#38](https://github.com/jinxin4869/order_app/pull/38) | メニュー取得の最適化・初期構築と検証手順 | `main` |

**Create a merge commit** を使い、各PRの差分とCI成功を確認してから1本ずつマージしてください。Squash/Rebaseでは前提コミットの履歴が変わり、後続PRの差分や競合が増えるため、この構成では使用しません。依存ブランチは一連のマージが完了するまで残してください。

## 競合と検証

#28には#24のWeb/QR変更、#36には#32のカート変更を事前統合し、順次マージした際の競合を解消しています。別のローカル作業領域で現在の `main` から上記11本を順に取り込めることを確認しました。その後#24・#25・#27がmainへマージされたため、残り11本すべてに現在のmain（`0938558d74a634578940d8b32759432d86c23f38`）と直前のPRを順に取り込み直しました。各段階のファイル内容が検証済みの統合結果と一致することを確認しています。GitHub上のマージ操作は行っていません。

全19課題の変更を含む先端は [PR #38](https://github.com/jinxin4869/order_app/pull/38) です。[73項目の完了条件レビュー](issue_acceptance_review.md)と[検証記録](verification_results.md)も参照してください。追加課題[#20](https://github.com/jinxin4869/order_app/issues/20)の依存ライブラリ更新は未対応で、PRは作成していません。
