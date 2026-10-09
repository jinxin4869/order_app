# ローカルの合成デモデータ

この手順は`demo-order-app`のFirestore・Authenticationエミュレーター専用です。実店舗のデータや認証情報は使用しません。

```bash
npm ci
npm ci --prefix functions
npx firebase emulators:start --project demo-order-app --config firebase.demo.json --only firestore,auth
```

別ターミナルで次を実行します。

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/seed-demo.cjs --verify
```

`rest-test / table-test`の店舗・テーブル、カテゴリ1件、料理1件、辞書1件、スタッフ1人を作成します。デモ用スタッフは`staff@example.invalid / demo-only-password`です。これはエミュレーターだけの合成アカウントで、実環境には使用しません。同じIDへの再投入はデモのマスターとスタッフClaimsを更新します。任意の非ローカル接続先を渡した場合は書き込み前に拒否します。

自動で起動・投入・API取得・Claimsを確認して終了する方法は`npm run test:demo`です。エミュレーター終了後はデータを保持しません。

この手順はサーバー側のデータと権限の再現用です。通常の`npm run web`は自分のFirebase設定へ接続します。ローカルのブラウザ操作確認には、環境ファイル不要で合成API応答だけを使う`npm run test:web`を使ってください。エミュレーターのアカウントでクラウド環境へログインすることはできません。
