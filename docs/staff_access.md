# スタッフの認証・店舗権限

管理APIはFirebase Authenticationのログインと、管理者が付与したCustom Claimsを要求します。

```json
{ "role": "staff", "restaurantId": "restaurant-example" }
```

`restaurantId`は所属店舗のFirestoreドキュメントIDです。英数字・`_`・`-`の1〜128文字を使用します。
クライアントから渡されたロールや所属店舗を権限の根拠にしません。

- `updateOrderStatus`は対象注文の`restaurant_id`と所属店舗を照合します。
- `batchTranslateMenu`は対象メニューの店舗と所属店舗を照合します。
- 未ログインは`unauthenticated`、権限不足・他店舗操作は`permission-denied`を返します。
- お客様の注文作成はログイン不要ですが、Firestoreへの直接書き込みは禁止します。

Claimsの付与・変更は信頼できる管理者環境のAdmin SDKで行います。スタッフ本人にはClaimsを更新する権限を付与しません。
Claims変更後はIDトークンの更新が必要です。即時のアクセス停止が必要な場合は、アカウントの無効化とトークンの失効も行ってください。
認証情報や秘密鍵をリポジトリへ保存しないでください。
