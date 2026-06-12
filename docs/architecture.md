# Bract CRM Architecture

このドキュメントは、Bract CRM の運用ルール・コード構造の **詳細リファレンス** です。日々の作業で必読の最重要点は [`AGENTS.md`](../AGENTS.md) を参照してください。

## 目次

1. [ブランチ戦略](#ブランチ戦略)
2. [業種オーバーレイ](#業種オーバーレイ)
3. [Vercel デプロイ構成](#vercel-デプロイ構成)
4. [DB スキーマ運用](#db-スキーマ運用)
5. [マイグレーション](#マイグレーション)
6. [一覧ページの SQL Pushdown 構造](#一覧ページの-sql-pushdown-構造)
7. [worktree 慣習](#worktree-慣習)
8. [新しい業種を追加する手順](#新しい業種を追加する手順)
9. [既知の制限](#既知の制限)
10. [将来検討事項](#将来検討事項)

---

## ブランチ戦略

### アクティブブランチ

| ブランチ | 役割 | 寿命 |
|---|---|---|
| `main` | 本番デプロイ。Vercel が常時監視 | 恒常 |
| `develop` | 次期リリース統合 | 恒常 |
| `feature/<name>` | 新機能開発（業種非依存・特化問わず） | PR マージ後削除 |
| `fix/<name>` | バグ修正 | PR マージ後削除 |
| `claude/<adjective-name-hash>` | Claude Code worktree 用一時ブランチ | 一時 |

### 廃止済み（残骸あり）

| 項目 | 状態 | 理由 |
|---|---|---|
| `base` ブランチ | 廃止。タグ `base-archived` (commit `cc6d467`) でアーカイブ | overlay 構造への移行で `main` が役割を引き継いだ |
| `industry/real-estate` ブランチ | 廃止。タグ `industry-real-estate-archived` (commit `eeef410`) でアーカイブ | overlay 化により `main + INDUSTRY=real-estate` で同等動作。緊急 rollback 用に当面ブランチ残置 |

### 開発フロー

#### 業種非依存の機能/修正

```
develop から feature/<name> or fix/<name> を切る
  ↓ 開発
GitHub PR で develop に向ける（or local でマージ）
  ↓ レビュー
develop にマージ
  ↓ ビルドが通ったら
local で git merge --no-ff develop（main にて）
  ↓
main を push → Vercel が全業種 project を再ビルド
```

merge メッセージ規約: `merge: develop → main (簡潔な要約)`。例:
```
merge: develop → main (SQL pushdown PR 2/3 — 6 list pages)
```

#### 業種特化の機能/修正

上記と同じフロー。**ブランチ名に業種を含める必要はない**（含めても良い）。重要なのは:
- ファイル変更箇所が `src/industries/<業種>/` 配下に集約されていること
- 共通ファイルでの分岐は `if (activeIndustry === '<業種>')` ガードで囲むこと

### コミット規約

参考: 過去の commit メッセージスタイル（自由形式だが日本語が中心）
- `feat: <内容>`
- `fix: <内容>`
- `chore: <内容>`
- `refactor: <内容>`
- `Merge feature/<name>: <要約>`
- `merge: develop → main (<要約>)`

---

## 業種オーバーレイ

### 全体像

```
            ┌──── Vercel project: 不動産特化 ────┐
            │  Branch: main                       │
            │  ENV: NEXT_PUBLIC_INDUSTRY=          │
            │       real-estate                   │
            │  DB:  不動産 Neon                    │
            │  URL: bract-crm.vercel.app          │
            └─────────────────────────────────────┘

            ┌──── Vercel project: 汎用CRM (将来) ──┐
git: main ─→│  Branch: main                       │
            │  ENV: (未設定 → base にフォールバック) │
            │  DB:  汎用 Neon                      │
            │  URL: 別ドメイン                     │
            └─────────────────────────────────────┘
```

### `NEXT_PUBLIC_INDUSTRY` 環境変数

- **値**: `'base'` | `'real-estate'`（将来追加可能）
- **未設定時**: `'base'` にフォールバック（`src/lib/industry.ts` 参照）
- **設定箇所**:
  - 開発時: `.env.local` に `NEXT_PUBLIC_INDUSTRY=real-estate`
  - 本番: Vercel Dashboard → Project Settings → Environment Variables → Production
- **ビルド時固定**: Next.js は `NEXT_PUBLIC_*` 系の env var をビルド時に JS バンドルに静的埋め込みするため、設定変更後は **再ビルド必須**

### コードの分岐機構

#### 1. `src/lib/industry.ts`
```ts
export const activeIndustry: Industry = (() => {
  const v = process.env.NEXT_PUBLIC_INDUSTRY
  if (v && (INDUSTRIES as readonly string[]).includes(v)) return v as Industry
  return 'base'
})()
```
モジュール初回ロード時に評価され、定数として export される。

#### 2. `next.config.ts` redirects
```ts
async redirects() {
  if (process.env.NEXT_PUBLIC_INDUSTRY === 'real-estate') return []
  return [
    { source: '/properties/new', destination: '/books/properties/new', permanent: false },
    // ... 他の properties 系 URL を /books/properties/* に転送
  ]
}
```

#### 3. ページレベル proxy（業種専用ルート）
`src/app/(crm)/properties/page.tsx`:
```ts
import { activeIndustry } from '@/lib/industry'
import { notFound } from 'next/navigation'
import RealEstatePropertiesPage from '@/industries/real-estate/pages/properties/page'

export default async function PropertiesPage(props) {
  if (activeIndustry !== 'real-estate') notFound()
  return <RealEstatePropertiesPage {...props} />
}
```

#### 4. 共通ファイル内の分岐
`src/components/OpportunityForm.tsx` は base/real-estate 両モードで使われるが、不動産情報セクションは `if (activeIndustry === 'real-estate')` ガード内でのみ描画。

### 業種特化コードの置き場所

```
src/industries/<業種名>/
├── pages/<route>/page.tsx        # /<route> 用の業種専用ページ
├── actions/<feature>.ts          # server actions
├── api/<route>/route.ts          # API ルート
├── components/                   # 業種専用コンポーネント
│   └── <Name>.tsx
├── lib/                          # 業種専用ロジック
│   └── <feature>.ts
└── schema.ts                     # 業種専用テーブル定義（src/lib/schema.ts に統合参照）
```

例（real-estate）:
```
src/industries/real-estate/
├── pages/properties/page.tsx, [id]/page.tsx, [id]/edit/page.tsx, new/page.tsx
├── actions/properties.ts
├── api/export/properties/route.ts, api/import/properties/route.ts
├── components/PropertyForm.tsx, tableviews/PropertiesTableView.tsx
├── lib/realEstateCommission.ts
└── schema.ts
```

### 共通スキーマでの業種カラム

業種固有カラムも `src/lib/schema.ts` の中に書く（業種ごとに分けない）。`base` モードでは触らない設計に:

```ts
export const opportunities = pgTable('opportunities', {
  // ── 共通カラム ──
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // ...

  // ── 業種オーバーレイ：不動産 (INDUSTRY=real-estate のときのみ UI で使用) ──
  // base モードでは未使用。共通スキーマに置く理由は同一テーブルへの ALTER を
  // 全 Neon DB に流せば済むため。
  transaction_type: text('transaction_type').notNull().default('売買'),
  commission_fee: numeric('commission_fee'),
  brokerage_type: text('brokerage_type'),
  other_profit: numeric('other_profit').notNull().default('0'),
})
```

---

## Vercel デプロイ構成

### Project 単位の役割分担

1 つの Vercel project = 1 つの業種 deploy。それぞれ:
- **Production Branch**: `main`（共通）
- **Environment Variable**: `NEXT_PUBLIC_INDUSTRY=<業種>`（project 固有）
- **Database**: Neon project（業種固有）
- **Domain**: 業種固有

### 現状

- **不動産特化**: `bract-crm.vercel.app` (main + `INDUSTRY=real-estate`、不動産 Neon)
- **汎用**: 未設置（必要になったら project 追加）

### Redeploy 注意点

- env var を変更しても **再ビルドしないと反映されない**（NEXT_PUBLIC_* はビルド時固定のため）
- 「Redeploy with cache disabled」で確実に新 env var で再ビルドする
- Production deploy にしたい場合は、Redeploy ダイアログの **Choose Environment を Production に明示**（Preview にすると本番に反映されない）

---

## DB スキーマ運用

### 1 つの schema.ts で全業種をカバー

理由:
- Drizzle の型推論を一本化
- マイグレーションが 1 系統で済む
- 業種カラムが nullable/DEFAULT なら base モードでも整合

### 業種固有カラムの設計指針

| 設計 | 推奨度 | 例 |
|---|---|---|
| `nullable` | ◎ | `commission_fee numeric` |
| `NOT NULL DEFAULT '<デフォルト値>'` | ○ | `transaction_type text NOT NULL DEFAULT '売買'`、`other_profit numeric NOT NULL DEFAULT '0'` |
| `NOT NULL` (デフォルトなし) | ✗ | base モードで insert 時にエラーになる |

### マイグレーション

ファイル: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`

例: `20260508500000_real_estate_transaction_type.sql`
```sql
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT '売買';
```

### マイグレーション適用

`scripts/apply-migration.ts` ユーティリティを使う:
```bash
npx tsx scripts/apply-migration.ts supabase/migrations/<file>.sql
```

これは `.env.local` の `DATABASE_URL` に対して SQL ファイルを実行する。**全業種の Neon DB に同じ migration を流す前提**（業種ごとに DB を分けるなら別途設計が必要）。

---

## 一覧ページの SQL Pushdown 構造

`/accounts`, `/contacts`, `/opportunities`, `/activities`, `/tasks`, `/expenses` は **SQL ベースのページネーション・フィルタ・ソート・タグ絞り込み** で実装されている。

### 共通基盤

| ファイル | 関数 | 役割 |
|---|---|---|
| `src/lib/filterUtils.ts` | `parseFilterParams` | URL `?f=field|op|value` を `FilterCondition[]` にパース |
| | `applyFilters` | レコード配列に JS でフィルタ適用（fallback パス用） |
| | `splitTagConditions` | tag フィールドの条件を分離 |
| | `applyTagFilter` | JS でタグフィルタ適用（fallback パス用） |
| | `buildWhere` | `FilterCondition[]` + `FilterColumnResolver` → Drizzle `WHERE` SQL |
| | `buildTagWhere` | tag 条件 + objectType + recordIdCol → Drizzle `WHERE id IN (subquery)` |
| | `unresolvedConditions` | resolver で解決できない条件のみ抜き出し（fallback 判定用） |
| `src/lib/sortUtils.ts` | `parseSortParams` | URL `?sort=field:dir,field2:dir` をパース |
| | `applySort` | JS ソート（fallback 用） |
| | `buildOrderBy` | `SortDef[]` + resolver → Drizzle `ORDER BY` |

### `FilterColumnResolver`

field 名 → Drizzle カラム + 型ヒント の対応表。各ページで定義する:

```ts
const resolver: FilterColumnResolver = {
  name:             { col: opportunities.name,    type: 'text' },
  'accounts.name':  { col: accounts.name,         type: 'text' },
  stage:            { col: opportunities.stage,   type: 'select' },
  amount:           { col: opportunities.amount,  type: 'number' },
  close_date:       { col: opportunities.close_date, type: 'date' },
  owner_id:         { col: opportunities.owner_id, type: 'select' },
}
```

`type` はオペレータの解釈に使う:
- `text` / `select` → `eq`/`neq` は `ilike()` で大小文字無視
- `number` / `date` → `eq()`/`ne()` で厳密一致

### Fast path / Fallback path

各ページは:

```ts
const useJsFallback = unresolvedConditions(otherConditions, resolver).length > 0

if (useJsFallback) {
  // JS フォールバック: 全件取得 → JS フィルタ → JS ソート → JS スライス
} else {
  // SQL fast path
  const userWhere = buildWhere(otherConditions, resolver)
  const tagWhere  = buildTagWhere(tagConditions, 'opportunity', opportunities.id)
  const where = and(userWhere, tagWhere)  // undefined は drizzle が無視
  const orderBy = buildOrderBy(sortDefs, resolver)
  
  const baseQuery = db.select(...).from(...).leftJoin(...).where(where).orderBy(...orderBy)
  
  const [pageRows, totalRow] = await Promise.all([
    isGrouped ? baseQuery : baseQuery.limit(PAGE_SIZE).offset((page-1)*PAGE_SIZE),
    db.select({ count: count() }).from(...).leftJoin(...).where(where),
  ])
}
```

`isGrouped` の場合は LIMIT を外す（filter は SQL で済んでいるので、JS でグループ化しても件数は絞られている）。

### 集計（特殊ケース）

- `/tasks` は「未完了件数」を別 `count()` クエリで取得
- `/expenses` は「期間内合計」を `sum(amount)` で取得

### スモークテスト

- `scripts/test-sql-pushdown.ts` — buildWhere/buildOrderBy の各オペレータ動作確認
- `scripts/test-tag-where.ts` — buildTagWhere の各パターン動作確認

```bash
npx tsx scripts/test-sql-pushdown.ts
npx tsx scripts/test-tag-where.ts
```

### 新しいフィルタ field を追加する手順

1. ページの `FilterColumnResolver` に entry を追加
2. ページの `FIELDS: FieldDef[]` 配列に UI 用の field 定義を追加
3. それだけで `?f=<field>|<op>|<value>` が SQL で動く

---

## worktree 慣習

長期作業や並列作業には worktree を活用:

```bash
# 既存ブランチをチェックアウト
git worktree add .claude/worktrees/<name> origin/<branch>

# 新規ブランチを作りつつチェックアウト
git worktree add -b feature/<name> .claude/worktrees/<name> origin/develop

# 作業終了後（modified/untracked が残っていれば --force）
git worktree remove --force .claude/worktrees/<name>
```

### `.env.local` のコピー

`.env.local` は gitignore のため worktree に自動コピーされない。手動で:
```bash
cp ../../../.env.local .env.local  # worktree から見た親リポジトリの env
```

### `.claude/launch.json`

各 worktree が独自の dev server 設定を持てる。port 競合を避けるため `autoPort: true` を推奨:
```json
{
  "version": "0.0.1",
  "configurations": [{
    "name": "crm-dev",
    "runtimeExecutable": "npm",
    "runtimeArgs": ["run", "dev"],
    "port": 3000,
    "autoPort": true
  }]
}
```

---

## 新しい業種を追加する手順

例: `medical` 業種を追加する場合

1. `src/lib/industry.ts` を編集:
   ```ts
   export type Industry = 'base' | 'real-estate' | 'medical'
   export const INDUSTRIES = ['base', 'real-estate', 'medical'] as const
   ```

2. `src/industries/medical/` を作成し、業種専用コードを置く

3. 共通ルートで業種特化を出したい場合、`src/app/(crm)/<route>/page.tsx` の proxy に分岐を追加 + `next.config.ts` の `redirects()` も必要に応じて。`src/lib/navItems.ts` の `customBooksToNavItems` ヘルパーにも業種別 URL 対応を追加（例: real-estate の properties → /properties、auto-body の vehicles → /vehicles）

4. DB スキーマ追加（必要なら）: `src/lib/schema.ts` の該当テーブルに業種固有カラムを追加 + `supabase/migrations/<timestamp>_<name>.sql` 作成

5. **業種専用ブックのマスタデータを seed スクリプトに記述**:
   業種専用のテーブル（例: `vehicles`）を `book_definitions` に登録しないと
   `/admin/books` に出ず、サイドバーのカスタムブック経由のリンクも生成されない。
   マイグレーションには入れず（他業種 Neon に不要なデータが入るため）、
   業種別 seed スクリプト `scripts/seed-<業種>.ts` の冒頭で **冪等な INSERT** として記述:
   ```ts
   await sql`
     INSERT INTO book_definitions (
       api_name, label, label_plural, icon,
       is_builtin, nav_enabled, sort_order,
       enable_activities, enable_tasks, enable_expenses
     )
     VALUES (
       'vehicles', '車両', '車両', '🚗',
       false, true, 100,
       true, true, true
     )
     ON CONFLICT (api_name) DO NOTHING
   `
   ```
   試験データ部分は `if (process.env.SEED_TEST_DATA === 'false') return` でスキップ可にしておくと、本番セットアップ時にもマスタのみ投入できる。

6. Vercel project を新規作成:
   - Production Branch: `main`
   - Environment Variable: `NEXT_PUBLIC_INDUSTRY=medical`
   - Database: 医療業向け Neon project
   - Domain: 医療向けドメイン

7. ビルド検証:
   ```bash
   NEXT_PUBLIC_INDUSTRY=base       npx next build --webpack
   NEXT_PUBLIC_INDUSTRY=real-estate npx next build --webpack
   NEXT_PUBLIC_INDUSTRY=medical    npx next build --webpack
   ```

---

## 既知の制限

| 制限 | 影響 | 回避策 |
|---|---|---|
| 業種ごとに別タイミングでリリースできない | main 1 本のため、push すると全業種 deploy が再ビルドされる | release tag による pinning、Vercel Preview による段階的 rollout 等を必要に応じて検討 |
| カスタムフィールド絞り込みは URL filter で SQL 化されていない | 一覧ページで `cf_*` field を URL に指定すると JS フォールバックパスに落ちる | 当面 URL からのカスタムフィールド絞り込み機能は未提供。要件発生時に `book_fields` を読んで SQL 化する実装を追加 |
| DB スキーマは全業種共通 | 一つの ALTER ですべての業種 Neon DB に流す必要がある（業種ごとに別 migration はできない） | 業種固有カラムは nullable/DEFAULT で base モードに無害化。完全分離が必要なら下記「将来検討事項」の schema 分割案を参照 |
| `accounts` ブランチは Tagging 専用 (?) | 現状無関係。ブランチ整理時に削除候補 | — |

---

## 将来検討事項

未着手の設計タスク。バグではないので Issue ではなくここに記録する。優先度が上がったタイミングで個別検討する。

### 業種別 schema 分割（"Option 2" リファクタ）

#### 背景

現状は **「全 Neon に全マイグレを適用する」** ポリシー（AGENTS.md「DB マイグレーション運用」参照）。

- 結果として、real-estate 顧客の Neon にも `vehicles` / `parts` / `part_movements` テーブルと `opportunities` の `service_type` / `vehicle_id` / `parts_cost` カラムが空のまま存在する
- 空テーブル/列なのでストレージ・パフォーマンスへの実害はないが、「使わないテーブルが顧客 DB に見える」状態
- 業種が増えるほど未使用テーブルの「ノイズ」が比例して肥大する

#### 検討すべき再構成

業種固有テーブルを `src/lib/schema.ts` から **業種フォルダ配下の本物の宣言** に移す:

```
src/lib/schema.ts                    ← 全業種共通テーブルのみ
                                       (accounts, contacts, opportunities, activities,
                                        tasks, expenses, tags, custom_*, object/field
                                        definitions, ...)
src/industries/real-estate/schema.ts ← properties など real-estate 専用
src/industries/auto-body/schema.ts   ← vehicles / parts / part_movements
```

ビルド時に `activeIndustry` で **必要な schema だけを Drizzle registry に登録**する仕組みにすれば:

- real-estate ビルドは auto-body テーブルを Drizzle が知らない → SELECT が生成されない → DB にも要らない
- 顧客 Neon は使うテーブルだけを持つ「クリーン」な状態にできる
- 新しい業種を増やしても、他業種 DB が肥大しない

#### 同時に必要になる対応

`opportunities` テーブルのように **共通テーブルに業種固有カラム** を持たせている現状はそのままだと破綻する:

- `service_type` / `vehicle_id` / `parts_cost` は `opportunities` に直接生やしている（auto-body 専用）
- `transaction_type` / `commission_fee` / `brokerage_type` / `other_profit` は同じく `opportunities` に直接生やしている（real-estate 専用）

これらを **業種拡張テーブル** に分離するリファクタが必要:

```sql
CREATE TABLE opportunities_real_estate_ext (
  opportunity_id   uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  transaction_type text NOT NULL DEFAULT '売買',
  commission_fee   numeric,
  brokerage_type   text,
  other_profit     numeric NOT NULL DEFAULT '0'
);

CREATE TABLE opportunities_auto_body_ext (
  opportunity_id  uuid PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  service_type    text,
  vehicle_id      uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  parts_cost      numeric NOT NULL DEFAULT 0
);
```

詳細ページや一覧ページの SELECT で LEFT JOIN を追加する必要がある。

#### トリガー条件（やる判断基準）

このリファクタを着手すべきタイミング:

1. **業種が 4 つ以上に増えるとき** — `opportunities` の業種別カラムが破綻寸前になる
2. **顧客から DB 構造の説明を求められたとき** — 「なぜ real-estate CRM に vehicles テーブルが？」への説明コストが上がる
3. **業種特化機能のテーブルが大規模化したとき** — 空テーブルとはいえ運用上の認知負荷が高まる

#### 着手しない判断（現状）

- 3 業種までは未使用テーブルが残っても実害ほぼゼロ
- `vercel-build` フックで schema↔DB の整合性は自動担保されているため、現状のポリシーで構造的バグは出ない
- リファクタコストが（中規模・1〜2 日）大きい

→ **当面は現行ポリシー継続**。トリガー条件のいずれかが満たされた段階で再検討する。

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05 | 初版（業種オーバーレイ移行 + SQL pushdown 完了時点） |
