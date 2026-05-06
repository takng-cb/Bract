# テスト仕様書 ディレクトリ

このディレクトリには手動テスト仕様書とテスト結果を管理します。

## ファイル構成

```
tests/
├── README.md                        # このファイル
├── specs/                           # テスト仕様書（機能ごと）
│   ├── 01_auth.md                   # 認証・パスワードリセット（TC-AUTH）
│   ├── 02_list_views.md             # リストビュー PC/モバイル（TC-LIST）
│   ├── 03_sort_grouping.md          # ソート・グルーピング・列幅（TC-SORT / TC-GROUP / TC-COL）
│   ├── 04_saved_views.md            # ビュー保存・呼び出し・デフォルト（TC-VIEW）
│   ├── 05_crud_accounts.md          # 取引先 CRUD（TC-ACC）
│   ├── 06_crud_contacts.md          # 担当者 CRUD（TC-CON）
│   ├── 07_pwa.md                    # PWA・モバイル動作（TC-PWA / TC-MOB）
│   ├── 08_crud_opportunities.md     # 商談 CRUD（TC-OPP）
│   ├── 09_crud_activities.md        # 活動 CRUD（TC-ACT）
│   ├── 10_crud_tasks.md             # タスク CRUD（TC-TSK）
│   ├── 11_crud_expenses.md          # 経費 CRUD（TC-EXP）
│   ├── 12_crud_properties.md        # 物件 CRUD（TC-PRP）
│   ├── 13_tags.md                   # タグ管理（TC-TAG）
│   ├── 14_admin.md                  # 管理者機能（TC-ADM）
│   ├── 15_custom_objects.md         # カスタムオブジェクト（TC-COBJ）
│   ├── 16_csv_and_dashboard.md      # CSV・ダッシュボード・フォーキャスト（TC-CSV / TC-DASH）
│   ├── 17_settings.md              # 設定・プロフィール（TC-SET）
│   └── 18_relationships.md         # 関係性管理・多対多リレーション（TC-18）
└── results/                         # テスト実施結果
    └── YYYY-MM-DD_description.md
```

## テストケース ID 体系

| プレフィックス | 対象機能 |
|---------------|---------|
| TC-AUTH | 認証 |
| TC-LIST | リストビュー |
| TC-SORT / TC-GROUP / TC-COL | ソート・グルーピング・列幅 |
| TC-VIEW | 保存ビュー |
| TC-ACC | 取引先 |
| TC-CON | 担当者 |
| TC-OPP | 商談 |
| TC-ACT | 活動 |
| TC-TSK | タスク |
| TC-EXP | 経費 |
| TC-PRP | 物件 |
| TC-TAG | タグ |
| TC-ADM | 管理者機能 |
| TC-COBJ | カスタムオブジェクト |
| TC-CSV | CSV インポート・エクスポート |
| TC-DASH | ダッシュボード・フォーキャスト |
| TC-SET | 設定 |
| TC-PWA / TC-MOB | PWA・モバイル |
| TC-18 | 関係性管理（多対多） |

## 記法

- ✅ PASS：期待通り動作
- ❌ FAIL：不具合あり（詳細を記載）
- ⚠️ PARTIAL：一部動作（条件付きPASS）
- ⏭️ SKIP：未確認・対象外
- ❌→✅ FIXED：不具合修正済み・再テストで PASS

## テスト環境

- **本番**: https://bract-crm.vercel.app
- **ブラウザ**: Chrome (Desktop), Chrome (Android)
- **DB**: Neon PostgreSQL (ap-southeast-1)
