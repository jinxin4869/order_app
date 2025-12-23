# データベース設計書

## 目的

本ドキュメントでは、Firestore（NoSQLデータベース）を使用したデータベース設計の詳細を定義します。各コレクション・フィールドの仕様、制約、リレーション、セキュリティルールを明確にし、実装時の指針とします。

---

## 1. データベース概要

### 1.1 使用技術
- **データベース**: Cloud Firestore（Firebase）
- **データモデル**: NoSQL（ドキュメント指向）
- **ホスティング**: Google Cloud Platform

### 1.2 Firestoreの特徴

| 特徴 | 説明 | 本プロジェクトでの利点 |
|------|------|-------------------|
| **ドキュメント指向** | JSON形式のドキュメントで保存 | メニューデータの柔軟な管理 |
| **リアルタイム同期** | データ変更を即座に反映 | 注文ステータスのリアルタイム更新 |
| **オフライン対応** | ローカルキャッシュで動作 | ネットワーク不安定時も動作 |
| **スケーラビリティ** | 自動スケーリング | 将来的な拡張に対応 |
| **セキュリティルール** | 細かいアクセス制御 | データ保護 |

### 1.3 命名規則

| 項目 | 規則 | 例 |
|------|------|-----|
| **コレクション名** | 複数形、小文字、アンダースコア区切り | `menu_items`, `orders` |
| **ドキュメントID** | 自動生成またはUUID | `abc123xyz`, `restaurant_01` |
| **フィールド名** | 小文字、アンダースコア区切り | `name_ja`, `created_at` |
| **日付時刻** | timestamp型 | `2024-11-19T12:00:00Z` |

---

## 2. データベース構造全体図

### 2.1 コレクション階層

```
Firestore Root
│
├── /restaurants (コレクション)
│   └── /{restaurantId} (ドキュメント)
│       ├── /tables (サブコレクション)
│       │   └── /{tableId} (ドキュメント)
│       ├── /menu_categories (サブコレクション)
│       │   └── /{categoryId} (ドキュメント)
│       └── /menu_items (サブコレクション)
│           └── /{itemId} (ドキュメント)
│
├── /orders (コレクション)
│   └── /{orderId} (ドキュメント)
│
├── /dictionary (コレクション)
│   └── /{termId} (ドキュメント)
│
└── /translation_cache (コレクション)
    └── /{cacheId} (ドキュメント)
```

### 2.2 リレーション図（テキスト表現）

```
restaurants
    │
    ├─ has many ─> tables
    ├─ has many ─> menu_categories
    └─ has many ─> menu_items
        │
        └─ belongs to ─> menu_categories (category_id)

orders
    │
    ├─ references ─> restaurants (restaurant_id)
    ├─ references ─> tables (table_id)
    └─ contains ─> menu_items (items array)

dictionary
    │
    └─ referenced by ─> translation_system (Cloud Functions)

translation_cache
    │
    └─ referenced by ─> translation_system (Cloud Functions)
```

---

## 3. コレクション詳細設計

### 3.1 restaurants コレクション

#### 用途
店舗の基本情報を管理するルートコレクション。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○ | × | auto-generated | - | ドキュメントID（自動生成） |
| name | string | ○ | × | × | - | 1-100文字 | 店舗名 |
| description | string | × | × | ○ | null | 0-500文字 | 店舗説明 |
| address | string | × | × | ○ | null | 0-200文字 | 住所 |
| phone | string | × | × | ○ | null | 形式: XXX-XXXX-XXXX | 電話番号 |
| default_language | string | ○ | × | × | "ja" | enum: ja/en/zh | デフォルト言語 |
| supported_languages | array<string> | ○ | × | × | ["ja"] | 配列内: ja/en/zh | 対応言語リスト |
| is_active | boolean | ○ | × | × | true | - | 営業中フラグ |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 作成日時 |
| updated_at | timestamp | ○ | × | × | serverTimestamp() | - | 更新日時 |

#### インデックス
- `created_at` (降順)
- `is_active` (昇順)

#### セキュリティルール
```javascript
// 読み取り: 全ユーザー可能
allow read: if true;

// 書き込み: 認証済みユーザー（管理者）のみ
allow write: if request.auth != null && request.auth.token.admin == true;
```

#### サンプルデータ
```json
{
  "id": "restaurant_01",
  "name": "居酒屋さくら",
  "description": "新鮮な魚介と日本酒が自慢の居酒屋です",
  "address": "東京都渋谷区1-2-3",
  "phone": "03-1234-5678",
  "default_language": "ja",
  "supported_languages": ["ja", "en", "zh"],
  "is_active": true,
  "created_at": "2024-11-01T10:00:00Z",
  "updated_at": "2024-11-19T15:30:00Z"
}
```

---

### 3.2 restaurants/{restaurantId}/tables サブコレクション

#### 用途
各店舗のテーブル情報を管理。QRコードとの紐付け。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○（店舗内） | × | auto-generated | - | テーブルID |
| table_number | string | ○ | ○（店舗内） | × | - | 1-10文字 | テーブル番号（表示用） |
| qr_code | string | ○ | ○（グローバル） | × | - | 形式: `{restaurantId}/{tableId}` | QRコード内容 |
| capacity | number | ○ | × | × | 4 | 1-20の整数 | 座席数 |
| status | string | ○ | × | × | "available" | enum: available/occupied/reserved | テーブル状態 |
| floor | number | × | × | ○ | 1 | 正の整数 | フロア番号 |
| notes | string | × | × | ○ | null | 0-200文字 | 備考（窓際、個室等） |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 作成日時 |
| updated_at | timestamp | ○ | × | × | serverTimestamp() | - | 更新日時 |

#### インデックス
- `table_number` (昇順)
- `status` (昇順)
- `qr_code` (昇順) - グローバルユニーク検索用

#### セキュリティルール
```javascript
// 読み取り: 全ユーザー可能
allow read: if true;

// 書き込み: 管理者のみ
allow write: if request.auth != null && request.auth.token.admin == true;
```

#### サンプルデータ
```json
{
  "id": "table_01",
  "table_number": "1",
  "qr_code": "restaurant_01/table_01",
  "capacity": 4,
  "status": "available",
  "floor": 1,
  "notes": "窓際の席",
  "created_at": "2024-11-01T10:00:00Z",
  "updated_at": "2024-11-19T15:30:00Z"
}
```

---

### 3.3 restaurants/{restaurantId}/menu_categories サブコレクション

#### 用途
メニューカテゴリ（前菜、メイン、デザート等）の管理。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○ | × | auto-generated | - | カテゴリID |
| name_ja | string | ○ | × | × | - | 1-50文字 | カテゴリ名（日本語） |
| name_en | string | × | × | ○ | null | 1-50文字 | カテゴリ名（英語） |
| name_zh | string | × | × | ○ | null | 1-50文字 | カテゴリ名（中国語） |
| description_ja | string | × | × | ○ | null | 0-200文字 | カテゴリ説明（日本語） |
| description_en | string | × | × | ○ | null | 0-200文字 | カテゴリ説明（英語） |
| description_zh | string | × | × | ○ | null | 0-200文字 | カテゴリ説明（中国語） |
| order | number | ○ | × | × | 0 | 0以上の整数 | 表示順序 |
| icon | string | × | × | ○ | null | emoji or URL | アイコン |
| is_available | boolean | ○ | × | × | true | - | 提供可能フラグ |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 作成日時 |
| updated_at | timestamp | ○ | × | × | serverTimestamp() | - | 更新日時 |

#### インデックス
- `order` (昇順)
- `is_available` (昇順)

#### セキュリティルール
```javascript
// 読み取り: 全ユーザー可能
allow read: if true;

// 書き込み: 管理者のみ
allow write: if request.auth != null && request.auth.token.admin == true;
```

#### サンプルデータ
```json
{
  "id": "category_01",
  "name_ja": "前菜",
  "name_en": "Appetizers",
  "name_zh": "开胃菜",
  "description_ja": "お食事の前に楽しむ一品",
  "description_en": "Dishes to enjoy before your meal",
  "description_zh": "餐前小菜",
  "order": 1,
  "icon": "🍱",
  "is_available": true,
  "created_at": "2024-11-01T10:00:00Z",
  "updated_at": "2024-11-19T15:30:00Z"
}
```

---

### 3.4 restaurants/{restaurantId}/menu_items サブコレクション

#### 用途
メニュー項目の詳細情報を管理。多言語対応の核となるコレクション。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○ | × | auto-generated | - | メニューID |
| category_id | string | ○ | × | × | - | menu_categoriesのid | カテゴリID（外部キー） |
| name_ja | string | ○ | × | × | - | 1-100文字 | メニュー名（日本語） |
| name_en | string | × | × | ○ | null | 1-100文字 | メニュー名（英語） |
| name_zh | string | × | × | ○ | null | 1-100文字 | メニュー名（中国語） |
| description_ja | string | × | × | ○ | null | 0-500文字 | メニュー説明（日本語） |
| description_en | string | × | × | ○ | null | 0-500文字 | メニュー説明（英語） |
| description_zh | string | × | × | ○ | null | 0-500文字 | メニュー説明（中国語） |
| price | number | ○ | × | × | - | 0以上の整数 | 価格（円） |
| image_url | string | × | × | ○ | null | 有効なURL | 画像URL |
| allergens | array<string> | × | × | ○ | [] | enum配列 | アレルゲンリスト |
| tags | array<string> | × | × | ○ | [] | - | タグ（ベジタリアン、スパイシー等） |
| is_available | boolean | ○ | × | × | true | - | 提供可能フラグ |
| is_popular | boolean | ○ | × | × | false | - | 人気メニューフラグ |
| order | number | ○ | × | × | 0 | 0以上の整数 | カテゴリ内表示順序 |
| cooking_time | number | × | × | ○ | null | 正の整数（分） | 調理時間（目安） |
| calories | number | × | × | ○ | null | 正の整数 | カロリー（kcal） |
| spicy_level | number | × | × | ○ | 0 | 0-5の整数 | 辛さレベル（0=なし） |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 作成日時 |
| updated_at | timestamp | ○ | × | × | serverTimestamp() | - | 更新日時 |

#### アレルゲン列挙値
```javascript
allergens: [
  "wheat",      // 小麦
  "egg",        // 卵
  "milk",       // 乳製品
  "peanut",     // ピーナッツ
  "shrimp",     // エビ
  "crab",       // カニ
  "soba",       // そば
  "sesame",     // ごま
  "soy",        // 大豆
  "fish",       // 魚
  "shellfish"   // 貝類
]
```

#### インデックス
- `category_id` (昇順)
- `is_available` (昇順)
- `is_popular` (降順)
- `order` (昇順)
- 複合インデックス: `category_id` (昇順) + `order` (昇順)

#### セキュリティルール
```javascript
// 読み取り: 全ユーザー可能
allow read: if true;

// 書き込み: 管理者のみ
allow write: if request.auth != null && request.auth.token.admin == true;
```

#### サンプルデータ
```json
{
  "id": "item_01",
  "category_id": "category_01",
  "name_ja": "炙りサーモン寿司",
  "name_en": "Seared Salmon Sushi",
  "name_zh": "炙烤三文鱼寿司",
  "description_ja": "新鮮なサーモンを炙って旨味を凝縮した一品",
  "description_en": "Fresh salmon lightly seared to concentrate its umami flavor",
  "description_zh": "新鲜三文鱼经过炙烤,浓缩了鲜美的味道",
  "price": 1200,
  "image_url": "https://example.com/images/salmon_sushi.jpg",
  "allergens": ["fish", "soy", "wheat"],
  "tags": ["raw", "seafood", "signature"],
  "is_available": true,
  "is_popular": true,
  "order": 1,
  "cooking_time": 5,
  "calories": 280,
  "spicy_level": 0,
  "created_at": "2024-11-01T10:00:00Z",
  "updated_at": "2024-11-19T15:30:00Z"
}
```

---

### 3.5 orders コレクション

#### 用途
顧客からの注文情報を管理。リアルタイムで店舗側に通知。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○ | × | auto-generated | - | 注文ID |
| restaurant_id | string | ○ | × | × | - | restaurantsのid | 店舗ID（外部キー） |
| table_id | string | ○ | × | × | - | tablesのid | テーブルID（外部キー） |
| customer_language | string | ○ | × | × | "ja" | enum: ja/en/zh | 顧客使用言語 |
| items | array<object> | ○ | × | × | [] | 1項目以上 | 注文商品リスト |
| items[].item_id | string | ○ | × | × | - | menu_itemsのid | メニューID |
| items[].name | string | ○ | × | × | - | - | メニュー名（注文時） |
| items[].quantity | number | ○ | × | × | 1 | 1以上の整数 | 数量 |
| items[].price | number | ○ | × | × | - | 0以上の整数 | 単価（注文時） |
| items[].notes | string | × | × | ○ | null | 0-200文字 | 個別リクエスト |
| subtotal | number | ○ | × | × | - | 0以上の整数 | 小計 |
| tax | number | ○ | × | × | - | 0以上の整数 | 消費税 |
| total_amount | number | ○ | × | × | - | 0以上の整数 | 合計金額 |
| status | string | ○ | × | × | "pending" | enum | 注文ステータス |
| customer_notes | string | × | × | ○ | null | 0-500文字 | 全体への備考 |
| staff_notes | string | × | × | ○ | null | 0-500文字 | スタッフメモ |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 注文日時 |
| updated_at | timestamp | ○ | × | × | serverTimestamp() | - | 更新日時 |
| confirmed_at | timestamp | × | × | ○ | null | - | 確認日時 |
| completed_at | timestamp | × | × | ○ | null | - | 完了日時 |

#### ステータス列挙値
```javascript
status: [
  "pending",      // 未確認（初期状態）
  "confirmed",    // 確認済み
  "preparing",    // 調理中
  "ready",        // 提供準備完了
  "served",       // 提供済み
  "completed",    // 完了（会計済み）
  "cancelled"     // キャンセル
]
```

#### インデックス
- `restaurant_id` (昇順) + `created_at` (降順)
- `table_id` (昇順) + `created_at` (降順)
- `status` (昇順) + `created_at` (降順)
- `created_at` (降順)

#### セキュリティルール
```javascript
// 読み取り: 店舗管理者のみ
allow read: if request.auth != null &&
  (request.auth.token.admin == true ||
   request.auth.token.restaurant_id == resource.data.restaurant_id);

// 作成: 全ユーザー可能（顧客からの注文）
allow create: if request.resource.data.status == "pending";

// 更新: 店舗管理者のみ
allow update: if request.auth != null &&
  (request.auth.token.admin == true ||
   request.auth.token.restaurant_id == resource.data.restaurant_id);
```

#### サンプルデータ
```json
{
  "id": "order_001",
  "restaurant_id": "restaurant_01",
  "table_id": "table_01",
  "customer_language": "en",
  "items": [
    {
      "item_id": "item_01",
      "name": "Seared Salmon Sushi",
      "quantity": 2,
      "price": 1200,
      "notes": "No wasabi please"
    },
    {
      "item_id": "item_05",
      "name": "Miso Soup",
      "quantity": 1,
      "price": 300,
      "notes": null
    }
  ],
  "subtotal": 2700,
  "tax": 270,
  "total_amount": 2970,
  "status": "pending",
  "customer_notes": "Please serve together",
  "staff_notes": null,
  "created_at": "2024-11-19T18:30:00Z",
  "updated_at": "2024-11-19T18:30:00Z",
  "confirmed_at": null,
  "completed_at": null
}
```

---

### 3.6 dictionary コレクション

#### 用途
専門用語辞書。翻訳精度向上のための用語マスタ。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○ | × | auto-generated | - | 用語ID |
| term_ja | string | ○ | ○ | × | - | 1-100文字 | 日本語用語 |
| term_en | string | ○ | × | × | - | 1-100文字 | 英語訳 |
| term_zh | string | ○ | × | × | - | 1-100文字 | 中国語訳 |
| reading | string | × | × | ○ | null | - | 読み仮名 |
| category | string | ○ | × | × | - | enum | 用語カテゴリ |
| subcategory | string | × | × | ○ | null | - | サブカテゴリ |
| priority | number | ○ | × | × | 3 | 1-5の整数 | 優先度（1=最高） |
| notes | string | × | × | ○ | null | 0-300文字 | 備考 |
| usage_count | number | ○ | × | × | 0 | 0以上の整数 | 使用回数（統計用） |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 作成日時 |
| updated_at | timestamp | ○ | × | × | serverTimestamp() | - | 更新日時 |

#### カテゴリ列挙値
```javascript
category: [
  "dish_name",        // 料理名
  "ingredient",       // 食材
  "cooking_method",   // 調理法
  "allergen",         // アレルゲン
  "taste",            // 味
  "texture",          // 食感
  "serving_style"     // 提供スタイル
]
```

#### インデックス
- `term_ja` (昇順) - ユニーク
- `category` (昇順) + `priority` (昇順)
- `priority` (昇順)

#### セキュリティルール
```javascript
// 読み取り: 全ユーザー可能（Cloud Functionsからの参照）
allow read: if true;

// 書き込み: 管理者のみ
allow write: if request.auth != null && request.auth.token.admin == true;
```

#### サンプルデータ
```json
{
  "id": "dict_001",
  "term_ja": "炙り",
  "term_en": "seared",
  "term_zh": "炙烤",
  "reading": "あぶり",
  "category": "cooking_method",
  "subcategory": "grilling",
  "priority": 2,
  "notes": "表面を軽く焼く調理法",
  "usage_count": 45,
  "created_at": "2024-11-01T10:00:00Z",
  "updated_at": "2024-11-19T15:30:00Z"
}
```

---

### 3.7 translation_cache コレクション

#### 用途
翻訳結果のキャッシュ。API呼び出し削減とレスポンス高速化。

#### スキーマ定義

| フィールド名 | データ型 | 必須 | ユニーク | Null許容 | デフォルト値 | バリデーション | 説明 |
|------------|---------|------|---------|---------|------------|--------------|------|
| id | string | ○ | ○ | × | hash(source_text+target_lang) | - | キャッシュID（ハッシュ） |
| source_text | string | ○ | × | × | - | 1-1000文字 | 元テキスト |
| source_lang | string | ○ | × | × | "ja" | enum: ja/en/zh | 元言語 |
| target_lang | string | ○ | × | × | - | enum: ja/en/zh | 翻訳先言語 |
| translated_text | string | ○ | × | × | - | 1-1000文字 | 翻訳結果 |
| translation_method | string | ○ | × | × | - | enum | 翻訳方法 |
| hit_count | number | ○ | × | × | 0 | 0以上の整数 | ヒット回数 |
| expires_at | timestamp | ○ | × | × | - | 作成から30日後 | 有効期限 |
| created_at | timestamp | ○ | × | × | serverTimestamp() | - | 作成日時 |
| last_accessed_at | timestamp | ○ | × | × | serverTimestamp() | - | 最終アクセス日時 |

#### 翻訳方法列挙値
```javascript
translation_method: [
  "deepl_api",          // DeepL API
  "google_translate",   // Google Translate API
  "dictionary_only",    // 辞書のみ
  "hybrid"              // ハイブリッド（API+辞書）
]
```

#### インデックス
- `id` (昇順) - ユニーク
- `expires_at` (昇順) - 期限切れデータ削除用
- `hit_count` (降順) - 人気翻訳の分析用

#### セキュリティルール
```javascript
// 読み取り: Cloud Functionsのみ
allow read: if request.auth != null && request.auth.token.service == "cloud_function";

// 書き込み: Cloud Functionsのみ
allow write: if request.auth != null && request.auth.token.service == "cloud_function";
```

#### サンプルデータ
```json
{
  "id": "cache_abc123",
  "source_text": "炙りサーモン寿司",
  "source_lang": "ja",
  "target_lang": "en",
  "translated_text": "Seared Salmon Sushi",
  "translation_method": "hybrid",
  "hit_count": 12,
  "expires_at": "2024-12-19T15:30:00Z",
  "created_at": "2024-11-19T15:30:00Z",
  "last_accessed_at": "2024-11-19T18:45:00Z"
}
```

---

## 4. データ整合性とバリデーション

### 4.1 参照整合性チェック

| 参照元 | 参照先 | チェックタイミング | 処理 |
|-------|-------|----------------|------|
| menu_items.category_id | menu_categories.id | 作成・更新時 | 存在確認（Cloud Functions） |
| orders.restaurant_id | restaurants.id | 作成時 | 存在確認（Cloud Functions） |
| orders.table_id | tables.id | 作成時 | 存在確認（Cloud Functions） |
| orders.items[].item_id | menu_items.id | 作成時 | 存在確認（Cloud Functions） |

### 4.2 Cloud Functions トリガー

| トリガー | イベント | 処理内容 |
|---------|---------|---------|
| onMenuItemCreate | menu_items作成時 | 翻訳処理（name, description） |
| onMenuItemUpdate | menu_items更新時 | 差分翻訳処理 |
| onOrderCreate | orders作成時 | 金額計算検証、店舗通知 |
| onOrderUpdate | orders更新時 | ステータス変更通知 |
| onDictionaryUpdate | dictionary更新時 | translation_cacheの無効化 |

### 4.3 バリデーションルール

#### 価格計算の検証
```javascript
// orders作成時
subtotal == sum(items[i].price * items[i].quantity)
tax == Math.floor(subtotal * 0.1)
total_amount == subtotal + tax
```

#### 文字列長の制限
- 短いテキスト（名前等）: 1-100文字
- 中程度テキスト（説明等）: 0-500文字
- 備考・メモ: 0-200文字

#### 列挙値の厳密チェック
- 許可された値のみ受け入れ
- 大文字小文字の区別
- Cloud Functionsで事前検証

---

## 5. セキュリティ設計

### 5.1 認証方式

| ユーザータイプ | 認証方法 | 権限 |
|-------------|---------|------|
| **一般顧客** | 匿名認証 | 注文作成のみ |
| **店舗スタッフ** | メール/パスワード | 自店舗データの読み書き |
| **管理者** | メール/パスワード + カスタムクレーム | 全データの読み書き |

### 5.2 セキュリティルール概要

```javascript
service cloud.firestore {
  match /databases/{database}/documents {

    // 全コレクション共通: 認証済みチェック関数
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    function isStaff(restaurantId) {
      return isAuthenticated() &&
        request.auth.token.restaurant_id == restaurantId;
    }

    // restaurants: 読み取り全公開、書き込み管理者のみ
    match /restaurants/{restaurantId} {
      allow read: if true;
      allow write: if isAdmin();

      // tables: 同上
      match /tables/{tableId} {
        allow read: if true;
        allow write: if isAdmin() || isStaff(restaurantId);
      }

      // menu_categories, menu_items: 同上
      match /menu_categories/{categoryId} {
        allow read: if true;
        allow write: if isAdmin() || isStaff(restaurantId);
      }

      match /menu_items/{itemId} {
        allow read: if true;
        allow write: if isAdmin() || isStaff(restaurantId);
      }
    }

    // orders: 作成は全ユーザー、読み書きは店舗スタッフ以上
    match /orders/{orderId} {
      allow read: if isAdmin() || isStaff(resource.data.restaurant_id);
      allow create: if true; // 顧客が注文作成
      allow update, delete: if isAdmin() || isStaff(resource.data.restaurant_id);
    }

    // dictionary: 読み取り全公開、書き込み管理者のみ
    match /dictionary/{termId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // translation_cache: Cloud Functionsのみアクセス
    match /translation_cache/{cacheId} {
      allow read, write: if isAuthenticated() &&
        request.auth.token.service == "cloud_function";
    }
  }
}
```

---

## 6. パフォーマンス最適化

### 6.1 インデックス戦略

| コレクション | インデックス | 用途 |
|------------|------------|------|
| menu_items | category_id + order | カテゴリ別メニュー一覧 |
| orders | restaurant_id + created_at | 店舗別注文履歴 |
| orders | status + created_at | ステータス別注文一覧 |
| dictionary | term_ja (unique) | 用語検索 |
| translation_cache | expires_at | 期限切れデータ削除 |

### 6.2 キャッシュ戦略

| データ | キャッシュ方法 | TTL |
|-------|-------------|-----|
| メニュー一覧 | Firestoreローカルキャッシュ | 1時間 |
| カテゴリ一覧 | Firestoreローカルキャッシュ | 1日 |
| 翻訳結果 | translation_cacheコレクション | 30日 |
| 辞書データ | Cloud Functionsメモリ | 関数実行中 |

### 6.3 読み取り/書き込み削減策

1. **バッチ処理**: 複数ドキュメントを一括取得
2. **リアルタイムリスナー**: 必要最小限のフィールドのみ監視
3. **キャッシュファースト**: ローカルキャッシュ優先
4. **遅延読み込み**: 画像・詳細情報は必要時のみ取得

---

## 7. バックアップと復元

### 7.1 バックアップ戦略

| 対象 | 頻度 | 方法 | 保持期間 |
|------|------|------|---------|
| 全データ | 毎日 | Firebase自動バックアップ | 30日 |
| 辞書データ | 更新時 | CSV/JSONエクスポート | 無期限 |
| メニューデータ | 週次 | Firestoreエクスポート | 90日 |

### 7.2 復元手順

1. Firebase Consoleからバックアップ選択
2. 新規プロジェクトまたは既存プロジェクトに復元
3. セキュリティルール・インデックスの再適用
4. 動作確認

---

## 8. 今後の拡張性

### 8.1 想定される追加コレクション

| コレクション名 | 用途 | 優先度 |
|-------------|------|-------|
| users | 顧客アカウント管理 | 中 |
| reviews | レビュー・評価 | 低 |
| promotions | キャンペーン情報 | 低 |
| analytics | アクセス解析 | 中 |
| payments | 決済情報 | 中 |

### 8.2 スケーラビリティ対策

- 店舗数増加 → レストランIDによるシャーディング
- メニュー数増加 → ページネーション実装
- 注文数増加 → アーカイブコレクション分離（月次等）
- 翻訳キャッシュ肥大化 → TTL自動削除、容量監視

---

## 9. 参考資料

- [Firestore データモデリングのベストプラクティス](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore セキュリティルールガイド](https://firebase.google.com/docs/firestore/security/get-started)
- [NoSQLデータベース設計パターン](https://firebase.google.com/docs/firestore/manage-data/structure-data)

---

## 更新履歴

| 日付 | 更新内容 | 担当者 |
|------|---------|--------|
| 2024-11-19 | 初版作成 | - |
