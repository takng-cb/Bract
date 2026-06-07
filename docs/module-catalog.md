# Bract — モジュール・カタログ

> モジュールの一覧・カテゴリ・依存関係・担当ルート・対象テーブルの台帳。
> 設計の全体像は [`docs/erp-architecture.md`](./erp-architecture.md) を参照。

## カテゴリ

| カテゴリ | 説明 | ビルドプロファイルでの扱い |
|---|---|---|
| `platform` | 認証・管理・メタ定義など全社必須の基盤 | 常時同梱・常時 ON（トグル不可） |
| `crm` | 顧客管理の中核 | 既定で同梱 |
| `erp` | 基幹業務（在庫・会計・購買・受発注・人事） | `crm+erp` / `all` プロファイルで同梱 |
| `industry` | 業種特化（既存3業種を吸収） | 契約業種に応じて同梱 |

## ビルドプロファイル（粗い同梱範囲）

| プロファイル | 同梱カテゴリ | 想定顧客 |
|---|---|---|
| `crm` | platform + crm | CRM のみ利用 |
| `crm+erp` | platform + crm + erp | CRM + 基幹業務 |
| `all` | 全カテゴリ（業種含む） | 業種特化込みフルセット |

> プロファイル内の個別モジュール ON/OFF は **ランタイム**（`licenses.features.enabled_modules`、上限は `entitled_modules`）で制御。

---

## モジュール一覧

### platform（常時有効）

| id | 名称 | 主な対象 | 既存ルート |
|---|---|---|---|
| `platform-core` | 基盤 | auth / users / 監査ログ / 通知 / ライセンス | `/admin/*`, `/auth/*` |
| `custom-objects` | カスタムオブジェクト | object_definitions / field_definitions / relationships / custom_records | `/objects/*`, `/admin/objects`, `/admin/relationships` |
| `tags` | タグ | tags / taggables | `/tags` |
| `ai-assist` | AI 入力補助 | コントラクト駆動の draft-then-apply（§ai-input-assistant） | `/admin/ai`, 各フォームのAIボタン |

### crm

| id | 名称 | 含む機能 | 既存ルート | 依存 |
|---|---|---|---|---|
| `crm-core` | CRM コア | 取引先(accounts) / 人物(contacts) / 活動履歴(activities) / ToDo(tasks) | `/accounts` `/contacts` `/activities` `/tasks` | — |
| `sales` | 営業 | 商談(opportunities) / 売上予測(forecast) / 売掛金(receivables) | `/opportunities` `/forecast` `/receivables` | crm-core |
| `expenses` | 経費 | 経費管理(expenses) | `/expenses` | crm-core |

### erp（新規）

| id | 名称 | 主な対象テーブル（新規） | 想定ルート | 依存 |
|---|---|---|---|---|
| `inventory` | 在庫管理 | products / warehouses / stock_movements | `/inventory/*` | crm-core |
| `accounting` | 会計 | journals / ledger / invoices / payments | `/accounting/*` | sales |
| `purchasing` | 購買 | suppliers / purchase_orders / goods_receipts | `/purchasing/*` | inventory |
| `sales-order` | 受発注 | sales_orders / shipments | `/sales-orders/*` | sales, inventory |
| `hr` | 人事 | employees / attendance / payroll | `/hr/*` | crm-core |

> ERP 第1弾 PoC は **`inventory`**（CRM の取引先・商品と自然に繋がり、ERP の入口として分かりやすい）。

### industry（既存3業種を吸収）

| id | 名称 | 主な対象テーブル | 既存ルート | 依存 |
|---|---|---|---|---|
| `real-estate` | 不動産 | properties + opportunities 拡張(取引区分/仲介手数料 等) | `/properties/*` | crm-core, sales |
| `auto-body` | 板金・自動車整備 | vehicles / customer_vehicles / maintenance_* / parts / part_movements | `/vehicles` `/maintenance/*` `/parts` `/customer-vehicles` | crm-core, sales |
| `staffing` | 人材派遣 | staff / assignments / assignment_staff | `/staff` `/assignments` | crm-core, sales |

---

## 依存グラフ（要約）

```
platform-core ─┬─ custom-objects
               ├─ tags
               └─ ai-assist

crm-core ─┬─ sales ─┬─ accounting
          │         ├─ sales-order ── (inventory)
          │         ├─ real-estate
          │         ├─ auto-body
          │         └─ staffing
          ├─ expenses
          ├─ inventory ─── purchasing
          └─ hr
```

依存ルール:
- 有効化時は依存先も自動有効化（`getEnabledModules` が解決）。
- 無効化時は依存元が残っていれば警告（`/admin/modules` UI）。

---

## 組み合わせ例（顧客プロファイル）

| 顧客像 | ビルドプロファイル | ランタイム有効モジュール |
|---|---|---|
| 不動産仲介（現 real-estate 相当） | `all` | platform + crm-core + sales + expenses + real-estate |
| 板金整備（現 auto-body 相当） | `all` | platform + crm-core + sales + auto-body |
| CRM だけ欲しい中小 | `crm` | platform + crm-core + sales |
| CRM + 在庫管理の卸 | `crm+erp` | platform + crm-core + sales + inventory + purchasing |
| 製造業フル | `crm+erp` | platform + crm-core + sales + inventory + purchasing + sales-order + accounting |

---

## モジュール追加手順（雛形）

1. `src/modules/<id>/manifest.ts` を作成（id / category / dependsOn / navItems / contracts）。
2. `src/lib/modules/registry.ts` に登録（ビルドプロファイルの該当カテゴリに乗る）。
3. テーブルが要るなら `src/lib/schema.ts` に追加 + `supabase/migrations/<ts>_<name>.sql`（冪等）。
4. `src/modules/<id>/contracts.ts` に入力コントラクトを宣言（AI/UI/import 共通）。
5. ルートを `src/modules/<id>/pages/` に置き、`src/app/(crm)/<route>/page.tsx` proxy で `isModuleEnabled` ゲート。
6. object_definitions が要るマスタは `objectSeeds` + seed スクリプトで冪等登録。
7. 3業種 env でビルド + `check:schema` を緑に。
