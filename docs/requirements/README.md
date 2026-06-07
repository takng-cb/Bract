# 要件・決定の記録（Requirements & Decisions）

このディレクトリは Bract の **要件・設計判断・仕様の恒久記録**。
新しい開発メンバーは、まずここを読めば「何を作るのか」「なぜこうなっているのか」が分かる。

## 構成と読む順番

| ファイル | 役割 | 編集ルール | 新メンバーの読む順 |
|---|---|---|---|
| `specs/<module>.md` | **生きた仕様**（現在の真実） | 随時更新 | ① 最初に読む |
| `decisions.md` | **決定記録(ADR)**（なぜそうしたか） | **追記専用**（過去は消さない／覆す時は新ADRで Supersede） | ② 経緯を理解 |
| `requirements-log.md` | **要件ログ**（出た要件を時系列で全部） | **追記専用** | ③ 詳細・抜け漏れ確認 |
| `sources/` | 元資料（依頼書・ブリーフ等） | 原文保存 | 必要に応じ |

## 運用フロー（記録は Claude が会話の都度行う）

```
要件が出た        → requirements-log.md に REQ-NNN を追記（即・もれなく）
設計判断をした    → decisions.md に ADR-NNN を追記（なぜを残す）
仕様が確定した    → specs/<module>.md を更新（現在の真実に反映）
作業/不具合       → GitHub Issue（状態管理）。本文に REQ-/ADR- を参照
commit / PR       → メッセージに REQ-/ADR-/#Issue を書いて追跡可能に
```

## トレーサビリティ

`REQ-005`（要件）→ `ADR-007`（判断）→ `#15`（Issue）→ commit → `specs/staffing.md`（仕様）
の鎖でいつでも経緯を辿れるようにする。ID は 4 桁連番（`REQ-0001` …）。

## ID 採番ルール

- `REQ-NNNN` 要件。出所（会話 / ブリーフ §x / Issue #y）を必ず明記。
- `ADR-NNNN` 決定（Architecture Decision Record）。状態：`採用` / `保留` / `却下` / `Superseded by ADR-xxxx`。
- 番号は飛ばさず連番。一度振った番号は再利用しない。
