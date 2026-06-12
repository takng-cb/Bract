# バンドルサイズ baseline（go/no-go チェック項目）

`npm run bundle:report` の記録。リリース後の回帰検知の基準値とする。
更新時は本ファイルに追記（古い値は残す）。

## 2026-06-13（v1.0.0-rc.1 相当 / NEXT_PUBLIC_INDUSTRY=base）

- **合計**: 2.70 MB (234 files)

| 種別 | ファイル数 | 合計サイズ |
|---|---:|---:|
| vendor | 33 | 1.52 MB |
| app | 189 | 778.0 KB |
| other | 9 | 247.2 KB |
| framework | 3 | 189.1 KB |

主要 chunk: vendor 最大 381KB / framework 185KB / 最大の app ページ = 整備詳細 120.5KB。
