# Bract — CRM/ERP モジュラー化 段階移行ロードマップ

> 既存3業種の本番を壊さずに、業種オーバーレイ → モジュラー・プラットフォームへ移行するための **ストラングラー方式**ロードマップ。
> 設計の中身は [`docs/erp-architecture.md`](./erp-architecture.md) を参照。

## 原則
- 各 Phase は **独立して動作確認可能**。途中で止めても本番は壊れない。
- 既存業種は **互換シム**（`modules` 未設定時は `activeIndustry` から導出）で無影響に保つ。
- 各 Phase の完了条件：`npm run build`（3業種 env）／既存スモーク・E2E（`scripts/smoke-test.ts`, `test:industry-guard`, `npm run test:e2e`）／`npm run check:schema` が緑。

---

## Phase 0 — 複製 & 設計ドキュメント化 ✅（本セッション・設計のみ）
- [x] `OriginalCRM` → `Bract_ERP` 複製（`.git` 含む、`node_modules`/`.next` 除外）。
- [x] 設計ドキュメント作成：
  - [x] `docs/erp-architecture.md`
  - [x] `docs/module-catalog.md`
  - [x] `docs/ai-input-assistant.md`
  - [x] `docs/migration-roadmap.md`（本書）
- [ ] **要対応（次アクション）**：git remote が本番 CRM（`takng-cb/Bract-CRM`）を指すため、
      Bract_ERP 用の新規リポ作成 or 別ブランチ運用へ切替（pushはユーザー指示後）。
- [ ] 健全性確認：`npm install && npm run build`（3業種 env）が OriginalCRM 同様に通ること。
- **この時点でコード挙動は OriginalCRM と完全同一**（ドキュメント追加のみ）。

---

## Phase 1 — モジュールレジストリ基盤（挙動非変更）
- `src/lib/modules/types.ts`：`ModuleManifest` / `NavItemDef` / `ObjectSeed` / `ContractRef`。
- `src/lib/modules/registry.ts`：`MODULE_REGISTRY`・`getEnabledModules`・`isModuleEnabled`・`ensureModuleEnabled`。
- `src/lib/license/types.ts` に `LicenseFeatures.entitled_modules?` / `enabled_modules?: string[]` 追加（上限と表示の分離。erp-architecture §8.1）。`getLicense` は流用。
- **既存業種を industry モジュールとして登録するだけ**（コードは移動しない）。
- 互換シム：`modules` 未設定 → 現行 `activeIndustry` から有効集合を導出 → 本番無影響。
- `/admin/modules` を**読み取り専用ビュー**で新設（現状を可視化）。
- 完了条件：上記＋有効モジュール集合が現行業種と一致することの単体テスト。

## Phase 2 — ゲーティングをランタイム化
- `src/app/(crm)/<route>/page.tsx` の `if (activeIndustry !== …) notFound()` → `isModuleEnabled(…)` へ置換。
- `src/lib/navItems.ts` を async 化、`src/app/(crm)/layout.tsx` のサイドバー生成を `getEnabledModules()` 駆動に。
- `next.config.ts` の industry redirect を縮退（同梱範囲は実行時ゲート）。
- **受け入れ基準**：`licenses.features.enabled_modules` を DB で書き換える → **再ビルドせず**サイドバー項目とページ可否が変わる。
- `/admin/modules` を**トグル可能**化（依存解決・警告つき）。

## Phase 3 — ビルドプロファイル導入
- `BRACT_BUILD_PROFILE`（`crm` / `crm+erp` / `all`）を `registry.ts` で読み、同梱カテゴリを制御。
- プロファイル外モジュールは登録除外＋ proxy で `notFound()`。重いモジュールは `dynamic import` に統一。
- 完了条件：`crm` プロファイルで ERP/業種コードがバンドルに入らないこと（`npm run bundle:report` で確認）。

## Phase 4 — 既存業種を `src/modules/` へ物理移設
- `src/industries/{real-estate,auto-body,staffing}` → `src/modules/` へ移動、import パス更新。
- `src/lib/industry.ts` は互換 re-export として薄く残置。
- 完了条件：3業種 env でビルド緑＋ E2E 緑（リファクタのみ・挙動不変）。

## Phase 5 — CRM コアをモジュール分割
- base CRM を `crm-core` / `sales` / `expenses` に整理（ルート据え置き、所属だけ定義）。
- 各モジュールに `contracts.ts` の雛形を用意（Phase 7 への布石）。

## Phase 6 — スキーマ分離（"Option 2"）& 複数社運用整備
- per-module schema 登録、業種/モジュール拡張テーブル分離（`opportunities_*_ext` 等。`docs/architecture.md` 参照）。
- **プロビジョニング自動化スクリプト**：新規社の Neon 作成 → 全マイグレ適用 → Vercel project → モジュール seed を半自動化。
- 完了条件：新規社を1コマンド近くで立ち上げられる。

## Phase 7 — ERP 第1弾 `inventory` ＋ AI 入力補助 L1
- `src/modules/inventory/`：products / warehouses / stock_movements のスキーマ・ページ・actions・contracts。
- **CRM/ERP 混在の組み合わせ**（例：`crm-core + sales + inventory`）を1デプロイで実証。
- AI 入力補助 L1（[`docs/ai-input-assistant.md`](./ai-input-assistant.md)）：
  - コントラクト DSL 確定 → 「名刺/議事録 → CRM レコード生成」を既存 import 経路で PoC。
- 完了条件：チャット入力 → プレビュー → 承認 → DB 反映の一連が動く。

## Phase 8 以降 — ERP 拡充 / AI 拡張
- `accounting` / `purchasing` / `sales-order` / `hr` を順次追加。
- AI L2（MCP 公開）・L3（自律）の検討は、L1 のコントラクト群が揃ってから。

---

## 依存関係（Phase 間）
```
Phase 0 ─→ 1 ─→ 2 ─→ 3 ─→ 4 ─→ 5 ─┬─→ 6 ─→ 7 ─→ 8…
                                    └─ (7 の inventory は 6 の後が望ましいが、
                                        スキーマ統合のままなら 6 と並行可)
```

## 進め方メモ
- 1 Phase = 1 feature ブランチ（既存運用：feature → develop → main）。
- 既存の検証チェックリスト（`AGENTS.md`）を各 Phase で踏襲。
- Issue 運用も既存どおり（症状/原因/修正/検証/副次タスク）。
