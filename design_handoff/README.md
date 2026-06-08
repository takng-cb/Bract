# Handoff: Bract デザイン刷新（CRM/ERP モジュラープラットフォーム）

## Overview
業務システム **Bract** の見た目（デザインシステム＋主要画面）を全面刷新するための開発者ハンドオフです。
機能・URL・サーバーアクション・フォーム項目は**不変**。変更対象は**見た目（デザイン）のみ**。

刷新の核：
- 「無料の管理画面テンプレ」感を脱し、**信頼できる業務 SaaS** に見せる
- **デフォルト blue/zinc → ウォームニュートラル × 植物的グリーン（Foliage）** のブランドへ
- **絵文字アイコンを全廃 → Lucide** へ統一
- **Geist が未適用（Arial 落ち）の不具合を解消**、和文 Noto Sans JP を最適化
- 色/余白/角丸/影/タイプスケールを**デザイントークンに集約**（バッジ色などのハードコードを廃止）

## About the Design Files
このバンドル内の `*.html` / `styles/*.css` / `scripts/*.js` は **HTML で作成したデザインリファレンス**です。
意図した見た目・挙動を示す**プロトタイプであり、そのまま本番に貼るコードではありません**。

タスクは、これらのデザインを**既存の Bract コードベースの環境（Next.js 16 App Router / React 19 / TypeScript strict / Tailwind CSS v4、コンポーネントライブラリ無し）で再現**すること。既存の手書きユーティリティ運用に沿って、共有プリミティブ／共通クラスへ集約しながら実装します。

> ただし重要：このバンドルの **`globals.css` は "リファレンス" ではなく、実際に `src/app/globals.css` に適用できる実装成果物**です（Tailwind v4 `@theme`）。トークンの真実の置き場としてこれを使ってください。

## Fidelity
**High-fidelity（hifi）**。最終的な配色・タイポ・余白・角丸・影・インタラクションまで作り込んであります。
ピクセル詳細は各 HTML を直接参照（DevTools で計測可能）。本 README はトークン・構造・挙動の規定を担います。

---

## 実装の起点（最短ルート）
1. **`globals.css` を適用**：本バンドルの `export/globals.css` を `src/app/globals.css` に反映（`@import "tailwindcss"; @theme {…}`）。これでトークンがユーティリティ（`bg-brand-600`, `text-n-700`, `bg-danger-bg` 等）として使える。
2. **フォント不具合を解消**：現状 `globals.css` の `body { font-family: Arial, … }` が Geist を上書きしている。これを削除し、`--font-sans: var(--font-geist-sans), var(--font-noto-jp), …` を適用（`globals.css` の `@layer base` 参照）。
   - `layout.tsx` で Geist/Geist Mono（next/font）に加え、**Noto Sans JP**（next/font Google, weights 400/500/700）を読み込み `--font-noto-jp` として `<html>` に付与。
3. **アイコンライブラリ追加**：`lucide-react` を導入し、絵文字を全置換（マッピングは下記「Icon Map」）。
4. **共通プリミティブ化**：各所にバラ撒かれたボタン/入力/カード/バッジを共有コンポーネント（or 共通クラス）へ集約。HTML の `components.css` がクラス定義の雛形。
5. **ステータス色のトークン化**：`*_CONFIG`（商談ステージ/ToDo優先度/整備ステータス）を tone トークンへ（下記「Status Tones」）。

---

## Design Tokens
真実の置き場は **`export/globals.css`（@theme）** と、プロトタイプ用の `styles/tokens.css`。主要値：

### Color — Warm Neutral（hue≈80・低彩度。純グレーより温かい）
oklch 表記（globals.css の `--color-n-*`）:
- n-0 `oklch(0.995 0.002 90)` … n-50 `0.984` / n-100 `0.967` / n-150 `0.948` / n-200 `0.918`（境界）/ n-300 `0.855` / n-400 `0.730`（プレースホルダ）/ n-500 `0.605`（補助文字）/ n-600 `0.505` / n-700 `0.405` / n-800 `0.300`（見出し）/ n-900 `0.225`（本文）/ n-950 `0.165`

### Color — Brand: Foliage（green・確定）
- brand-50 `oklch(0.962 0.020 158)` / 100 `0.930` / 200 `0.880`（境界）/ 300 `0.785` / 500 `0.585`（ring）/ **600 `oklch(0.515 0.112 158)`（primary/ボタン）** / 700 `0.450`（淡色上のテキスト）/ 800 `0.385`
- `--primary` = brand-600 / `--primary-hover` = brand-700 / `--on-primary` ≈ near-white

### Color — Semantic（テーマ非依存・共通トークン）
- danger `oklch(0.555 0.190 27)`（必須/削除/エラー）
- warning `oklch(0.700 0.140 70)`（注意/重複確認）
- positive `oklch(0.580 0.130 152)`（成功/入金/受注）
- info `oklch(0.560 0.130 240)`（情報/進行中）
- **ai `oklch(0.535 0.165 292)`（AI/クイック登録アクセント）**
- 各 `*-bg` は淡色背景（例 `--color-danger-bg oklch(0.965 0.022 30)`）。バッジ/帯は `bg-{tone}-bg` + `text-{tone}` + `border`。

### Sidebar（warm dark）
- side `oklch(0.235 0.010 80)` / side-2 `0.205` / side-border `0.315` / アクティブ項目は `--primary`

### Typography
- フォント：`--font-sans: Geist → Noto Sans JP → system-ui`、`--font-mono: Geist Mono → Noto Sans JP`
- 数字は **tabular-nums**（金額・件数の桁揃え）。和文は `font-feature-settings:"palt" 1`、`line-height:1.7`
- スケール：2xs 10.5 / xs 11.5 / sm 12.5 / **md 14（基準）** / lg 16 / xl 18 / 2xl 22 / 3xl 28 / display 36（px）
- 見出し `font-weight:700`、letter-spacing -0.01〜-0.02em

### Spacing（4px グリッド）
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64（px）

### Radius（Sharp・端正）
xs 3 / sm 4 / md 5 / lg 7 / xl 10 / pill 999（px）。`standard`(4/6/7/9/12) と `soft`(6/8/10/13/16) のバリアントあり。

### Shadow（warm tint・最小）
- xs `0 1px 1px oklch(0.30 0.02 70 / .05)`
- sm `0 1px 2px /.06, 0 1px 1px /.04`
- md `0 4px 10px /.08, 0 1px 2px /.06`
- lg `0 12px 28px /.12, 0 2px 6px /.07`

### Focus ring
`outline: 2px solid var(--color-brand-500); outline-offset: 1px;`（`:focus-visible` のみ）

### Dark mode
`<html class="dark">` 戦略（globals.css に `@custom-variant dark` と `.dark` のトークン上書きを同梱）。
ニュートラル/サーフェス/セマンティック背景/サイドバー/影を反転・調整。primary グリーンは dark でやや明るめ・テキストは淡緑。

---

## Status Tones（ハードコード廃止 → 単一 Badge コンポーネントへ）
`<Badge tone>` を作り、tone を受け取って `bg-{tone}-bg / text-{tone} / border` を当てる。色を直書きしない。

| 用途 | マッピング |
|---|---|
| 商談ステージ | prospecting=neutral / qualification=info / proposal=ai / negotiation=warning / closed-won=positive / closed-lost=neutral |
| ToDo 優先度 | 高=danger / 中=warning / 低=neutral |
| 整備ステータス | 受付=neutral / 入庫=info / 部品待ち=warning / 作業中=brand / 完成=positive / 納車=positive |
| 取引先 種別 | 顧客=brand / 仕入先=neutral |

実装例（TS）：
```ts
export const STAGE_TONE = {
  prospecting:'neutral', qualification:'info', proposal:'ai',
  negotiation:'warning', won:'positive', lost:'neutral',
} as const;
```

---

## Core Components（`components.css` がクラス雛形）
- **Button**: `primary / secondary / ghost / danger / ai`、サイズ `sm(28) / md(36) / lg(42)`、`btn-icon`。primary=`bg-primary text-on-primary`、hover=`bg-primary-hover`、disabled `opacity:.5`。`:focus-visible` でリング。
- **Input / Select / Textarea**: `h:36`, `border n-300`, `rounded-sm`, focus= `border-ring + ring 2px(28% alpha)`。エラーは `border-danger`。Select は chevron 背景画像。
- **Card**: `bg-n-0 border-n-200 rounded-lg shadow-xs`、`card-pad`（密度連動）、`card-head`（区切り線）。
- **Section heading**: 左に `w:3 h:18 rounded-pill bg-primary` のバー + `text-md bold n-800` + 右に区切り線。
- **Badge / Status pill**: 上記 tone。`h:21 px:8 text-xs bold rounded-sm`、任意で先頭 `dot`。
- **Table**: `thead th` = `bg-n-50 text-n-500 text-sm`、`tbody td` = 行高=密度連動、`hover bg-n-50`、選択 `bg-brand-50`、グループ行 `bg-n-100`。`col-num` は右寄せ tabular。
- **Tabs**: 下線式。active= `text-primary-text border-bottom-primary`。count バッジ付き。
- **Breadcrumb（RecordHeader）**: `← / スラッシュ区切り / here は bold n-800 nowrap`。
- **Modal**: scrim `oklch(0.20 0.01 70/.42)`、`rounded-xl shadow-lg`、head/body/foot。
- **Inline notification / band**: `error / warning / info / ai`。`bg-{tone}-bg border-{tone}-border text-{tone}-text`。**エラー帯**と**重複確認帯（warning）**を含む。
- **Toast**: `bg-n-900 text-n-50 rounded-md shadow-lg`、success/error でアイコン色。
- **Empty state**: 48px アイコンチップ + 見出し + 説明 + CTA（必ず「次の一手」）。
- **Skeleton**: `.sk` シマー（`prefers-reduced-motion` で停止）。一覧の `loading.tsx` 相当に使用。

### 手書きユーティリティの定番値（現状資産との対応）
- カード：`bg-white border border-zinc-200 rounded-lg p-6` → `bg-n-0 border-n-200 rounded-lg`（余白は密度トークン）
- 入力：`border-zinc-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500` → `border-n-300 rounded-sm focus:ring-ring`
- primary ボタン：`bg-blue-600 hover:bg-blue-700` → `bg-primary hover:bg-primary-hover`

---

## 共通クローム（App Chrome）
- **Sidebar**（`w-56` / 折りたたみ `w-14`、localStorage 永続）：`bg-side text-side-text`。**モジュール単位のグループはクリックで開閉**（chevron＋ホバー＋ツリー罫線、開閉状態を localStorage 保存）。アクティブ項目 `bg-primary text-on-primary`。語彙：**モジュール > ブック > レコード**。実装雛形は `scripts/chrome.js`（NAV 構造・開閉・active）。
- **Mobile**：上部バー（ハンバーガー＋タイトル＋アバター）＋ **下部タブ BottomNav**（5タブ・中央に AI クイック登録の浮き FAB・ヒット領域 44px 以上）。一覧は**カード表示**。
- **NavigationProgress**：Link クリック直後に上部へ `h:2 bg-primary` の進捗バー＋スピナー（**踏襲必須**の体感速度施策）。
- **見た目コントロール（プロト専用）**：右下のライト/ダーク・密度トグルは**デモ用**。本番に持ち込む必要はないが、密度/ダークの2系統はトークンで実装可能（`data-density` / `.dark`）。

---

## Screens / Views（詳細ピクセルは各 HTML を参照）
1. **デザインシステム** `Bract Design System.html` — 全トークン/コンポーネントのカタログ。実装時の見本。
2. **ダッシュボード** `/dashboard` — `Bract Dashboard.html`。KPI 4枚（スパークライン）/ 売上推移（積み上げ棒）/ 整備ステータス（ドーナツ）/ 期間内 ToDo / 最近の活動 / 本日の入庫予定 / 最近の商談テーブル。期間セレクタ。グラフは **recharts** で再現（プロトは CSS 棒/conic-gradient）。
3. **一覧（取引先）** `/accounts` — `Bract Accounts List.html`。保存ビュー・ツールバー（検索/フィルタ/グループ化/列/並び替え）・**FilterBuilder**（条件 field/op/value のポップオーバー）・絞り込みチップ・行選択＋一括操作バー・ページネーション。モバイルはカード。
4. **詳細** `/accounts/[id]` — `Bract Account Detail.html`。RecordHeader（パンくず＋名称＋種別/タグ＋アクション）/ 基本情報 KV / 関連レコードタブ（商談・活動・ToDo・車両・添付・変更履歴）/ 右レール（担当・売掛金アラート・連絡先・タグ）。
5. **新規/編集フォーム** `/accounts/new`・`/[id]/edit` — `Bract Account Form.html`。`max-w` 760 の縦積み、セクション見出し、カスタム項目（業種オーバーレイ）、固定フッター保存バー、**CSV/テキスト取り込みモーダル**。
6. **クイック登録ウィザード** `/quick/*` — `Bract Quick Entry.html`。貼付 → AI解析 → **確認（下書きカード：取引先/車両/整備案件/ToDo を提示、既存紐付け/新規）** → 一括起票。Stepper。
7. **商談パイプライン** `/opportunities` — `Bract Opportunities.html`。ステージ別カンバン（確度バー・列ごとの件数/合計）。リスト/予実への切替トグル。
8. **整備ボード** `/maintenance` — `Bract Maintenance.html`。工程カンバン（受付→入庫→部品待ち→作業中→完成→納車待ち）。車両ジョブカード（ナンバー mono・作業種バッジ・ベイ・担当アバター・ETA、部品遅延は赤）。上部に稼働統計。
9. **予実・予測** `/forecast` — `Bract Forecast.html`。実績/予測/目標コンボ・ステージ別加重予測・四半期予実テーブル・担当者別達成率。recharts で再現。
10. **管理** `/admin/*` — `Bract Admin.html`。設定サブナビ＋モジュール有効化トグル（ブックチップ／プランバッジ）＋ライセンス席数＋ユーザー表。
11. **状態デザイン** `Bract States.html` — スケルトン/空/エラー/通常の標準形。各一覧の `loading.tsx`・空・エラーに適用。
12. **モバイル一式** `Bract Mobile.html` — 上部バー・下部タブ・一覧カード・詳細・入力＋各レコード（取引先/商談/車両/整備/ToDo）のカード設計。

## Interactions & Behavior
- **遷移**：一覧行クリック→詳細、サイドバー→各ブック、商談「予実」→forecast。クリック時に NavigationProgress を発火。
- **選択**：一覧チェックで一括操作バー（中央下に表示、`position:fixed`）。全選択ヘッダチェック。
- **FilterBuilder**：条件行（field/op/value）の追加・削除、適用で絞り込みチップに反映。
- **タブ**：詳細の関連レコードはタブ切替で `tabpanel` を表示。
- **トグル**：管理のモジュール on/off、フォームのスイッチ/セグメント。
- **ウィザード**：貼付→（解析中スピナー〜1.4s）→確認→起票→完了。AI は**承認するまで DB 反映しない（draft-then-apply）**。
- **アニメーション**：トランジションは 0.1〜0.18s ease（色/境界/影）。**背景色は transition から外す**（CSS変数の間接参照だとトランジションが再評価されずテーマ切替で色が固まるため。実装でテーマ/ブランドを動的に変える場合は要注意）。装飾的な無限ループは不可。
- **reduced-motion**：スケルトン等はアニメ停止。
- **レスポンシブ**：≤1180で詳細を1カラム、≤1080でKPI 2列、モバイルは下部タブ＋カード。

## State Management（RSC 主体・状態は限られた client component のみ）
- 一覧：選択行 set、フィルタ条件配列、保存ビュー、ソート、ページ。
- 詳細：アクティブタブ。
- フォーム：各フィールド値、バリデーション、取り込みモーダルの open/解析結果。
- ウィザード：step、貼付テキスト、抽出結果。
- 共通：サイドバー折りたたみ・モジュール開閉（localStorage）、テーマ/密度（任意・localStorage）。
- データ取得：既存のサーバーアクション/ルートを変更しない（見た目のみ差し替え）。

## Assets / Icons
- **画像アセットなし**（プロトはプレースホルダ無しで成立）。
- **アイコン：Lucide（lucide-react）**、stroke-width **2.25**（やや太め）。

### Icon Map（絵文字 → Lucide）
| 旧(絵文字) | 用途 | Lucide |
|---|---|---|
| 📊 | ダッシュボード | `layout-dashboard` |
| 🏠 | 取引先 accounts | `building-2` |
| 👥 | 人物 contacts | `users` |
| 📈 | 商談 opportunities | `trending-up` |
| 🗓️ | 活動 activities | `calendar-clock` |
| ✅ | ToDo tasks | `square-check-big` |
| 💴 | 経費 expenses | `receipt` |
| 🚗 | 車両 vehicles | `car` |
| 🪛 | 部品 parts | `cog` |
| 🔧 | 整備 maintenance | `wrench` |
| 💰 | 売掛金 receivable | `banknote` |
| 🧑‍💼 | スタッフ staff | `user-round` |
| 📋 | 案件 assignments | `clipboard-list` |
| 🏢 | 物件 properties | `house` |
| — | AI/クイック | `sparkles` |
| — | 新規/編集/削除/検索/フィルタ | `plus` / `square-pen` / `trash-2` / `search` / `sliders-horizontal` |
| — | CSV/添付/タグ/履歴/戻る/その他 | `arrow-down-to-line` / `paperclip` / `tag` / `history` / `arrow-left` / `ellipsis` |

## Files（バンドル内）
- `export/globals.css` — **実装適用用**（Tailwind v4 @theme・緑確定・ダーク・base reset・status tone 指針）
- `styles/tokens.css` — プロト用トークン（3ブランド比較＋密度/角丸/ダークの data-attr 版。**実装は緑＝Foliage のみ**で良い）
- `styles/components.css` — コンポーネントのクラス雛形（実装の見本）
- `styles/shell.css` — サイドバー/上部バー/コントロールの共通シェル
- `scripts/chrome.js` — サイドバー（NAV 構造・モジュール開閉・active）の雛形
- `scripts/ds.js` — テーマ/密度の data-attr 切替（プロト用。本番は任意）
- 画面 HTML：`Bract Design System.html` / `Bract Dashboard.html` / `Bract Accounts List.html` / `Bract Account Detail.html` / `Bract Account Form.html` / `Bract Quick Entry.html` / `Bract Opportunities.html` / `Bract Maintenance.html` / `Bract Forecast.html` / `Bract Admin.html` / `Bract States.html` / `Bract Mobile.html` / `Bract Index.html`（入口）

## 守る制約（再掲）
- Tailwind v4 ユーティリティで実装（重い UI ランタイム新規依存は最小限。lucide 追加は可）。
- RSC 主体。情報密度を落とさない（業務テーブルは詰める）。和文の字面・行間・記号で破綻させない。
- 機能・URL・サーバーアクション・フォーム項目は不変（**見た目のみ**）。
- 体感速度施策（NavigationProgress＋ `loading.tsx` スケルトン）を踏襲。
