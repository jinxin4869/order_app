# テーブルのQRトークン

テーブルに貼るQRコードに、テーブルごとのランダムなトークンを入れます。サーバーは、QRの検証と注文の作成のときにトークンを照合し、QRの内容をそのテーブルの正当な入口として扱います。

## QRの形式

| 形式                           | 例                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Web URL（推奨）                | `https://<host>/order?restaurant=<店舗ID>&table=<テーブルID>&token=<トークン>` |
| 文字列（アプリ内スキャナー用） | `<店舗ID>/<テーブルID>/<トークン>`                                             |

- トークンは英数字・`_`・`-`の16〜128文字です。発行スクリプトは144ビットの乱数（24文字）を作ります。
- トークンのない形式（`/order?restaurant=...&table=...`、`<店舗ID>/<テーブルID>`）も、強制を有効にするまではそのまま使えます。
- 形式が不正なトークン（短すぎる、使えない文字、`token`が複数）は、強制の有無に関係なく無効なQRとして扱います。
- お客様の画面は、読み取ったトークンを注文までの間持ち回り、`createOrder`に`tableToken`として送ります。Webでは再読み込みに備えてURLにも残します。

## 保存

- サーバーは、トークンのSHA-256ハッシュだけを`restaurants/{restaurantId}/table_secrets/{tableId}`（`token_hash`、`rotated_at`）に保存します。トークンそのものは保存しません。
- `table_secrets`はクライアントから読み書きできません（Firestoreルールで拒否）。公開で読めるテーブルの文書（`tables/{tableId}`）には、トークンもハッシュも置きません。
- 照合はハッシュの比較（`timingSafeEqual`）で行います。

## 照合と強制のスイッチ

`functions/.env`の`ENFORCE_TABLE_TOKEN=true`のときだけ照合します。

| 強制         | QRの検証（`validateQRCode`）                           | 注文（`createOrder`）                                            |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------- |
| オフ（既定） | トークンを照合しない。既存のQRが使える                 | トークンを照合しない                                             |
| オン         | トークンがない・違う・未発行のテーブルは`valid: false` | `failed-precondition`（`details.reason: "table_token_invalid"`） |

- 受付済みの同じ`requestId`の再送は、トークンを再発行したあとでも元の注文結果を返します（照合より前に再送を判定します）。
- 拒否されたお客様の画面は「テーブルのQRコードを読み取り直すか、スタッフへお声がけください」と案内します。

## 発行と再発行

管理者が、信頼できるAdmin SDKの環境で`scripts/issue-table-tokens.cjs`を実行します。

```bash
# エミュレーターでの確認（npm run test:rules の中でも実行しています）
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/issue-table-tokens.cjs \
  --project demo-order-app --restaurant rest-test --origin https://example.web.app --out table-tokens.csv

# 本番（Firebaseの権限が必要。--yes がないと実行しません）
node scripts/issue-table-tokens.cjs --project <project-id> --restaurant <店舗ID> \
  --origin https://<host> --out table-tokens.csv --yes [--tables table-01,table-02]
```

- `--tables`を省略すると、店舗のすべてのテーブルに発行します。
- 出力のCSV（`table_id,table_number,qr_url`）にはトークンが含まれます。権限を絞ったファイル（0600）として書き出します。コミットせず（`.gitignore`で`*tokens*.csv`を除外しています）、印刷が終わったら削除してください。
- もう一度実行すると、そのテーブルのトークンは新しいものに置き換わります（再発行）。強制が有効な場合、古いQRはその時点で使えなくなります。QRを紛失したときや、外部に出たおそれがあるときに再発行します。

## 導入の手順

1. 本番で発行スクリプトを実行し、CSVのURLから全テーブルのQRコードを作って印刷します。
2. すべてのテーブルのQRを貼り替えます。貼り替えの途中も、強制がオフなので古いQRも新しいQRも使えます。
3. 新しいQRから注文できることを確認します。
4. `ENFORCE_TABLE_TOKEN=true`にしてFunctionsを再デプロイします。
5. 古いQRで「このQRコードは使えません」と表示されることを確認します。

戻すときは`ENFORCE_TABLE_TOKEN`を削除するか`false`にして、Functionsを再デプロイします。
