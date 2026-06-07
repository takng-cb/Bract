# Bract（統合版）デプロイ手順書 — 実サーバーで動かす

> 「Bract」＝ `github.com/takng-cb/Bract` の統合版（CRM 全履歴 ＋ ERP モジュラー設計）。
> ホスティングは既存と同じ **Vercel + Neon(Postgres) + Supabase(Auth/Storage)**。1社 = 1 Vercel project + 1 Neon DB（ADR-0003）。
> 関連：`docs/requirements/specs/staffing.md`, `docs/erp-architecture.md`, ADR-0013(Gemini鍵)。

---

## 0. 全体像（何がどこで動くか）

```
GitHub: takng-cb/Bract (main)
        │  push
        ▼
Vercel project（業種ごとに1つ）── env: NEXT_PUBLIC_INDUSTRY, DATABASE_URL, SUPABASE_*, GEMINI_API_KEY …
        │  ビルド & 配信
        ▼
ブラウザ（利用者）  ──認証──▶ Supabase Auth（全 project 共有）
        │
        ▼
Neon Postgres（project ごとに別 DB）
```

- 既存本番（**触らない**）：real-estate（`bract-crm`／Neon `ep-soft-poetry-ao4xdfqm`）、auto-body（`bract-crm-auto-body`／`ep-young-meadow-aoo7z9eq`）。
- **base 用 Neon `ep-proud-band-ao22d0oc` は作成済み・全マイグレ適用済みだが Vercel project が未設置** → ここを「統合版 Bract を最初に実サーバーで動かす」受け皿にするのが最短・最も安全（本番2つに無影響）。

---

## 1. 推奨：まず統合版を「base」として1つ実サーバーに立てる

目的：統合版リポが本番同等の環境で正しく動くことを、**既存2本番に触れず**に確認する。

| 項目 | 値 |
|---|---|
| リポ | `takng-cb/Bract` |
| Production Branch | `main`（設計PRをマージ後）／検証だけなら Preview で `feature/erp-modular-design` でも可 |
| 新規 Vercel project 名 | 例：`bract`（または `bract-base`） |
| `NEXT_PUBLIC_INDUSTRY` | `base` |
| DB（DATABASE_URL） | base Neon `ep-proud-band-ao22d0oc` |
| Supabase | 既存プロジェクトを再利用（URL/anon key） |
| Gemini | base では不要（staffing で使用） |

> staffing（人材手配）の実サーバー化は、Phase 1〜の機能ができてから **別 project** で行う（§4）。

---

## 2. 手順（クリック単位）

### 2-1. 事前に手元で最終確認（任意・推奨）
```bash
cd Bract_ERP
npm install
NEXT_PUBLIC_INDUSTRY=base npm run build      # ローカルでビルドが通ること（確認済み）
# 実DBにつないで動かすなら：
cp .env.local.example .env.local             # or 既存 .env.local を base 用に用意
npm run check:schema                          # .env.local の DATABASE_URL=base Neon に対して整合確認
npm run dev                                    # http://localhost:3000 で表示確認
```

### 2-2. Vercel に新規 project を作成
1. Vercel ダッシュボード → **Add New → Project**。
2. GitHub の `takng-cb/Bract` を **Import**（初回は GitHub 連携の許可が必要）。
3. Framework は Next.js が自動検出。**Build Command** は既定（`vercel-build` が使われる＝`check:schema` → `next build`）。
4. **Production Branch** を `main` に設定（Settings → Git）。

### 2-3. 環境変数を登録（Settings → Environment Variables → Production）
§5 の表のとおり登録。`NEXT_PUBLIC_INDUSTRY=base`、`DATABASE_URL`=base Neon、Supabase キー等。
登録は **一度きり**（以降のビルドで自動利用。ADR-0013）。

### 2-4. デプロイ
- env 登録後に **Deploy**（または Deployments → Redeploy、Environment=Production を明示）。
- `vercel-build` 内の `check:schema` が走り、schema↔DB 不整合があればここで **ビルドが止まる**（安全装置）。

### 2-5. 動作確認（実機）
- 発行された URL で `/login` → ログイン → `/dashboard` 表示。
- `/accounts` `/contacts` `/opportunities` `/activities` `/tasks` の一覧・詳細が表示されること。
- 確認結果は Issue か `docs/requirements/` に記録（標準）。

---

## 3. 私（Claude）ができること / あなたにお願いすること

| 区分 | 内容 |
|---|---|
| Claude が用意 | コード・`.env.example`・マイグレーション・seed・ローカルビルド/`check:schema` 検証・本手順書 |
| Claude が代行可（希望時） | ブラウザ操作 MCP で Vercel/Neon/Supabase 画面の設定を**一緒に**進める（あなたがログイン済みの前提） |
| あなたが実施 | 各クラウドのアカウント/課金、GitHub→Vercel 連携の許可、**Gemini API キーの取得・登録**、最終的な Production 反映の承認 |

> シークレット（DATABASE_URL / Supabase service key / GEMINI_API_KEY）は **Vercel と `.env.local` のみ**に置き、リポジトリにコミットしない。

---

## 4. staffing（人材手配）を実サーバー化する場合（後日）

Phase 1〜の機能完成後に、**新しい Vercel project** で：

| 項目 | 値 |
|---|---|
| project 名 | 例：`bract-staffing` |
| `NEXT_PUBLIC_INDUSTRY` | `staffing` |
| DB | 人材手配の顧客専用 Neon（新規作成 → 全マイグレ適用） |
| `GEMINI_API_KEY` | 先方提供の鍵（env 固定・ADR-0013） |
| Supabase | 既存 or 専用（運用方針による） |

新規 Neon の立ち上げ手順は §6（プロビジョニング）。

---

## 5. 環境変数一覧

| 変数 | 必須 | 用途 | 例/備考 |
|---|---|---|---|
| `NEXT_PUBLIC_INDUSTRY` | ✅ | 業種選択（base/real-estate/auto-body/staffing） | ビルド時固定 |
| `DATABASE_URL` | ✅ | Neon 接続 | project ごとに別 DB |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Auth | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase Auth（公開可） | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | サーバー側の管理操作 | **サーバー専用・非公開** |
| `GEMINI_API_KEY` | staffing | AI 解析（サーバー専用） | ADR-0013。base では不要 |
| `AI_FEATURE_ENABLED` | 任意 | AI 機能の kill switch | |
| `CRON_SECRET` | 任意 | （将来）リマインド Cron 用 | 現状リマインドは MVP 外（ADR-0011） |

> 正確なキー名は `.env.example` を正とする。差異があれば `.env.example` に合わせる。

---

## 6. 新規顧客のプロビジョニング（多社展開時の運用）

1. **Neon project 作成**（顧客専用 DB）。
2. **スキーマ投入（新規・空DBのブートストラップ）**：`.env.local` の `DATABASE_URL` を当該 Neon に向ける。
   **実証済みの手順**＝「schema.ts から完全DDLを生成 → 適用」：
   ```bash
   # (a) schema.ts から完全DDLを生成（DB非接続）。out を一時フォルダにする一時configを使う
   #     drizzle.config.ts の out を './.drizzle-tmp' にした config を用意して:
   npx drizzle-kit generate --config <tmp-config>      # → .drizzle-tmp/0000_*.sql（全41テーブル）
   # (b) 空DBに適用（プロジェクト標準スクリプト。HTTPクエリで動作）
   npx tsx scripts/apply-migration.ts .drizzle-tmp/0000_*.sql
   # (c) 整合確認（緑になればOK）
   npm run check:schema
   ```
   - ⚠️ **`drizzle-kit push` は使えない**：本リポの DB ドライバは `@neondatabase/serverless`(neon-http) で、
     drizzle-kit の introspect が websocket を要求し「Pulling schema…」でハングする。上記 generate→apply で代替する。
   - ⚠️ **`supabase/migrations/*.sql` を空 Neon に流さない**：先頭の `init.sql` が Supabase の
     `auth.users` を参照しており、素の Neon では `schema "auth" does not exist` で失敗する。
     また `drizzle/*.sql` の履歴も不完全（vehicles/parts/relationship_* 等が欠落）で、単体では schema.ts を再現できない。
     → だから **generate（schema.ts が唯一の真実）→ apply** が正解。
   - 既存 DB への**増分**変更のみ、新規マイグレファイルを `scripts/apply-migration.ts` で適用（冪等に書く）。
3. **マスタ/ライセンス seed**（業種オブジェクト定義など。`scripts/seed-*.ts`）。
4. **Vercel project 作成** → §2-2〜2-4（env をその顧客向けに設定）。
5. **初期ユーザー招待**（Supabase Auth）＋ロール付与。
6. **動作確認** → 引き渡し。

> 社数が増えても手作業が増えないよう、将来この手順を1スクリプト化する（migration-roadmap Phase6）。

---

## 7. ロールバック / 注意

- env 変更（特に `NEXT_PUBLIC_*`）は **再ビルドしないと反映されない**。Redeploy 時は Environment=Production を明示。
- 既存2本番（real-estate/auto-body）は当面 **旧リポ運用のまま**。統合版へ寄せる判断は別途（ADR-0014）。
- 問題時は Vercel の前デプロイへ Rollback（Deployments → 該当 → Promote/Rollback）。
