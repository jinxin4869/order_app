# App Check と同時実行数の上限

認証不要のCallable（`createOrder`、`getOrderRequest`、`listVisitOrders`、`validateQRCode`、`getMenuWithTranslation`、`getMenuAvailability`）は、誰でもインターネットから呼べます。第三者による大量呼び出しで課金が増えないよう、次の2つを設けています。

- **同時インスタンス数の上限**: `functions/src/index.js`の`setGlobalOptions({ maxInstances: 10 })`で、全関数に常に適用します。
- **App Check**: 正規のWebアプリからの呼び出しだけを受け付けます。初期状態では無効です。

## App Check を有効にする手順

App Checkを強制すると、トークンを持たないクライアントからの呼び出しはすべて`failed-precondition / app_check_required`で拒否されます。必ず次の順で進めてください。

1. FirebaseコンソールのApp Checkで、WebアプリにreCAPTCHA Enterpriseを登録し、サイトキーを取得します。
2. フロントの`.env`に`FIREBASE_APPCHECK_SITE_KEY=<サイトキー>`を設定し、Webをビルドしてデプロイします。`npm run build:web`が出力したバンドルにキーが入っていることを検査します。検査に失敗した場合は設定を直してビルドし直してください。サイトキーは公開値です。
3. コンソールのApp Checkの指標で、正規のリクエストに有効なトークンが付いていることを確認します。
4. `functions/.env`に`ENFORCE_APP_CHECK=true`を設定し、Functionsをデプロイします。

`ENFORCE_APP_CHECK`は値が`true`のときだけ有効です。未設定・`false`・その他の値では強制しません。無効なトークンはFirebaseのCallable基盤が常に拒否するため、この設定が制御するのは「トークンなし」の呼び出しだけです。

Functionsのデプロイ前のチェックは、`ENFORCE_APP_CHECK`が`true`か`false`で明示されていないとデプロイを中止します。強制しない間も`ENFORCE_APP_CHECK=false`と書いてください。次のデプロイで使われる値は`node functions/scripts/check-deploy-env.js <project-id>`で確認できます（[README「公開する場合」](../README.md#公開する場合)）。

ネイティブアプリ（Android/iOS）はこの設定ではApp Checkトークンを送りません。ネイティブ版を本番で使う場合は、強制を有効にする前にネイティブ用のプロバイダーを導入してください。

Hostingのデプロイ直前にも同じ検査を実行します。App Checkを使わない環境では、公開用ビルドとHostingのデプロイの両方で`ORDER_APP_ALLOW_NO_APP_CHECK=1`を指定します。ローカル起動・Webテスト・エミュレーターは従来のコマンドを使います。

## 戻し方

拒否が多発した場合は、`functions/.env`の`ENFORCE_APP_CHECK`を`false`にして、Functionsを再デプロイします。フロントの再ビルドは不要です。
