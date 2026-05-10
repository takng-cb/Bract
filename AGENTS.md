<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Bract CRM

業種オーバーレイ構造を持つ汎用 CRM。`main` 1 本から、`NEXT_PUBLIC_INDUSTRY` 環境変数で複数業種版（`base` / `real-estate` / 将来の業種）をビルド・デプロイする。

詳細仕様は **[`docs/architecture.md`](./docs/architecture.md)** を参照すること。以下は最重要のサマリ。

## ブランチ運用（必読）

| ブランチ | 役割 |
|---|---|
| `main` | 本番（全業種の Vercel project が監視） |
| `develop` | 次期リリース統合 |
| `feature/<name>` `fix/<name>` | 新規開発・修正。develop に向けてマージ |
| `claude/<adjective-name-hash>` | Claude Code が worktree 用に作る一時ブランチ |

**廃止済み**: `base`, `industry/real-estate`（タグ `base-archived`, `industry-real-estate-archived` でアーカイブ済。新規開発しないこと）

通常フロー: `feature/* or fix/*` → `develop` → `main`。develop → main は local の `--no-ff` merge で `merge: develop → main (...)` 形式のメッセージ。

## 業種オーバーレイ（最重要）

- すべての業種版が **同じ main** からビルドされる
- `NEXT_PUBLIC_INDUSTRY` 環境変数（Vercel project ごとに設定）で動作する業種を選択
- `src/lib/industry.ts` の `activeIndustry` 定数を経由してコードが分岐
- `next.config.ts` の `redirects()` も `process.env.NEXT_PUBLIC_INDUSTRY` で切替

### 業種特化コードの置き場所

```
src/industries/<業種名>/
  pages/<route>/page.tsx     # 業種専用ページ
  actions/<feature>.ts       # server actions
  api/<route>/route.ts       # API
  components/                # コンポーネント
  lib/                       # ロジック
  schema.ts                  # 業種専用カラム定義（メイン schema.ts に統合）
```

### Proxy パターン（業種専用ルート）

`src/app/(crm)/<route>/page.tsx` で `activeIndustry` チェックして該当業種以外は `notFound()`、業種固有実装は `src/industries/<業種>/pages/<route>/page.tsx` に dynamic import で委譲。

### 共通ファイル内の業種分岐

`src/components/`, `src/app/(crm)/<共通ルート>/page.tsx` など共通箇所では、業種特化セクションを `if (activeIndustry === '<業種>')` ガードで囲む。例: `OpportunityForm.tsx` の不動産情報セクション。

## 重要規律

- ❌ **main / develop に業種専用コードを混入させない**（漏れたら次回の整理が必要に）
- ❌ 廃止済みの `industry/real-estate` ブランチに新規開発しない
- ✅ 業種特化機能は **常に `src/industries/<業種>/` 配下 + `activeIndustry` ガード** で実装
- ✅ ビルド検証は **両モードで実施**:
  ```bash
  NEXT_PUBLIC_INDUSTRY=base npx next build --webpack
  NEXT_PUBLIC_INDUSTRY=real-estate npx next build --webpack
  ```
- ✅ DB スキーマは `src/lib/schema.ts` に **1 本に統合**。業種固有カラムは nullable or DEFAULT で base モードでも整合
- ✅ 一覧ページの新フィルタ field 追加は `FilterColumnResolver` に entry を追加すれば SQL で動く（詳細は architecture.md）

## worktree 慣習

長期作業や並列作業では worktree:
```bash
git worktree add -b feature/<name> .claude/worktrees/<name> origin/develop
# 作業後に削除（.env.local 等の untracked が残る場合は --force）
git worktree remove --force .claude/worktrees/<name>
```

`.env.local` は worktree ごとにコピーが必要（gitignore のため）:
```bash
cp ../../../.env.local .env.local
```

## 詳細リファレンス

- **[docs/architecture.md](./docs/architecture.md)** — 業種オーバーレイ詳細、Vercel 構成、DB スキーマ運用、SQL pushdown 構造、マイグレーション手順、既知の制限
