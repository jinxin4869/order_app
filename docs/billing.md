# 課金の通知と支出上限

本番プロジェクト（`.firebaserc`の`default`）は、Cloud FunctionsとSecret Managerを使うためBlazeプランで動かしています。Blazeプランには支払いの上限がなく、無料枠を超えた分は自動で課金されます。想定外の課金に気づくための予算アラートと、Cloud Functionsを止める支出上限を設定しています。

金額や設定を変えたときは、この文書も更新してください。

## 設定値（2026-11-28時点）

| 設定                                       | 値                                                 | 上限に達したときの動作                                               |
| ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------- |
| 予算アラート（プロジェクト全体）           | 月¥100。¥50（50%）・¥90（90%）・¥100（100%）で通知 | 請求先アカウントの管理者へメールで通知するだけ。サービスは止まらない |
| 支出上限：Cloud Run Functions（Functions） | 月¥100                                             | その月の残り期間、すべてのFunctionsが止まる                          |
| 支出上限：Cloud Run（App Hosting）         | 月¥100                                             | 同上（このアプリは使っていない）                                     |
| 支出上限：Gemini Developer API（AI Logic） | 月¥100                                             | 同上（このアプリは使っていない）                                     |
| 支出上限：Agent Platform API（AI Logic）   | 月¥100                                             | 同上（このアプリは使っていない）                                     |

- 予算アラートはGoogle Cloudコンソールの「お支払い」の「予算とアラート」で、支出上限はFirebaseコンソールの「プロジェクトの設定」の「使用量と請求」の「詳細と設定」にある「サービスレベルの利用額上限」で設定しています。
- 支出上限の対象外のサービス（Firestore、Hosting、Secret Manager、Artifact Registryなど）は、予算アラートの通知だけで止まりません。
- 支出上限の判定は数分遅れて反映され、その間の超過分は課金されます。
- 支出上限は、それぞれの上限額の50%と80%でもメールで通知します。

## 通知が届いたとき

¥50の通知は、少額の課金でも届くことがあります。Google Cloudコンソールの「お支払い」の「レポート」で、どのサービスの課金かを確認してください。想定外の呼び出しが原因であれば、[App Checkと同時実行数](app_check.md)の手順でApp Checkの強制を検討します。

¥100を超えると、その月は予算アラートの通知が届かなくなります。続けて監視する場合は、Google Cloudコンソールで500%・1000%などの通知を追加します。

## Functionsの支出上限に達したとき

Functionsが止まると、メニューの表示、注文、スタッフ画面のすべてが使えなくなります。お客様とスタッフへの案内は[注文障害の検知と代替受付・復旧](incident_runbook.md)に従います。

再開する手順は次のとおりです。

1. 上限に達した原因を、「お支払い」の「レポート」で確認します。
2. Firebaseコンソールの「サービスレベルの利用額上限」で、Cloud Run Functionsの解除（Lift）を押します。
3. 状態が解除（Lifted）になるまで待ちます。再開まで最大1時間かかります。
4. 解除した上限は、その月の残り期間は制限なしになり、翌月1日に元の金額に戻ります。上限額を上げる場合は、解除してから金額を変えて保存します。新しい金額は、その月にすでに使った額より大きくする必要があります。

評価実験の日程が決まったら、実施期間中に上限に達しないかを事前に確認してください。

## Artifact Registry

Functionsのデプロイのたびに、コンテナイメージが`gcf-artifacts`リポジトリ（`asia-northeast1`）に保存されます。無料枠は500MBです。

| 項目         | 値（2026-11-27のデプロイ時に確認）                                  |
| ------------ | ------------------------------------------------------------------- |
| 保存量       | 約170MB（`sizeBytes: 170321564`）                                   |
| 削除ポリシー | `firebase-functions-cleanup`：1日（`86400s`）より古いイメージを削除 |

確認する方法は2つあります。

- Google Cloudコンソールの「Artifact Registry」の「リポジトリ」で、`gcf-artifacts`の「サイズ」と「クリーンアップ ポリシー」を見ます。
- `npx firebase deploy --only functions --debug`の出力で、`repositories/gcf-artifacts`へのGETの応答に`sizeBytes`と`cleanupPolicies`が含まれます。

削除ポリシーがない場合は、`npx firebase functions:artifacts:setpolicy --project <project-id>`で設定します。

## 参考

- [Firebaseの料金](https://firebase.google.com/pricing)
- [Avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)
- [Set up spend caps for Firebase services](https://firebase.google.com/docs/projects/billing/spend-caps)
