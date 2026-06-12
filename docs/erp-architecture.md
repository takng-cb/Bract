# Bract ERP — モジュラー・アーキテクチャ設計

> 本書は **Bract を CRM 専用から「CRM/ERP モジュラー・プラットフォーム」へ発展**させるための設計の中核ドキュメント。
> 既存の業種オーバーレイ（`docs/architecture.md`）を前提に、その上位概念として「モジュール」を導入する。
>
> 関連ドキュメント:
> - [`docs/module-catalog.md`](./module-catalog.md) — モジュール一覧・依存・担当ルート
> - [`docs/migration-roadmap.md`](./migration-roadmap.md) — 段階移行ロードマップ
> - [`docs/ai-input-assistant.md`](./ai-input-assistant.md) — AI 入力補助（コントラクトファースト）設計
> - [`docs/architecture.md`](./architecture.md) — 既存の業種オーバーレイ詳細（土台）

---

## 1. 背景と目的

### これまで
- `NEXT_PUBLIC_INDUSTRY` 環境変数による **ビルド時固定の業種オーバーレイ**で、不動産 / 板金整備 / 人材派遣に対応。
- 1顧客 = 1業種 = 1 Vercel project = 1 Neon DB の **単一テナント**構成。

### 限界
- `activeIndustry` がビルド時固定 → **1顧客が1業種に縛られ、「CRM + 在庫 + 会計」のような自由な組み合わせができない**。
- 機能 ON/OFF が環境変数依存 → **変更のたびに再ビルド・再デプロイ**。
- 「業種」という単位が粗く、**ERP の横断機能（在庫・会計・購買…）を表現できない**。

### 目的
CRM/ERP の機能を **モジュール**として分解し、**顧客ごとに必要なモジュールだけを組み合わせて提供**する。
さらに **LLM 起点の入力補助**を前提に、各モジュールが「型付きの入力コントラクト」を持つ設計とする。

---

## 2. 確定した設計方針

| 軸 | 決定 | 補足 |
|---|---|---|
| コードベース | `OriginalCRM` を `Bract_ERP` に複製して発展 | 既存3業種の資産を全継承 |
| モジュール合成 | **ランタイム合成 ＋ ビルドプロファイル**（ハイブリッド） | §4 |
| テナント | **① 現状維持**（1社 = 1デプロイ + 1DB） | 物理分離を維持。重さはプロビジョニング自動化で対処（§6） |
| AI | **コントラクトファースト**による入力補助（draft-then-apply） | フルのツール実行/MCP/自律エージェントは将来（§5） |
| スキーマ | `schema.ts` 一本 + 全 Neon に全マイグレ（当面継続） | 将来 per-module 分割（"Option 2"）はロードマップ Phase 6 |

---

## 3. コア概念：業種オーバーレイ → モジュールレジストリ

「業種（industry）」という **ビルド時の単一選択** を、「モジュール（module）の **集合**」へ昇格させる。
業種（real-estate / auto-body / staffing）は **`category: 'industry'` のモジュールの1種**として吸収される。

```
これまで（単一・ビルド時固定）            これから（集合・ランタイム）
NEXT_PUBLIC_INDUSTRY='real-estate'   licenses.features.enabled_modules =
       ↓ ビルドに静的埋め込み            ['crm-core','sales','inventory',
1顧客=1業種でしか動かない                 'accounting','real-estate']
                                        ↓ DB を読んで実行時に有効モジュールを合成
```

### モジュールとは
`src/modules/<id>/` に、現行 `src/industries/<業種>/` と同じ内部構造で置く自己完結パッケージ。

```
src/modules/<id>/
├── manifest.ts        # モジュールの宣言（後述）
├── contracts.ts       # 型付き入力コントラクト（AI/UI/import 共通の真実、§5）
├── schema.ts          # このモジュールのテーブル（当面は src/lib/schema.ts に統合参照）
├── pages/             # ルート用ページ
├── components/
├── actions/           # server actions（= apply 層の実体）
└── lib/               # ビジネスロジック
```

### マニフェスト
```ts
// src/lib/modules/types.ts
export interface ModuleManifest {
  id: string                          // 'crm-core' | 'inventory' | 'real-estate' ...
  name: string                        // 表示名（例: '在庫管理'）
  category: 'platform' | 'crm' | 'erp' | 'industry'
  dependsOn?: string[]                // 依存（例: inventory→['crm-core']）
  navItems: NavItemDef[]              // サイドバーに足す項目
  objectSeeds?: ObjectSeed[]          // book_definitions に登録するマスタ（既存 seed と同方式）
  contracts?: ContractRef[]           // このモジュールが公開する入力コントラクト（§5）
}
```

### レジストリ
```ts
// src/lib/modules/registry.ts
export const MODULE_REGISTRY: Record<string, ModuleManifest> = { /* 全モジュール */ }

/** ライセンスで有効化されたモジュールを依存解決込みで返す（getLicense ベース・React.cache） */
export async function getEnabledModules(): Promise<ModuleManifest[]>

/** 単一モジュールの有効判定（既存 hasFeature と同じ作法） */
export async function isModuleEnabled(id: string): Promise<boolean>

/** Server Action 冒頭ゲート（既存 ensureFeature と同じ作法） */
export async function ensureModuleEnabled(id: string): Promise<void>
```

### 既存資産をそのまま土台にできる（重要）
`src/lib/license/` に **ランタイム機能フラグ機構が既に存在**し、これを一般化するだけ:
- `licenses.features`（JSON）は既に `extra_industries: string[]`（有効業種のランタイム配列）を持つ
  → **「有効モジュールの配列」というパターンは既に実証済み**。
- `hasFeature` / `ensureFeature` / `getLicense`（`src/lib/license/index.ts`）は
  React.cache メモ化・env kill-switch・status/期限チェック込みで完成 → そのまま流用。

`licenses.features` を拡張（**上限と表示を分離**。詳細は §8.1）:
```ts
export type LicenseFeatures = {
  ai_summary?: boolean
  extra_industries?: string[]   // 既存（温存・将来 entitled へ統合）
  entitled_modules?: string[]   // 契約で“持てる上限”（提供側のみ設定）
  enabled_modules?:  string[]   // 上限内で“今 ON にする”もの（ランタイム合成の真実）
}
```

---

## 4. 合成方式：ランタイム ＋ ビルドプロファイル（ハイブリッド）

1社 = 1デプロイのため、**2段構え**でビルドの軽さとランタイムの柔軟性を両立する。

```
┌─ ビルド時（粗い） ────────────────────────────┐
│ BRACT_BUILD_PROFILE = 'crm' | 'crm+erp' | 'all' │  ← 社ごとに同梱するモジュール「群」を選択
│   例: CRM のみ契約の社 → ERP コードを同梱しない   │     （重い ERP/業種を bundle から除外）
└────────────────────────────────────────────────┘
                    ↓ 同梱された範囲内で
┌─ ランタイム（細かい） ──────────────────────────┐
│ licenses.features.enabled_modules で個別 ON/OFF  │  ← 再ビルド不要。/admin/modules でトグル
└─────────────────────────────────────────────────┘
```

| レイヤ | 粒度 | 変更コスト | 何を決めるか |
|---|---|---|---|
| ビルドプロファイル | 粗い（カテゴリ群） | 再ビルド要 | バンドルに含めるモジュール群（＝重さ） |
| ランタイムフラグ | 細かい（個別 ID） | DB 更新のみ | 含めた範囲のうち実際に見せる機能 |

- **クライアント負荷**：Next.js App Router は **ルート単位で自動コード分割**。未訪問ページの JS は落ちない。重いモジュールは `dynamic import`（既に不動産ページで使用中の手法）で本体バンドルから分離。
- **ビルドプロファイルの実装イメージ**：`MODULE_REGISTRY` を構築する際、`BRACT_BUILD_PROFILE` に含まれないカテゴリのモジュールを登録から外す。プロファイル外モジュールのページ proxy は `notFound()`。

---

## 5. AI：コントラクトファーストによる入力補助（draft-then-apply）

### 位置づけ
**まずは「入力補助」**。LLM が直接 DB を更新するのではなく、**スキーマ準拠の構造化データ（JSON/CSV）を生成 → 人が確認 → 決定論的な apply 層が DB 反映**する（human-in-the-loop）。

```
1. ユーザーがチャットに情報を投げる（名刺/議事録/メール本文 など）
2. システムが対象モジュールの「入力コントラクト(JSON schema)」を取得し、それで LLM をラップ
3. LLM がスキーマ準拠の構造化データ(JSON/CSV)を生成
4. 画面でプレビュー → ユーザーが確認・修正
5. 確定 → 既存の server action / import パイプラインがバリデーション後に DB 反映
   （★ LLM は DB を直接触らない。apply 層が最終ゲート）
```

### なぜ「コントラクトファースト」なのか
フルのツールファースト（全操作を関数化して LLM が自律実行）は今は不要。だがその**中核「型付き入力コントラクト」は今から入れる**。1つの成果物が4役をこなすため:

| コントラクトが効く先 | 効果 |
|---|---|
| ① LLM の構造化出力を制約 | スキーマ準拠 JSON しか出させない（AI 像の心臓部） |
| ② apply 時のバリデーション | 不正データを DB 手前で弾く安全ゲート |
| ③ 既存 CSV インポート/エクスポート (`src/app/api/import/*`) | LLM 入力補助＝「LLM がインポート用ペイロードを作る」。**既存パイプライン再利用** |
| ④ 将来のフルツールファースト/MCP 化 | コントラクト → ツールは機械的変換。**無改修で後付け可能** |

詳細は [`docs/ai-input-assistant.md`](./ai-input-assistant.md)。

### 段階
| レベル | 内容 | 本ロードマップでの扱い |
|---|---|---|
| L1 入力補助（draft-then-apply） | スキーマ準拠データ生成 → 確認 → apply | **今回の主眼**（Phase 7） |
| L2 外部エージェント（MCP 公開） | コントラクトを MCP ツールとして公開し外部 LLM が操作 | 将来（無改修拡張） |
| L3 自律エージェント | 定期/イベント起動で提案・自動処理 | 将来 |

---

## 6. テナント／複数社運用の「重さ」対策

テナントは **① 現状維持（1社 = 1デプロイ + 1DB）**。物理分離の安心感を保つ。
「重さ」は方式変更ではなく運用自動化とビルド工夫で潰す:

- **運用の重さ** → 新規社の立ち上げ（Neon 作成 → マイグレ適用 → Vercel project 作成 → モジュール seed）を
  **プロビジョニング・スクリプト**で自動化（ロードマップ Phase 6 の運用タスク）。社数増加が手作業増加に直結しないようにする。
- **ビルド/バンドルの重さ** → §4 のビルドプロファイル + `dynamic import`。

> 将来マルチテナント化が必要になった場合に備え、モジュール集合を `tenant_key` 単位で持てる設計余地は残す（`licenses` は既に `tenant_key` を持つ）。今回は単一テナント前提。

---

## 7. ランタイム・ゲーティング（ビルド時 → 実行時の置換）

| 箇所 | これまで | これから |
|---|---|---|
| ページ表示可否 | `if (activeIndustry !== 'real-estate') notFound()` | `if (!(await isModuleEnabled('real-estate'))) notFound()` |
| Server Action ガード | （ほぼ無し） | `await ensureModuleEnabled('inventory')` |
| サイドバー | `ALL_NAV_ITEMS` 静的 + industry 分岐 | `getEnabledModules()` から合成（`navItems.ts` を async 化） |
| URL ルーティング | `next.config.ts` の env 分岐 redirect | 同梱範囲は実行時ゲート。プロファイル外のみ redirect/notFound |

監査・権限は既存のロール機構と `audit_log` をそのまま使う。AI 経由の操作も「アクター = AI（実行ユーザー）」として記録できる設計にする。
**ゲートは必ずサーバー側で強制**し、トグル経路は管理者限定・上限内に検証する（脅威モデルと防御の詳細は §8）。

---

## 8. セキュリティ／権限モデル（モジュール ON/OFF の保護）

モジュールの ON/OFF は「`licenses` の1行を書き換える」操作。**その書き込み経路と判定経路を守る**ことが安全性の本体。
新たな弱点を増やさず、アプリ既存の認証・権限と同じ強度に収めるのが原則。

### 8.1 二層に分ける：entitlement（上限）と activation（表示）

「持てる上限」と「今 ON にするか」を**別カラム**に分離する。これにより、テナント管理者が**未契約モジュールを自己有効化できない**。

```ts
export type LicenseFeatures = {
  entitled_modules?: string[]   // 契約で“持てる上限”。★提供側/課金システムのみが設定。顧客は変更不可
  enabled_modules?:  string[]   // 上限の中で“今 ON にする”もの。顧客 admin に開放してもよい
  // 旧 `modules` は enabled 相当。移行時に enabled_modules へ寄せる
  extra_industries?: string[]   // 既存（温存・将来 entitled へ統合）
}
```

有効集合の計算式（サーバー側）:
```
有効モジュール = ビルドプロファイル同梱 ∩ entitled_modules ∩ enabled_modules（＋依存解決）
```
`enabled` がどう書かれていても **`entitled` を超える分はサーバーが無視/拒否**する。

### 8.2 三つの必須防御

| # | 防御 | 実装 |
|---|---|---|
| ① | **書込みは管理者のみ** | トグル用 server action 冒頭で `requireAdmin()`。Next.js server action は CSRF 保護があり外部サイトから起動不可 |
| ② | **判定はサーバー側で強制（最重要）** | メニューを隠すだけは不可。ページ表示も Server Action も `isModuleEnabled`/`ensureModuleEnabled` でサーバー判定。クライアント JS を改竄して UI を出しても、サーバーが `notFound()`/例外を返し**何も実行されない** |
| ③ | **入力ホワイトリスト＋上限チェック** | トグルが受け取る module 配列は「`MODULE_REGISTRY` 既知 ID かつ `entitled_modules` 内」に限定検証。任意値でこじ開け不可 |

→ ①②③が揃えば、**認証情報を持たない第三者が外部から勝手に ON にすることはできない**。

### 8.3 残るリスクと前提

| リスク | 性質 | 対処 |
|---|---|---|
| テナント admin が未契約機能を自己有効化 | 課金整合性（ハックではない） | §8.1 の entitlement 分離。顧客に編集させないなら enabled UI を出さない |
| DB / `DATABASE_URL` 漏洩で直書き | 全体の前提（モジュール固有でない） | 秘密情報の保護。これが破られれば全機能が破られる＝DB を信頼の根とする |
| クライアント側ゲートのみに依存 | 実装ミス | §8.2 ② を必須化（全 server action にゲート） |

### 8.4 さらに堅くする（任意・将来）

- **entitlement の署名**：env の秘密鍵で `entitled_modules` を署名し検証。DB を直接書き換えられても署名できず偽装不可（**DB すら信頼しない**自己ホスト提供向け）。
- **監査ログ**：「いつ・誰が・どのモジュールを切替えたか」を既存 `audit_log` に記録（常に推奨）。

> 現状は提供側が Neon DB を管理する単一テナント SaaS のため **DB を信頼の根**にでき、署名は任意。既存 `extra_industries` も同じ平文・同じ信頼モデルであり、モジュール化で信頼境界は変わらない。

---

## 9. 主要な新規/改修ファイル（Phase 1–2 代表）

| 種別 | パス | 内容 |
|---|---|---|
| 新規 | `src/lib/modules/types.ts` | `ModuleManifest` / `NavItemDef` / `ObjectSeed` / `ContractRef` |
| 新規 | `src/lib/modules/registry.ts` | レジストリ・`getEnabledModules`・`isModuleEnabled`・`ensureModuleEnabled`・ビルドプロファイル適用 |
| 新規 | `src/modules/<id>/manifest.ts` | 各モジュール宣言 |
| 改修 | `src/lib/license/types.ts` | `LicenseFeatures.entitled_modules?` / `enabled_modules?: string[]` 追加（§8.1） |
| 改修 | `src/lib/license/index.ts` | モジュール判定を既存機構の上に薄く追加（既存 API 不変）。有効集合 = 同梱 ∩ entitled ∩ enabled |
| 改修 | トグル用 server action | `requireAdmin` + 入力ホワイトリスト + 上限チェック + `audit_log` 記録（§8.2/8.4） |
| 改修 | `src/lib/navItems.ts` | async 化・`getEnabledModules()` 駆動 |
| 改修 | `src/app/(crm)/<route>/page.tsx`（複数） | `activeIndustry` 判定 → `isModuleEnabled()` |
| 改修 | `src/app/(crm)/layout.tsx` | サイドバー生成をモジュール駆動に |
| 改修 | `next.config.ts` | redirect 縮退 + ビルドプロファイル env 読込 |
| 新規 | `src/app/(crm)/admin/modules/page.tsx` | モジュール構成 UI |
| 改修 | `src/lib/industry.ts` | 互換シムとして残置（最終的に削除） |

---

## 10. 互換性・移行原則（ストラングラー方式）

- 既存3業種の本番を壊さないことを最優先。各 Phase は独立に動作確認可能。
- `licenses.features.enabled_modules` 未設定時は **現行 `activeIndustry` から有効モジュールを導出する互換シム**を噛ませ、本番無影響で基盤を導入。
- `industry.ts` は当面 re-export として残し、新規コードはモジュール API を使う。

検証は各 Phase で:
`npm run build`（3業種 env）／既存スモーク・E2E（`scripts/smoke-test.ts`, `test:industry-guard`, `npm run test:e2e`）／`npm run check:schema` を緑に保つ。
