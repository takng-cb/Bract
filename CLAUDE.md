@AGENTS.md

# Bract 開発の進め方（標準・必読）

> Bract を「CRM 専用」から「CRM/ERP モジュラー・プラットフォーム」へ発展させるための**標準の進め方**。
> 詳細設計は [`docs/erp-architecture.md`](./docs/erp-architecture.md) / [`docs/migration-roadmap.md`](./docs/migration-roadmap.md)、
> 日々の運用ルールは [`AGENTS.md`](./AGENTS.md) を参照。本節はそれらの上位にある「方針」を固定する。

## 0. 進め方は「ループ」で（標準の協働モデル）

一問一答のプロンプトではなく、**ゴールを受け取ったら Claude がループを回す**。ユーザーは **ゴール設定と承認** を担い、Claude は **DISCOVER → PLAN → EXECUTE → VERIFY → ITERATE** を自走する（"write loops, not prompts"）。

1. **DISCOVER**：着手前に現状を実地調査（grep / Read / `check:schema` / 実機 / Issue）。**推測で進めない**。
2. **PLAN**：非自明なら設計を先に（§1 設計ファーストと整合）。**スライスに割り、各スライスを独立リリース可能**に。
3. **EXECUTE**：ブランチを切って実装。**本番反映・本番 DB 変更・外向き/不可逆操作は人間の明示承認を必須**とする（closed-loop ゲート）。
4. **VERIFY**：既存ゲートで自己検証（§4：3 業種ビルド / `check:schema`×3 Neon / smoke 32+ ページ / E2E）。さらに **「作る人」と別に「確認する人」** を立てる（subagent / 別観点での adversarial 検証。例：`/code-review` の finder+verifier）。
5. **ITERATE**：VERIFY で落ちたら DISCOVER に戻る。**緑になるまで回す**。完了したら要点を報告し、長時間・離席時は **通知**（push）。

- **既定は closed-loop**：ゴール・ステップ・終了条件・各ステップの評価を**先に定義**してから回す。品質ゲート無しの開放ループで回さない。
- **single-agent 既定**。複数エージェント（Workflow / 艦隊）は**トークン消費が大きいためユーザー明示の opt-in 時のみ**（"ultracode" 等）。調査・レビューは builder/verifier の**最小 fleet**が有効。
- **外部メモリ**：ループの「何を試した／通った／残り」は `docs/requirements`（REQ/ADR/spec）と GitHub Issues に残す（§3.5 と整合）。毎回ゼロから始めない。
- **「Go 押すだけ」にならない**：ループは理解の代替ではない。判断の根拠（なぜ）を ADR/Issue に残す。

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

## 3.5 要件・決定の記録運用（標準・必読）

要件が出るたびに記録し、新メンバーが経緯を理解できる状態を保つ。記録は **Claude が会話の都度** 行う。

- **出た要件は即** `docs/requirements/requirements-log.md` に `REQ-NNNN` で追記（追記専用・判断せずまず記録＝漏れ防止）。
- **設計判断は** `docs/requirements/decisions.md` に `ADR-NNNN` で追記（**なぜ**を残す。覆す時は新ADRで Supersede）。
- **確定仕様は** `docs/requirements/specs/<module>.md`（生きた仕様）に反映。新メンバーはまずここを読む。
- **元資料**（依頼書等）は `docs/requirements/sources/` に原文保存。
- 役割分担：**GitHub Issues = 作業・不具合**（状態管理）／**docs = 要件・決定・仕様**（恒久の真実）。
- commit / PR / Issue 本文に `REQ-`/`ADR-`/`#Issue` を書いて**トレーサビリティ**を保つ。
- 詳しい運用は [`docs/requirements/README.md`](./docs/requirements/README.md)。

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
