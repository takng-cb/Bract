# テスト仕様書 ディレクトリ

このディレクトリには手動テスト仕様書とテスト結果を管理します。

## ファイル構成

```
tests/
├── README.md                    # このファイル
├── specs/                       # テスト仕様書（機能ごと）
│   ├── 00_overview.md           # 総合テスト一覧
│   ├── 01_auth.md               # 認証・パスワードリセット
│   ├── 02_list_views.md         # リストビュー（PC・モバイル）
│   ├── 03_sort_grouping.md      # ソート・グルーピング
│   ├── 04_saved_views.md        # ビュー保存機能
│   ├── 05_crud.md               # 各オブジェクトCRUD
│   ├── 06_csv.md                # CSVインポート・エクスポート
│   └── 07_pwa.md                # PWA・モバイル動作
└── results/                     # テスト実施結果
    └── YYYY-MM-DD_description.md
```

## 記法

- ✅ PASS：期待通り動作
- ❌ FAIL：不具合あり（詳細を記載）
- ⚠️ PARTIAL：一部動作（条件付きPASS）
- ⏭️ SKIP：未確認・対象外

## テスト環境

- **本番**: https://bract-crm.vercel.app
- **ブラウザ**: Chrome (Desktop), Chrome (Android)
- **DB**: Neon PostgreSQL (ap-southeast-1)
