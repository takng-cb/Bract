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
| `worktree/<name>` | 業種別の常駐 worktree（`re-base` / `ab-base`）が居座るための駐車場ブランチ。マージしない。詳細は [worktree 慣習](#worktree-慣習) |

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

## 業種オーバーレイのペア確認（必読）

業種特化テーブル（`vehicles` / `parts` / `properties` / `part_movements` など）や、両業種にまたがる共通パターンを修正したら、**必ずもう片方の業種に同じ問題がないか確認** する。確認結果は Issue 本文の「副次タスク」セクションに記載する。

### 該当する修正パターン

- typed table + `custom_records` ミラー同期の追加・修正（例: vehicles ⇔ properties）
- 共通機能の挙動修正（活動種別フォールバック、フィルタ resolver、表示列定義 など）
- `src/components/` 配下の共通コンポーネント、`src/app/(crm)/<共通ルート>` の修正
- listViewDefs / filterUtils / sortUtils / FilterBuilder など、全業種共有モジュール

### 過去の事故例

- vehicles の `custom_records` 同期を実装した際、properties で同じバグ（新規 INSERT 時にミラー作成漏れ）が放置されていた
- 活動種別ラベルを 1 画面で動的化した時、他 5 画面でハードコード fallback が残留

### チェック手順

1. 修正対象が業種特化機能なら、対称の業種（vehicles ⇔ properties、real-estate ⇔ auto-body）の同種コードを `grep` で洗い出す
2. 共通機能の修正なら、3 mode build（base / real-estate / auto-body）を merge 前に必須実行
3. 検証結果を Issue / commit message に記録（「他業種側は別問題のため対応不要」と判定した場合もその旨を残す）

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
- ✅ **新規 list page には必ず `loading.tsx` を置く**（perceived performance）。`<ListPageSkeleton>` を import するだけで OK。dashboard / forecast 等の独自レイアウトページは手書きで実レイアウトに近いスケルトンを書く
- ✅ ナビゲーション体感は `src/components/NavigationProgress.tsx` が `(crm)/layout.tsx` 経由で全 CRM ページに適用済み。Link クリック直後から青いバーが表示される

## DB マイグレーション運用（最重要・必読）

### 大原則: 「全 Neon に全マイグレを適用する」

`src/lib/schema.ts` は **全業種共有**（main から各業種版が同じコードでビルドされる）。
一方で接続先 Neon は **業種ごとに別物**。両者の状態が乖離するとサーバーコンポーネントの SELECT が `column does not exist` で落ちる（実例: Issue #6）。

そのため:

- ❌ マイグレーション SQL のヘッダに「適用先: <X> のみ」と書かない（混乱の元）
- ❌ 「この業種で使わないからこの DB には流さない」という判断をしない
- ✅ **すべての `supabase/migrations/*.sql` を、運用中の全 Neon に適用する**（base / real-estate / auto-body / 将来の業種すべて）
- ✅ マイグレーションは必ず `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `ON CONFLICT DO NOTHING` で冪等に書く
- ✅ schema.ts に追加するカラムは nullable または `DEFAULT` 付きで、未使用業種でも空のままで害ないように設計

業種特化テーブル（`vehicles` / `parts` / `part_movements` など）が他業種 Neon に空のまま存在することは害ではない。逆に「無い」と Drizzle が生成する SELECT が落ちる。

### 接続先 Neon 一覧（運用中）

| 業種版 | Neon ホスト | Vercel project |
|---|---|---|
| `real-estate` | `ep-soft-poetry-ao4xdfqm` | bract-crm（メイン本番、稼働中） |
| `auto-body` | `ep-young-meadow-aoo7z9eq` | bract-crm-auto-body（稼働中） |
| `base` | `ep-proud-band-ao22d0oc` | **未設置（将来追加予定）** |

Neon は 3 つとも実在し、`scripts/check-schema-vs-db.ts` で schema 一致を確認済み（base 用 Neon は Vercel project 未作成だが、追加した時に即運用できるよう全マイグレ適用済みの状態を維持する）。

新規業種追加時はここに行を足し、その Neon にも既存マイグレを全部適用してから運用開始する。

### 自動防御（Vercel build フック）

`package.json` の `vercel-build` スクリプトが `npm run check:schema` を実行してから build する。
schema.ts に宣言したカラムが対象 Neon に存在しない場合、build が exit 1 で失敗してデプロイがブロックされる。

```json
"vercel-build": "tsx scripts/check-schema-vs-db.ts && next build --webpack"
```

ローカルで Vercel 相当のチェックを走らせる場合:

```bash
npm run check:schema   # tsx scripts/check-schema-vs-db.ts
```

`.env.local` の `DATABASE_URL` が指す DB に対して diff を取る。複数 Neon を確認するには `.env.local` を差し替えて繰り返し実行（または将来 multi-DB 対応に改造）。

### マイグレ追加〜デプロイの手順

新しい `supabase/migrations/<timestamp>_<name>.sql` を追加する時:

1. SQL を書く（必ず冪等）
2. schema.ts を同時に更新（カラム追加 / 新テーブル）
3. ローカルから **全 Neon に順次適用**:
   ```bash
   # 各業種の .env.local に差し替えながら
   npx tsx scripts/snapshot-db.ts                          # 事前バックアップ
   npx tsx scripts/apply-migration.ts <path-to-sql>        # 適用
   npm run check:schema                                    # 検証
   ```
4. main にマージ → Vercel が各業種版を再デプロイ。`vercel-build` の check:schema が再度走り、漏れがあれば deploy が止まる
5. 本番実機で対応ページの動作確認

## worktree 慣習

### 業種別の常駐 worktree（必読）

**並行開発で `.env.local` を取り違える事故を防ぐため**、業種ごとに専用の常駐 worktree を1つずつ持つ。新規会話/作業はここから派生させる。

| worktree | branch | `.env.local` の DATABASE_URL | 用途 |
|---|---|---|---|
| `.claude/worktrees/re-base` | `worktree/re-base` | real-estate Neon (`ep-soft-poetry-ao4xdfqm`) | 不動産関連の作業の起点 |
| `.claude/worktrees/ab-base` | `worktree/ab-base` | auto-body Neon (`ep-young-meadow-aoo7z9eq`) | 板金関連の作業の起点 |

これら自体は **マージしない駐車場ブランチ**。常駐 worktree の中で:

```bash
cd .claude/worktrees/re-base    # or ab-base
git fetch origin
git switch -c feature/<name> origin/develop   # ここから feature を切る
# 作業 …
```

`.env.local` は worktree 専用に保存されているので、業種を意識せずに `npm run dev` / `npm run check:schema` / migration 適用が正しい DB に向く。

### 一時 worktree（feature ごと）

短期作業は別 worktree を切る:
```bash
git worktree add -b feature/<name> .claude/worktrees/<name> origin/develop
# 作業後に削除（.env.local 等の untracked が残る場合は --force）
git worktree remove --force .claude/worktrees/<name>
```

`.env.local` は 常駐 worktree からコピーする（業種を取り違えないため）:
```bash
cp ../re-base/.env.local .env.local   # or ab-base/.env.local
```

### 新しい会話を開始する時のチェックリスト

1. **どの業種の作業か** を最初に宣言する
2. その業種の常駐 worktree（`re-base` or `ab-base`）に `cd` する
3. `git fetch origin && git switch -c feature/<name> origin/develop` で feature を切る
4. 作業中も他の会話が同じ feature を触っていないか `git ls-remote` などで適宜確認する

### worktree クリーンアップ運用（必読）

`git worktree list` が常時 5〜7 個に収まることを目安にする。それ以上に膨れると業種混同・古い `.env.local` の取り違え事故のリスクが高まる。

**保持すべき worktree（常時 4〜5 個）**:

| worktree | 役割 |
|---|---|
| `OriginalCRM` (parent) | メイン作業ディレクトリ、`main` |
| `.claude/worktrees/re-base` | 不動産業の常駐 |
| `.claude/worktrees/ab-base` | 板金業の常駐 |
| `.claude/worktrees/auto-body-lv` | `develop` 用作業 worktree |
| `.claude/worktrees/<進行中の作業>` | 進行中の feature/fix/chore 1〜2 個 |

**会話 / 作業終了時に削除すべき worktree**:

- `claude/<adjective-name-hash>` 系 — Claude Code が自動生成した一時 worktree
- `feature/*` / `fix/*` / `chore/*` で **main にマージ済み** のもの（remote ブランチも削除済みなら同時に worktree も削除）

**削除手順**:

```bash
# 1. 該当 worktree に未コミット / 未 push の変更が無いか確認
cd .claude/worktrees/<name>
git status                            # working tree clean が望ましい
git log @{u}..HEAD                    # 未 push commit が無いことを確認

# 2. 親リポに戻って削除
cd ../../..
git worktree remove .claude/worktrees/<name>

# 3. untracked files (.env.local, .claude/launch.json, build artifact 等) で
#    削除拒否された場合は内容を確認したうえで --force
git worktree remove --force .claude/worktrees/<name>
```

**削除前に内容を救出するべき判断基準**:

- `docs/` 配下の untracked ドキュメント → 過去事例: crazy-greider-96ddc3 に法務ドラフト 7 ファイルが放置されていた (Issue #21 で救出)
- `scripts/` 配下の untracked ユーティリティスクリプト → 再利用可能なら main にコミット検討
- `.env.local` → 削除する（git 管理外、業種を取り違える原因）

**運用タイミング**:

- 各セッション終了時に `git worktree list` を確認、不要なものを整理
- 月 1 回程度で全体棚卸し（10 個超えていたら警告）

詳細: [Issue #10](https://github.com/takng-cb/Bract-CRM/issues/10)

## 機能追加・修正時の検証チェックリスト（必読）

main へマージする前に以下を必ず通す。Issue #5 / #6 / #7 のような本番障害（手動検証だけでは検出できなかったクラスのバグ）の再発防止のため、機械的に確認する。

### 1. ローカル静的検証

- [ ] **schema↔DB 整合**: 3 Neon すべてに対して `npm run check:schema` を pass する
  ```bash
  # .env.local を順に差し替えて実行（re-base / ab-base / bract-base）
  npm run check:schema
  ```
- [ ] **3 業種ビルド**: 共通機能の修正は 3 業種すべてでビルド成功すること
  ```bash
  NEXT_PUBLIC_INDUSTRY=base        npm run build
  NEXT_PUBLIC_INDUSTRY=real-estate npm run build
  NEXT_PUBLIC_INDUSTRY=auto-body   npm run build
  ```
  業種特化機能の修正は最低でも該当業種 + base の 2 通り。
- [ ] **ユニットテスト**: `npm run test` が pass する（Vitest、ロジック層）

### 2. Vercel deploy 後の実機検証

main マージ後、Vercel の deploy ステータスが緑になったことを確認してから、影響範囲に応じて以下ページを Chrome で目視確認する。

#### 共通機能（base / real-estate / auto-body すべての修正）

- [ ] `/dashboard` — KPI / 期間内ToDo / 期間内活動 / 最近のレコード描画
- [ ] `/accounts` 一覧 + 任意レコードの詳細ページ
- [ ] `/contacts` 一覧 + 任意レコードの詳細ページ
- [ ] `/opportunities` 一覧 + 任意レコードの詳細ページ
- [ ] `/activities` 一覧 + 任意レコードの詳細ページ
- [ ] `/tasks` 一覧 + 任意レコードの詳細ページ
- [ ] `/forecast` — Recharts のグラフ描画

#### real-estate 特化機能の修正時に追加で確認

- [ ] `/properties` 一覧 + 任意物件の詳細
- [ ] 商談詳細の **不動産情報セクション**（取引区分・仲介手数料・仲介種別・その他利益）
- [ ] 商談詳細の **財務サマリー**（想定売上・粗利の自動計算）
- [ ] 仲介手数料の自動計算が UI 上で正しく動く（売買 3% + 6 万円式、賃貸の月額換算）

#### auto-body 特化機能の修正時に追加で確認

- [ ] `/vehicles` 一覧 + 任意車両の詳細
- [ ] `/parts` 一覧 + 任意部品の詳細
- [ ] 商談詳細の **自動車整備情報セクション**（サービス区分・対象車両・部品仕入原価）
- [ ] 商談詳細の **財務サマリー**（amount − parts_cost の利益計算）

### 3. 検証結果の記録

- 不具合 Issue を Close する際は、最終コメントに **「本番 Vercel の deploy 緑確認 + 該当ページの Chrome 確認」を必ず書く**
- スクリーンショット添付は任意だが、UI 変更を伴う修正では推奨

## Issue 運用（必読）

このリポジトリで発生した不具合・障害・運用トラブルは、**修正コミットの前に GitHub Issue を立てる**。
Issue は「何が起きたか」と「なぜ起きたか・どう直したか」を記録するログとして扱う。

### 起票タイミング

- 本番（Vercel デプロイ後）または開発中に「期待と異なる挙動」を検知したら、まず Issue を作る
- 軽微なバグでも起票する（後から検索可能にする）
- ユーザー（プロジェクトオーナー）から口頭で報告された不具合も Issue 化する

### 必須記載項目

```markdown
## 症状（What）
- 影響範囲: <production の業種 / 環境 / ブランチ>
- 再現手順: <URL や操作>
- 期待する挙動: ...
- 実際の挙動: ...

## 原因（Why）
- 根本原因の説明
- 関連コミット / PR / 変更点
- なぜそれが見過ごされたか（プロセス上の問題があれば）

## 修正（How）
- 採用した解決策
- 影響を受けるファイル / 設定 / DB

## 検証（Test results）
- ローカルビルド / TypeScript チェックの結果
- DB 検証クエリの結果（スキーマ系の場合）
- 実機検証（Chrome MCP 等）の結果スクリーンショットや確認ページ一覧

## 副次タスク
- [ ] 関連する追加クリーンアップ
- [ ] ドキュメント / runbook 更新
```

### ライフサイクル

1. **Open**: 検知時に立てる。タイトルは命令形ではなく症状ベース（例: `物件詳細で同じ情報が二重表示される`）
2. **In progress**: 修正コミットがあるブランチ作成時に Issue 本文へリンク
3. **Closed**: 修正が main にマージされ、本番で検証通過後に閉じる。閉じるコメントに **検証結果と本番反映確認** を残す

PR / Commit メッセージで `Fixes #123` を書けば main マージ時に自動 close。手動 close でも構わないが、その場合も検証コメントを残す。

### gh CLI 例

```bash
# 起票（Windows 環境では gh のフルパスを使うことがある）
gh issue create --title "..." --body-file ./body.md
# 検証コメント追加して close
gh issue close 123 --comment "本番で /opportunities/<id> 表示確認。スクリーンショット添付。"
```

## リリース判定 go/no-go チェックリスト（必読）

正式リリース（顧客サブスク開始）の前に必ず確認。Issue #40 を umbrella として運用。

### 必須（NoGo 条件：1 つでも未達ならリリース見送り）

#### コード品質
- [ ] **priority:blocker Issue がゼロ**
- [ ] **CI 全 green**:
  - [ ] `lint` (ESLint)
  - [ ] `test` (Vitest 全件 pass)
  - [ ] `build` (base / real-estate / auto-body の 3 業種)
  - [ ] `schema-check` (3 Neon すべてで pass)
  - [ ] `smoke` (本番 32 ページ 200 / redirect 確認)
  - [ ] `secret-leak-check` (公開 HTML/JS に秘匿情報なし)
- [ ] **Playwright E2E** 主要シナリオ全 pass (#18)
  - [ ] auth.setup.ts で 3 ロール分の storageState 生成成功
  - [ ] smoke-authenticated.spec.ts (admin で 9 シナリオ)
  - [ ] accounts-crud.spec.ts (CRUD 完全フロー)
  - [ ] real-estate 業種シナリオ（仲介手数料計算）
  - [ ] auto-body 業種シナリオ（利益計算）

#### 運用
- [ ] **法務ドキュメント (`docs/legal/`) 弁護士レビュー完了** (#21)
- [ ] **バックアップ運用稼働中** (#24)
  - [ ] 日次 dump スクリプトが GitHub Actions schedule で動いている
  - [ ] 月 1 restore リハーサル成功
- [ ] **障害連絡経路確立** (#23)
  - [ ] SLA 数値合意
  - [ ] 顧客→開発者の通報窓口開設
- [ ] **Vercel deploy 失敗通知運用中** (#25)

#### セキュリティ
- [ ] Server Action 権限チェック網羅レビュー完了（Sprint 1-3a で実施）
- [ ] `npm audit` で high severity ゼロ
- [ ] テストユーザー credentials (`TEST_USER_PASSWORD`) が GitHub Secrets に登録

### 推奨（リリース時に未達でも判断次第で可）

- [ ] **Phase 5 モバイル UX 主要シナリオ pass** (#27)
- [ ] **Lighthouse スコア 80 以上** (主要 4 ページ、Sprint 3 で計測基盤整備)
- [ ] **バンドルサイズ baseline 記録済み** (`npm run bundle:report` で)
- [ ] **Status ページ稼働** (Statuspage.io / Better Uptime / 自前)
- [ ] **オンボーディングフロー整備** (#22)
- [ ] **Stripe 連携** (#16、収益化前提)
- [ ] **Neon compute hour 監視** (#17)

### 判定プロセス

1. リリース候補日の **1 週間前** に本チェックリストを走らせる
2. すべて pass なら release tag を切る（`git tag v1.0.0 && git push --tags`）
3. NoGo があれば Issue 化して着手、必須項目が達成されるまで延期

## 詳細リファレンス

- **[docs/architecture.md](./docs/architecture.md)** — 業種オーバーレイ詳細、Vercel 構成、DB スキーマ運用、SQL pushdown 構造、マイグレーション手順、既知の制限
