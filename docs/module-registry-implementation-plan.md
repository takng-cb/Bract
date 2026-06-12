# 実装計画：モジュールレジストリ ＋ ブック（旧オブジェクト）＋ モジュール基準UI

> #10（レジストリ）/ #11（ランタイム・ゲーティング＋/admin/modules）/ #21（オブジェクト→ブック）/ #22(#REQ-0015)（モジュール基準UI）の**統合実装計画**。
> 前提決定：ADR-0001/0002/0005/0016/0017/0018/0019。語彙＝**モジュール > ブック > レコード**。
> 進め方は CLAUDE.md（設計ファースト→ストラングラー）。各段階で 3業種ビルド＋check:schema＋E2E 緑を維持。

## 0. ゴール
- 「モジュール」を第一級概念にし、各**ブック（旧オブジェクト）は所属モジュール**を持つ。
- 機能ON/OFF はランタイム（`licenses.features.enabled_modules`、上限 `entitled_modules`）。
- UI（サイドバー）は **モジュール見出し > 配下ブック** で構成。
- 既存業種(real-estate/auto-body/staffing)・CRMコア・営業を最初の登録モジュールにする。

## 1. データモデル（ADR-0018/0019 準拠）
- ブック定義（旧 `object_definitions`）に `owning_module text` を追加。
- 項目定義（`book_fields`、旧 `field_definitions`）に `owning_module text` を追加（拡張項目の所有。例：商談の不動産項目=real-estate）。
- `licenses.features` に `entitled_modules?: string[]` / `enabled_modules?: string[]`。
- いずれも nullable/default で base 無害化、冪等マイグレ、全 Neon 適用、`check:schema` 緑。

## 2. レジストリ基盤（#10・挙動非変更で先行可能）
新規（追加のみ・既存挙動を変えない）:
```
src/lib/modules/types.ts      ModuleManifest / NavItemDef / BookRef / ContractRef
src/lib/modules/registry.ts   MODULE_REGISTRY, getEnabledModules(), isModuleEnabled(), ensureModuleEnabled()
src/modules/<id>/manifest.ts  各モジュール宣言（id/category/dependsOn/navItems/books）
```
- `getEnabledModules()`：`licenses.features.enabled_modules` ∩ `entitled_modules` ∩ ビルドプロファイル ＋ **dependsOn 解決**（ADR-0019-2）。
- 互換シム：`enabled_modules` 未設定なら現行 `activeIndustry` から導出 → 本番無影響。
- license 機構（`getLicense`/`hasFeature`）はそのまま土台に利用。

### 初期マニフェスト（最小）
| module | category | dependsOn | books |
|---|---|---|---|
| crm-core | crm | — | accounts, contacts, activities, tasks |
| sales | crm | crm-core | opportunities, (forecast/receivables) |
| expenses | crm | crm-core | expenses |
| real-estate | industry | crm-core, sales | properties (+商談の不動産項目) |
| auto-body | industry | crm-core, sales | vehicles, parts, part_movements, maintenance_* |
| staffing | industry | crm-core, sales | staff, assignments, (outreach/invoices) |

## 3. ゲーティングのランタイム化（#11）
- `src/app/(crm)/<route>/page.tsx` の `if (activeIndustry !== …) notFound()` → `if (!(await isModuleEnabled(<owningModule>))) notFound()`。
- Server Action 冒頭に `ensureModuleEnabled(<module>)`。
- `/admin/modules`：トグル（`requireAdmin` + 入力ホワイトリスト + `entitled` 上限 + `audit_log`）。判定は**必ずサーバー側**（ADR-0005/§8）。

## 4. モジュール基準 UI（#22 / REQ-0015）
- `src/lib/navItems.ts` を async 化し `getEnabledModules()` 駆動に。
- サイドバーを **モジュール見出し（折りたたみ）> 配下ブックのリンク** で描画（`(crm)/layout.tsx`）。
- 並び順/表示はモジュール→ブックの2階層。将来 #22 のユーザー別カスタムへ拡張。
- 安全策：まず PR ブランチで実装し、3業種ビルド＋実機確認の後に develop→main。

## 5. オブジェクト→ブック 全面リネーム（#21・ADR-0017/0018）
**段階移行（破壊を避ける）**：
1. DB：`book_definitions`/`book_records` 等へリネーム（`ALTER TABLE … RENAME`）。冪等化が難しいので**一方向マイグレ**＋全 Neon 適用＋スナップショット必須。
2. コード識別子：`object_definitions`→`book_definitions`、`customRecords`→`bookRecords` 等を機械置換（型・import 一括）。
3. ルート：`/objects/*`→`/books/*`、`/admin/objects`→`/admin/books`。**旧ルートは一定期間 301/302 redirect**（`next.config.ts`）。
4. UI 文言：「オブジェクト」→「ブック」、「レコード」「項目」は据え置き。
5. 検証：3業種ビルド＋check:schema＋E2E＋スモーク（旧URL redirect 確認）。
- **大規模・破壊的なため単独 PR**。レジストリ(#10)を先に新名称で書ければ手戻り減（ADR-0017）。

## 6. 推奨順序（ストラングラー）
```
A. レジストリ基盤 #10（追加のみ・挙動非変更）        ← 低リスク・先行可
B. モジュール基準 nav #22（PRで実機確認後にmerge）    ← 体感が変わる
C. ゲーティングのランタイム化 #11 + /admin/modules    ← 再ビルド不要ON/OFFが動く
D. オブジェクト→ブック 全面リネーム #21（単独PR）      ← 破壊的・要バックアップ
E. 既存業種を src/modules へ物理移設 #13
F. ERP 第1弾 inventory（#9配下）
```
> A は本計画と同時に**追加実装済みの叩き台**を `feature/module-registry` に用意（未マージ・要レビュー）。

## 7. 検証ゲート（各段階）
- `NEXT_PUBLIC_INDUSTRY=base|real-estate|auto-body npm run build`
- `npm run check:schema`（dev Neon）/ `npm run test` / E2E / smoke
- 業種/モジュール対称確認（AGENTS.md）
