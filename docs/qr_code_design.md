# QRコード設計書

## 目的

本ドキュメントでは、テーブル認識に使用するQRコードシステムの設計を定義します。顧客が自身のスマートフォンでQRコードを読み取り、即座に注文アプリにアクセスできる仕組みを実現します。

---

## 1. QRコードシステム概要

### 1.1 システムの役割

| 役割 | 説明 | メリット |
|------|------|---------|
| **テーブル識別** | どのテーブルからの注文かを特定 | 注文の配膳先を明確化 |
| **アプリ起動** | QRコード読み取りでアプリを起動 | アプリインストール不要 |
| **店舗識別** | 複数店舗対応時の店舗特定 | 将来的な拡張性 |
| **セッション管理** | テーブルごとの注文セッション管理 | 注文履歴の追跡 |

### 1.2 利用フロー

```
1. 顧客がテーブルに着席
   ↓
2. テーブル上のQRコードをスマホで読み取り
   ↓
3. Expo Goアプリ / Webアプリが起動
   ↓
4. 店舗ID・テーブルIDが自動認識
   ↓
5. メニュー画面表示（言語選択可能）
   ↓
6. 注文実行
   ↓
7. 注文情報に店舗ID・テーブルIDが自動付与
```

---

## 2. QRコードデータフォーマット

### 2.1 採用フォーマット

**推奨**: 店舗ID + テーブルID の複合形式

#### フォーマット仕様

```
{restaurantId}/{tableId}

例:
restaurant_01/table_01
restaurant_01/table_02
restaurant_02/table_01
```

#### 理由

| 理由 | 説明 |
|------|------|
| **拡張性** | 複数店舗対応が容易 |
| **一意性** | グローバルに一意なIDを保証 |
| **シンプル性** | パース処理が簡単 |
| **可読性** | デバッグ時に内容を理解しやすい |

### 2.2 代替案との比較

| 方式 | フォーマット例 | メリット | デメリット | 採用 |
|------|-------------|---------|-----------|------|
| **テーブルIDのみ** | `table_01` | シンプル | 複数店舗に対応不可 | × |
| **店舗+テーブル（採用）** | `restaurant_01/table_01` | バランスが良い | やや冗長 | ○ |
| **URL形式** | `https://app.com?r=01&t=01` | Webアプリで直接起動 | QRが大きくなる | △ |
| **短縮URL** | `https://short.ly/abc123` | QRが小さい | リダイレクト遅延 | × |

### 2.3 完全なURL形式（Webアプリ用）

開発段階ではシンプルな文字列、本番ではURL形式も検討。

```
https://qr-order-app.web.app/order?restaurant=restaurant_01&table=table_01
```

---

## 3. QRコード生成仕様

### 3.1 QRコード技術仕様

| 項目 | 仕様 | 理由 |
|------|------|------|
| **バージョン** | Version 2-3 | データ量に応じた最小サイズ |
| **誤り訂正レベル** | M（15%復元） | バランスが良い |
| **データ型** | 英数字モード | データ量削減 |
| **サイズ** | 5cm × 5cm | 視認性と読み取りやすさ |
| **マージン** | 4モジュール | QRコード規格推奨値 |
| **色** | 黒（前景）/ 白（背景） | 標準色、読み取り確実 |

### 3.2 誤り訂正レベルの比較

| レベル | 復元率 | データ容量 | 推奨用途 |
|-------|-------|-----------|---------|
| L | 7% | 最大 | クリーンな環境 |
| **M** | **15%** | **中** | **一般用途（採用）** |
| Q | 25% | 小 | 汚れやすい環境 |
| H | 30% | 最小 | ロゴ埋め込み時 |

### 3.3 生成ツール

#### Node.js（サーバーサイド生成）

```javascript
const QRCode = require('qrcode');

const generateQRCode = async (restaurantId, tableId) => {
  const data = `${restaurantId}/${tableId}`;

  const options = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300, // 300px = 約5cm (印刷時150dpi想定)
    margin: 4,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };

  try {
    // PNG画像として生成
    const qrCodeDataURL = await QRCode.toDataURL(data, options);
    return qrCodeDataURL;

    // またはファイルとして保存
    // await QRCode.toFile(`qr_${restaurantId}_${tableId}.png`, data, options);

  } catch (error) {
    console.error('QR Code generation error:', error);
    throw error;
  }
};

// 使用例
generateQRCode('restaurant_01', 'table_01');
```

#### オンラインツール（手動生成）

| ツール | URL | 特徴 |
|-------|-----|------|
| **QR Code Generator** | https://www.qr-code-generator.com | 無料、カスタマイズ可 |
| **QR Stuff** | https://www.qrstuff.com | 多機能 |
| **Google Charts API** | https://chart.googleapis.com/chart | API経由生成 |

---

## 4. QRコード読み取り実装

### 4.1 Expo（React Native）での実装

#### 必要なパッケージ

```bash
npx expo install expo-barcode-scanner
```

#### 実装例

```javascript
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

const QRScannerScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);

    // QRコードデータをパース
    const parsed = parseQRCode(data);

    if (parsed) {
      // メニュー画面に遷移
      navigation.navigate('Menu', {
        restaurantId: parsed.restaurantId,
        tableId: parsed.tableId
      });
    } else {
      alert('無効なQRコードです');
      setScanned(false);
    }
  };

  const parseQRCode = (data) => {
    try {
      // フォーマット: restaurant_01/table_01
      const parts = data.split('/');

      if (parts.length !== 2) {
        return null;
      }

      return {
        restaurantId: parts[0],
        tableId: parts[1]
      };
    } catch (error) {
      console.error('QR parse error:', error);
      return null;
    }
  };

  if (hasPermission === null) {
    return <Text>カメラ権限をリクエスト中...</Text>;
  }

  if (hasPermission === false) {
    return <Text>カメラへのアクセスが拒否されました</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      {scanned && (
        <Button title="再スキャン" onPress={() => setScanned(false)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
});

export default QRScannerScreen;
```

### 4.2 URL形式の場合（ディープリンク）

```javascript
import * as Linking from 'expo-linking';

const parseDeepLink = (url) => {
  // URL例: https://app.com/order?restaurant=restaurant_01&table=table_01
  const { queryParams } = Linking.parse(url);

  return {
    restaurantId: queryParams.restaurant,
    tableId: queryParams.table
  };
};

// アプリ起動時のURL処理
useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const parsed = parseDeepLink(url);
    // 処理...
  });

  return () => subscription.remove();
}, []);
```

---

## 5. QRコード配置・印刷

### 5.1 印刷仕様

| 項目 | 仕様 |
|------|------|
| **用紙サイズ** | A5 または A6 |
| **印刷方法** | レーザープリンター推奨 |
| **解像度** | 300dpi以上 |
| **ラミネート** | 推奨（耐水性・耐久性向上） |
| **スタンド** | アクリル製カードスタンド |

### 5.2 QRコードカードデザイン例

```
┌─────────────────────────────┐
│                             │
│     居酒屋さくら              │
│     Izakaya Sakura          │
│                             │
│    ┌─────────────┐           │
│    │             │           │
│    │  QRコード    │           │
│    │             │           │
│    └─────────────┘           │
│                             │
│   スマホでスキャンして         │
│   メニューを表示！            │
│                             │
│   Scan to view menu         │
│   扫描查看菜单                │
│                             │
│   Table 1                   │
│                             │
└─────────────────────────────┘
```

### 5.3 カード作成手順

1. **デザイン作成**: Canva / Figma 等で作成
2. **QRコード埋め込み**: 生成したQRコードを配置
3. **PDF出力**: 印刷用PDF形式で保存
4. **印刷**: A5サイズで印刷
5. **ラミネート**: 100μmフィルムでラミネート加工
6. **配置**: テーブル上のカードスタンドに設置

---

## 6. データベース連携

### 6.1 テーブル情報の管理

QRコード生成時に、Firestoreの`tables`コレクションにデータを登録。

```javascript
const createTable = async (restaurantId, tableNumber) => {
  const tableId = `table_${String(tableNumber).padStart(2, '0')}`;
  const qrCode = `${restaurantId}/${tableId}`;

  await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('tables')
    .doc(tableId)
    .set({
      table_number: tableNumber.toString(),
      qr_code: qrCode,
      capacity: 4, // デフォルト
      status: 'available',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

  // QRコード画像生成
  await generateQRCode(restaurantId, tableId);

  console.log(`Table ${tableNumber} created with QR: ${qrCode}`);
};

// 10テーブル作成
for (let i = 1; i <= 10; i++) {
  await createTable('restaurant_01', i);
}
```

### 6.2 QRコード検証

アプリ側でQRコード読み取り後、Firestoreで存在確認。

```javascript
const validateQRCode = async (restaurantId, tableId) => {
  try {
    const tableDoc = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('tables')
      .doc(tableId)
      .get();

    if (!tableDoc.exists) {
      return { valid: false, error: 'テーブルが見つかりません' };
    }

    const tableData = tableDoc.data();

    if (tableData.status === 'unavailable') {
      return { valid: false, error: 'このテーブルは現在利用できません' };
    }

    return {
      valid: true,
      table: tableData
    };

  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'エラーが発生しました' };
  }
};
```

---

## 7. セキュリティ考慮事項

### 7.1 潜在的なリスク

| リスク | 説明 | 対策 |
|-------|------|------|
| **QRコード偽装** | 悪意のあるQRに差し替え | Firestore検証必須 |
| **他店舗への誤誘導** | QRコードの誤使用 | restaurantID検証 |
| **不正注文** | 他テーブルのQRで注文 | 影響小（本人負担） |

### 7.2 対策

#### 7.2.1 Firestore検証の実装

```javascript
const secureQRValidation = async (qrData) => {
  // 1. フォーマット検証
  if (!isValidFormat(qrData)) {
    return { valid: false, error: 'Invalid QR format' };
  }

  // 2. データベース存在確認
  const validation = await validateQRCode(restaurantId, tableId);
  if (!validation.valid) {
    return validation;
  }

  // 3. タイムスタンプチェック（オプション）
  // QRコード生成から一定期間経過したら無効化
  const createdAt = validation.table.created_at.toDate();
  const now = new Date();
  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

  if (daysSinceCreation > 365) {
    return { valid: false, error: 'QRコードの有効期限が切れています' };
  }

  return validation;
};
```

#### 7.2.2 HTTPS強制（URL形式の場合）

- すべての通信をHTTPSで暗号化
- Firebase Hostingは自動的にHTTPS対応

---

## 8. テスト計画

### 8.1 QRコード読み取りテスト

| テストケース | 入力 | 期待結果 |
|------------|------|---------|
| **正常系** | `restaurant_01/table_01` | メニュー画面に遷移 |
| **不正フォーマット** | `invalid_format` | エラーメッセージ表示 |
| **存在しないテーブル** | `restaurant_01/table_99` | エラーメッセージ表示 |
| **別店舗のQR** | `restaurant_02/table_01` | 該当店舗のメニュー表示 |

### 8.2 カメラ権限テスト

| シナリオ | 期待動作 |
|---------|---------|
| **初回起動** | カメラ権限リクエスト表示 |
| **権限許可** | QRスキャナー起動 |
| **権限拒否** | エラーメッセージ + 設定画面への誘導 |

---

## 9. 運用・メンテナンス

### 9.1 QRコード更新フロー

| 更新ケース | 手順 |
|-----------|------|
| **テーブル追加** | 1. Firestoreにレコード追加<br>2. QRコード生成<br>3. カード印刷・配置 |
| **テーブル削除** | 1. Firestoreレコード削除<br>2. カード回収 |
| **QR破損** | 同じQRコードを再印刷 |

### 9.2 QRコード管理台帳

| テーブル番号 | テーブルID | QRコード文字列 | 印刷日 | 状態 |
|------------|-----------|--------------|-------|------|
| 1 | table_01 | restaurant_01/table_01 | 2024-11-20 | 稼働中 |
| 2 | table_02 | restaurant_01/table_02 | 2024-11-20 | 稼働中 |
| ... | ... | ... | ... | ... |

---

## 10. 将来の拡張

### 10.1 機能拡張案

| 機能 | 説明 | 優先度 |
|------|------|-------|
| **動的QRコード** | セッションIDを含む一時QRコード | 低 |
| **NFC対応** | QRコード + NFCタグのハイブリッド | 低 |
| **テーブル状態表示** | 空席・満席をリアルタイム表示 | 中 |
| **呼び出し機能** | QRコードからスタッフ呼び出し | 中 |

### 10.2 アナリティクス

```javascript
// QRコードスキャン回数の記録
const logQRScan = async (restaurantId, tableId) => {
  await db.collection('qr_scan_logs').add({
    restaurant_id: restaurantId,
    table_id: tableId,
    scanned_at: admin.firestore.FieldValue.serverTimestamp()
  });
};

// 統計分析
const getQRScanStats = async (restaurantId) => {
  const snapshot = await db.collection('qr_scan_logs')
    .where('restaurant_id', '==', restaurantId)
    .get();

  // テーブル別スキャン回数
  const stats = {};
  snapshot.forEach(doc => {
    const tableId = doc.data().table_id;
    stats[tableId] = (stats[tableId] || 0) + 1;
  });

  return stats;
};
```

---

## 11. 参考資料

- [QR Code Specification (ISO/IEC 18004)](https://www.iso.org/standard/62021.html)
- [Expo BarCodeScanner Documentation](https://docs.expo.dev/versions/latest/sdk/bar-code-scanner/)
- [QRコード.com（デンソーウェーブ）](https://www.qrcode.com/ja/)

---

## 更新履歴

| 日付 | 更新内容 | 担当者 |
|------|---------|--------|
| 2024-11-19 | 初版作成 | - |
