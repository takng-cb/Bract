# spec: access-control（アクセス制御）

> 生きた仕様。新メンバーはまずここを読む。確定した挙動を反映する（経緯は ADR、作業は Issue）。
> 関連：REQ-0031/0083/0084・ADR-0023（ブック CRUD）・ADR-0029（レコード単位）。

## 1. 全体像（3 つの直交する層）

最終的に「あるユーザーがあるレコードにある操作をできるか」は、次の **AND** で決まる：

```
allowed(user, book, op, record)
  = canDo(book, op)                       // 層1: ロール×ブックの CRUD（ADR-0023）
  ∧ recordVisible(user, book, op, record) // 層2: レコード単位の可視性（ADR-0029）
```

- **層1（既存・ADR-0023）**：`role_permissions(role_id, book_api, can_*)`。`'*'` ワイルドカード、admin 全権。`canDo` / `requirePermission` / `requireBookRead` / `filterNavByRead`。
- **層2（本spec・ADR-0029）**：principal 種別でポリシーが変わる単一述語に集約。

### 1.1 principal 種別

| 種別 | 識別 | 層1 | 層2（可視レコード） |
|---|---|---|---|
| admin | system ロール `admin` | 全権 | 全件（述語なし） |
| 社内 internal | editor/viewer/カスタム | role_permissions | ロール×ブックの**レコードスコープ** `all`/`own`（将来 `team`） |
| 外部 external | `users.is_external` | **強制ゼロ（deny-all）** | `record_grants` で付与された個別レコードのみ |

## 2. 単一の可視述語：`visibleRecordWhere`

```
// src/lib/permissions.ts（予定）
// 一覧・詳細・サーバアクション・検索・ダッシュボード・エクスポートの全入口から共用。
// 戻り値は Drizzle の SQL 条件（一覧は WHERE に AND で合成し、ページ/件数を DB 側で正しく保つ）。
visibleRecordWhere(book, op, principal, table): SQL | null   // null = 制約なし（全件）
```

**鉄則**：可視性は必ず SQL の WHERE で表現する。一覧を JS で後フィルタすると `LIMIT/OFFSET` と件数がズレる（ページャ破綻）。詳細・アクションは「対象1件が可視か」を同じロジックで再判定する（直 URL 対策）。

### 2.1 ポリシー別の述語

- **admin**：`null`（全件）。
- **社内 / `all`**：`null`。
- **社内 / `own`**：`table.owner_id = :me`。
- **外部**：
  ```sql
  EXISTS (
    SELECT 1 FROM record_grants g
    WHERE g.object_api = :book AND g.record_id = table.id
      AND g.grantee_id = :me
      AND (g.expires_at IS NULL OR g.expires_at > now())
      -- write 系 op は g.level = 'write' も要求
  )
  ```

## 3. データモデル（ADR-0029・Phase で追加）

```
-- 層1 拡張（Phase1）
role_permissions += read_scope text not null default 'all'   -- 'all' | 'own'（将来 'team'）
                  + write_scope text not null default 'all'

-- 外部共有（Phase2）
record_grants(
  object_api  text not null,
  record_id   uuid not null,
  grantee_id  uuid not null,           -- 外部ユーザー
  level       text not null,           -- 'read' | 'write'
  granted_by  uuid not null,
  expires_at  timestamptz null,
  created_at  timestamptz default now(),
  primary key (object_api, record_id, grantee_id)
)

users += is_external boolean not null default false  -- principal 種別（Phase2）

-- 外部の貢献（Phase3）
record_comments(
  id uuid pk, object_api text, record_id uuid,
  author_id uuid, body text, created_at timestamptz default now()
)
```

> 全マイグレは冪等（`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`）で全 Neon に適用（CLAUDE.md「全 Neon に全マイグレ」）。`role_permissions` 追加列は既定 `all` で挙動非変更。

## 4. 外部ユーザーの仕様（Phase2–3）

> Phase2 実装済み: `users.is_external`／`record_grants`／permissions.ts `EXTERNAL_DENY`＋`isExternalUser()`／
> (crm) layout で外部を `/portal` へリダイレクト／`(portal)` 最小ルート群（grant 一覧・grant 検証済み読み取り詳細）／
> 社内詳細の最小「外部共有」パネル（管理者のみ・account/contact/opportunity/project）／ユーザー追加に「外部ユーザー」チェック。
> grant の object_api は単数規約（account/contact/opportunity/project）。関連子の選択・期限UI・コメント/ファイル・監査は Phase3。

- **入口分離**：社内 `(crm)` ルートは `is_external` を入口で全拒否 → `/portal` リダイレクト。`/portal` は最小ルート群のみ。
- **できること**：共有レコードの**閲覧**＋**ファイル追加**（attachments＋grant チェック）＋**コメント追加**（record_comments）。
- **できないこと**：本文編集・削除、非共有レコードの参照（一覧にも詳細直 URL にも出さない＝404）、管理画面/設定/検索全体/ダッシュボード KPI/全件エクスポートへの到達。
- **共有グラフ**：共有時に「含める関連子」を選択した分だけ `record_grants` 行を実体化。後から増えた関連は自動共有されない。

## 5. 封鎖すべき入口（外部=非信頼。Phase4 レビュー対象）

一覧 / 詳細直 URL / サーバアクション(update/delete/create) / 関連レコード解決 / 検索 API / AI 機能 / CSV エクスポート / ダッシュボード / ナビ / 添付の Storage 署名 URL / record_links。**1 箇所の漏れ＝情報漏えい**。go/no-go(#40) に脅威モデルレビュー＋封鎖テストを必須追加。

### 封鎖状況（Phase4 進行中）

| 入口 | 状況 |
|---|---|
| (crm) 全ページ（一覧/詳細/ダッシュボード/ナビ/管理） | ✅ layout で外部を /portal へリダイレクト＋全ページ EXTERNAL_DENY |
| サーバアクション（update/delete 等） | ✅ requirePermission/requireBookRead が EXTERNAL_DENY で全拒否 |
| 検索 API `/api/search/records` | ✅ canDo(read) ガード（外部 403） |
| **CSV エクスポート `/api/export/*`（10ルート＋業種overlay）** | ✅ requireApiBookRead（外部403＋ブックRead＋owner scope）。E2E で外部403/own限定を検証 |
| インポート `/api/import/*` | ✅ requireApiEditor（外部403） |
| 添付 Storage 署名 URL / AI 機能 / 関連レコード経由 | ⬜ 未レビュー（ポータルは record 単体のみ表示で関連は出さない。要監査） |

E2E: `external-access.external.spec.ts`（封鎖＋API403）/ `record-scope.scoped.spec.ts`（own限定・export own限定）。

## 6. ロールアウト状態

### 強制対象ブック（Phase1）

レコードスコープ `own` の強制は **owner_id を持つブック**でのみ実装する。現状の対象は
`SCOPE_ENFORCED_BOOKS = [accounts, contacts, opportunities, activities, tasks, projects]`（permissions.ts）。
- 各ブックの一覧（SQL 述語）・詳細直URL（canSeeRecord→notFound）・更新/削除アクション（guard）に適用済み。
- **expenses は owner_id を持たない**ため対象外（経費の所有者概念が無い）。
- `/admin/roles` のスコープ選択は `SCOPE_ENFORCED_BOOKS`（＋`*`）のみ有効化し、未対応ブックは「—」表示で honest に保つ。
- 未適用の社内導線（ダッシュボード/予測/検索/関連レコード）は後続。外部ユーザー(Phase2+)は別ポリシー。

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | レコードスコープ(own/all)を6ブック（取引先/人物/商談/活動/ToDo/プロジェクト）に強制 | 実装済 |
| 2 | 外部基盤（is_external・record_grants・社内拒否・ポータル読み取り） | 実装済 |
| 3 | 外部の貢献（ファイル/コメント・共有パネル・期限・取消・監査） | 一部（共有パネル・期限・取消・監査ログ済。ファイル/コメント・関連子選択は未） |
| 4 | 堅牢化（全入口の封鎖レビュー＋テスト） | 一部（export/search/import/(crm)/action 封鎖＋E2E済。添付/AI/関連は未） |

> 既定スコープ `all` のため Phase1 は**現挙動と同一**から始まる。実際にロールへ `own` を設定して初めて絞り込みが効く。
