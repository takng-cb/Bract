# Bract — デザイン刷新 引き継ぎ資料（Claude Design 用）

> 目的：現状 UI（見た目）を一新するための入力資料。**プロダクトの趣旨**と**現状デザインの実測**をまとめる。
> 機能・ルーティング・サーバーロジックは変えない前提で、**見た目（デザインシステム＋主要画面）**を再設計したい。

---

## 1. プロダクトの趣旨・コンセプト

**Bract** は、CRM を出発点に **CRM/ERP のモジュラー・プラットフォーム**へ発展させている業務システム。

- **誰が使うか**：中小企業の現場担当〜管理者（営業・事務・経営）。BtoB の日本語業務ユーザー。PC 主体、モバイルも使う。
- **何を解決するか**：取引先・商談・案件・活動などを 1 つに集約し、**入力の手間を最小化**して回す。
- **形態**：**単一テナント**（1社=1デプロイ=1DB）。顧客ごとに必要な**モジュール**だけを組み合わせて提供する。
- **業種オーバーレイ**：同一コードベースから業種版をビルド。現状は **real-estate（不動産）/ auto-body（板金・自動車整備）/ staffing（人材手配）** の 3 業種＋汎用 base。
- **AI 方針**：AI は「入力補助」。貼り付けたテキストを構造化 → **確認画面で人が承認 → 反映**（draft-then-apply、AI が DB を直接触らない）。
- **語彙（重要）**：**モジュール（Module）> ブック（Book, 旧「オブジェクト」）> レコード（Record）**。「オブジェクト」という Salesforce 的呼称は脱却中。

### 目指すトーン
- 「無料の管理画面テンプレ」感を脱し、**信頼できる業務 SaaS** に見せたい。
- 情報量が多い業務画面なので、**可読性・密度・スキャンしやすさ**が最優先。装飾過多は不要。
- 日本語 UI（漢字・カナ）でも崩れない**和文タイポgrafィの最適化**が欲しい。

---

## 2. ドメインと主要画面（再設計対象サーフェス）

### 主なブック（レコード種別）
取引先(accounts) / 人物(contacts) / 商談(opportunities) / 活動(activities) / ToDo(tasks) / 経費(expenses) / カスタムオブジェクト（汎用）
- staffing：スタッフ(staff) / 案件(assignments)
- auto-body：車両(vehicles) / 部品(parts) / 整備(maintenance) / 顧客車両 / 売掛金
- real-estate：物件(properties)

### 画面パターン（ほぼ全ブックで共通の“型”）
1. **ダッシュボード** `/dashboard` — KPI カード、期間内 ToDo / 活動、最近のレコード、（業種別ウィジェット）、Recharts のグラフ。期間セレクタあり。
2. **一覧（リスト）** `/accounts` 等 — テーブル、フィルタ（FilterBuilder）、保存ビュー、グルーピング、CSV 入出力、ページネーション。モバイルはカード表示。
3. **詳細** `/accounts/[id]` — ヘッダ（パンくず＋編集/削除）、基本情報、関連レコード（活動・ToDo・タグ・添付・変更履歴）、タブ。
4. **新規/編集フォーム** `/accounts/new`・`/[id]/edit` — 縦積みフォーム、セクション見出し、カスタムフィールド、CSV/テキスト取り込みモーダル。
5. **予実/予測** `/forecast` — Recharts。
6. **クイック登録ウィザード** `/quick/staffing` — 貼り付け→AI解析→確認→起票の多段ウィザード。
7. **管理** `/admin/*` — ユーザー、ライセンス、モジュール、ブック定義、関係、AI 設定 等。

> **共通クローム**：左サイドバー（PC）＋上部バー/下部タブ（モバイル）。ナビゲーション進捗バー（クリック直後に上部に青いバー）。

---

## 3. 現状デザインの実測（＝直したい“見た目”）

### 技術スタック（制約）
- **Next.js 16 App Router（RSC 中心）/ React 19 / TypeScript strict**
- **Tailwind CSS v4**（`@import "tailwindcss"`、`@theme inline`）。**ユーティリティ手書きが基本**。
- **コンポーネントライブラリ無し**（shadcn / Radix / Headless UI / cva / clsx いずれも未使用）。プリミティブは全て手書き。
- **アイコンライブラリ無し** → **絵文字＋一部手書き SVG**でアイコンを賄っている（最大の“素人っぽさ”要因）。
- グラフは **recharts**。
- フォントは next/font の **Geist / Geist Mono** を読み込み済み。

### タイポグラフィ（問題あり）
- `src/app/layout.tsx` が `--font-geist-sans` / `--font-geist-mono` を `<html>` に付与。
- **しかし** `src/app/globals.css` の `body { font-family: Arial, Helvetica, sans-serif; }` が上書きしており、**Geist が実際には当たっていない**（Next 既定スキャフォルドのまま）。和文フォント指定も無い。
- 文字サイズは `text-sm`(14px) 主体、見出し `text-2xl font-bold`。タイプスケール/行間の設計は無い。

### カラーパレット（実測：使用頻度上位）
ほぼ **zinc（ニュートラル）＋ blue（プライマリ）** の“デフォルト Tailwind”構成。ブランド色は無い。
- ニュートラル：`text-zinc-400/500/600/700/900`、`border-zinc-200/300`、`bg-zinc-50/100`、サイドバー `bg-zinc-900`
- プライマリ：`text-blue-600`、`bg-blue-600`(ボタン)/`hover:bg-blue-700`、`ring-blue-500`(フォーカス)
- セマンティック：danger=red（必須/削除）、positive/money=green、warning=amber/yellow、**AI/クイック=violet**
- ステータスバッジは画面ごとに**ハードコード**（例：商談ステージ `prospecting→bg-zinc-100`, `qualification→bg-blue-100` …、ToDo 優先度 高=red/中=yellow/低=green）。共通トークン化されていない。
- ダークモード：globals.css に `prefers-color-scheme` の雛形だけ残るが、本体は白/zinc 固定で**実質ライト専用**。

### アイコン（要刷新）
- ナビ・ボタン・ユーザー表示が**絵文字**（🏠 取引先・🔧 整備・🚗 車両・🪛 部品・💰 売掛金・🧑‍💼 スタッフ・📋 案件・👤 ユーザー 等）。OS により字面が変わり一貫性が無い。
- 戻る/開閉などは**手書きインライン SVG**（chevron）。混在している。

### レイアウト / 共通クローム
- 全体：`flex min-h-screen bg-zinc-50`。`<main>` がスクロール領域。
- **サイドバー**（`src/components/Sidebar.tsx`）：`bg-zinc-900 text-white`、幅 `w-56`／折りたたみ `w-14`（localStorage 永続）。モジュール単位のグループ見出し（10px 大文字トラッキング）＋開閉。アクティブ項目 `bg-blue-600 text-white`、非アクティブ `text-zinc-400 hover:bg-zinc-800`。
- **モバイル**：上部バー（`pt-14`）＋下部タブ `BottomNav`。
- **NavigationProgress**：Link クリック直後に上部に青い進捗バー＋中央スピナー（体感速度対策）。維持したい挙動。

### コンポーネントの“型”（手書きユーティリティの定番値）
- **カード**：`bg-white border border-zinc-200 rounded-lg p-6`
- **ページ余白**：`p-4 md:p-8`、フォームは `max-w-2xl`
- **入力**：`w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
- **プライマリボタン**：`px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50`
- **副ボタン**：`px-5 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50`
- **セクション見出し**：左に `w-1 h-5 rounded-full bg-blue-500` のバー＋`text-sm font-bold text-zinc-700` ＋右に区切り線
- **ステータス/バッジ**：ピル `rounded bg-{color}-100 text-{color}-700`（角丸・淡色背景・濃色文字）
- **エラー帯**：`bg-red-50 border border-red-200 text-red-700`／**確認(重複)帯**：`bg-amber-50 border-amber-300`
- **テーブル**：手書き `<table>`、ヘッダ `text-zinc-500`、行ホバー、グルーピング・モバイルカード代替あり
- **スケルトン**：`ListPageSkeleton`（一覧の体感速度用）
- **パンくず**：`RecordHeader`（← アイコン＋スラッシュ区切り＋右にアクション）

### 既知の“ダサい”要因（優先度順）
1. **絵文字アイコン**が全面に出ている（統一感・信頼感を最も損なう）。
2. **Geist フォントが未適用**（Arial 落ち）。和文フォント設計も無い。
3. **デフォルト blue/zinc** でブランド無し。アクセントの設計が無い。
4. **デザイントークン不在**（色/余白/角丸/影/タイプスケールが各所ハードコード、バッジ色は画面ごと重複定義）。
5. **奥行き・余白リズム・階層**の設計が薄くフラットで詰まって見える。

---

## 4. Claude Design に作ってほしいアウトプット

1. **デザイントークン**：カラー（ニュートラル＋ブランド/プライマリ＋セマンティック：danger/warning/positive/info、AI 用アクセント）、タイプスケール（和文最適）、スペーシング、角丸、影、フォーカスリング。**ライト主、将来ダーク可**を意識。
2. **アイコン方針**：絵文字を廃し、統一アイコンセット（例：lucide）への置換指針＋各ナビ/アクションのマッピング。
3. **コア・コンポーネント仕様**：ボタン（primary/secondary/ghost/danger）、入力・セレクト・テキストエリア、カード、セクション見出し、バッジ/ステータスピル（**共通の color トークンで**）、テーブル行、タブ、パンくず、モーダル、トースト/インライン通知（エラー帯・重複確認帯を含む）、空状態、スケルトン。
4. **共通クローム**：サイドバー（モジュールグループ＋折りたたみ）、モバイル上部/下部ナビ、ナビ進捗バーのスタイル。
5. **主要画面のビジュアル**：①ダッシュボード ②一覧（テーブル＋フィルタ＋ツールバー）③詳細（ヘッダ＋関連レコード）④新規/編集フォーム ⑤クイック登録ウィザード。

### 守ってほしい制約
- **Tailwind v4 ユーティリティ**で実装可能なこと（重い UI ランタイムの新規依存は最小限に。アイコンライブラリ追加は可）。
- **RSC 主体**：状態を持つのは限られたクライアントコンポーネントのみ。
- **情報密度を落とさない**（業務テーブルは行を詰めて多く見せたい。余白で間延びさせない）。
- **日本語前提**：和文の字面・行間・記号（／・…）で破綻しないこと。
- 機能・URL・サーバーアクション・フォーム項目は不変（**見た目のみ**）。
- 体感速度施策（NavigationProgress＋一覧の loading.tsx スケルトン）は踏襲。

---

## 5. 参考：触る/触らないファイルの目安
- **トークンの置き場**：`src/app/globals.css`（`@theme` 拡張）＋必要なら `tailwind` テーマ。
- **共通クローム**：`src/components/Sidebar.tsx` / `MobileNav.tsx` / `BottomNav.tsx` / `NavigationProgress.tsx`。
- **共通プリミティブ化の候補**：現状バラ撒かれているボタン/入力/カード/バッジ → 共有コンポーネント or 共通クラスへ集約。
- **代表フォーム**：`src/components/AccountForm.tsx`（型の見本）。
- **ステータス色の集約先**：商談ステージ/ToDo優先度などの `*_CONFIG` をトークン化。
</content>
