@AGENTS.md

# Bract 開発の進め方（標準・必読）

> Bract を「CRM 専用」から「CRM/ERP モジュラー・プラットフォーム」へ発展させるための**標準の進め方**。
> 詳細設計は [`docs/erp-architecture.md`](./docs/erp-architecture.md) / [`docs/migration-roadmap.md`](./docs/migration-roadmap.md)、
> 日々の運用ルールは [`AGENTS.md`](./AGENTS.md) を参照。本節はそれらの上位にある「方針」を固定する。

## 1. 基本姿勢：設計ファースト → ストラングラー式の段階実装

1. **設計ファースト**：非自明な変更は、まず `docs/` に設計を書き、合意してから実装する。
2. **ストラングラー式**：大改修は一気にやらず、Phase に割る。**各 Phase は独立して動作確認・リリース可能**にする。
3. **挙動非変更を優先**：基盤導入フェーズは「既存の挙動を変えない」ことを最優先。新旧を併存させ、互換シムで本番を守る。
4. **1 Phase = 1 テーマ = 1 feature ブランチ**。Phase をまたぐ巨大 PR を作らない。

## 2. モジュラー化の設計原則（4 本柱）

| 原則 | 内容 |
|---|---|
| **モジュールファースト** | 機能は `src/modules/<id>/` の自己完結パッケージにする。業種(real-estate 等)も `category:'industry'` のモジュールとして扱う |
| **コントラクトファースト** | 各モジュールは型付き入力コントラクトを持つ。これが「AI 出力制約 / apply 検証 / CSV import / 将来の MCP 化」の共通の真実。**AI は DB を直接触らず draft-then-apply** |
| **ランタイム合成 ＋ ビルドプロファイル** | 同梱モジュール群は `BRACT_BUILD_PROFILE` で粗く（ビルド時）、個別 ON/OFF は `licenses.features.enabled_modules` で細かく（ランタイム・再ビルド不要、上限は `entitled_modules`） |
| **単一テナント維持** | 1社=1デプロイ+1DB を維持。複数社の「重さ」はプロビジョニング自動化と build profile で対処（テナント方式は変えない） |

既存の `src/lib/license/`（`hasFeature`/`ensureFeature`/`getLicense`、`extra_industries:string[]`）を土台に一般化する。**ゼロから作らない**。

## 3. ブランチ／PR 運用（このリポの標準）

- リモート: `https://github.com/takng-cb/Bract.git`（CRM 履歴を統合済み）。**旧 `Bract-CRM` には push しない**。
- フロー: `feature/* | fix/* | chore/*` → `develop` → `main`（既存 AGENTS.md の規約を踏襲）。
- main / develop に直接コミットしない。**default ブランチに居たらまず branch を切る**。
- コミット末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- push / merge は**ユーザーの指示があってから**。

## 4. 各フェーズ完了の検証ゲート（必須）

実装フェーズは main 反映前に下記を緑にする（詳細は AGENTS.md「検証チェックリスト」）:
- `npm run build` を 3 業種 env（`base` / `real-estate` / `auto-body`）で通す
- 既存スモーク・E2E（`scripts/smoke-test.ts`, `npm run test:industry-guard`, `npm run test:e2e`）
- `npm run check:schema`（schema↔DB 整合）
- 業種/モジュール対称確認（AGENTS.md「ペア確認」）

## 5. 現在地と次の一手

- **Phase 0 完了**：リポ複製・設計ドキュメント4本・新リポ統合（main = CRM 全履歴、設計は `feature/erp-modular-design`）。
- **推奨の進め方**：① リポ整備（`develop` 作成・不要ブランチ整理・`.claude/worktrees/` を gitignore）→ ② 設計 PR をマージ → ③ 次セッションで **Phase 1（モジュールレジストリ基盤）** 実装。
- ロードマップ全体は [`docs/migration-roadmap.md`](./docs/migration-roadmap.md)（Phase 0〜8）。
