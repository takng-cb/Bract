# 経費の前処理＋会計ソフト連携 設計（#134 / REQ-0068 / ADR-0026）

> 「領収書の画像を読み込んで、自動で仕訳をする仕組みがほしい。仕訳管理を組み込んでいきたい」（REQ-0068）への設計。
> **本格会計（決算・申告まで内製）はやらない**（ADR-0026）。Bract は現場の入力と前処理に徹し、
> 確定・申告は会計ソフト（freee / 弥生 等）に CSV で渡す。

## 0. 方針（ADR-0026 の要約）

| 観点 | 決定 |
|---|---|
| 守備範囲 | 領収書画像 → 経費 → 仕訳ドラフト → 会計ソフト CSV 連携（前処理まで） |
| やらないこと | 申告書作成・決算処理・固定資産台帳・減価償却・銀行 API 連携・**消費税の計算**（税率・税区分は項目として保持、計算は連携先に委ねる） |
| AI の関与 | draft-then-apply 原則（CLAUDE.md）。AI は DB を直接触らず、抽出・推定の結果は常に編集可能なドラフトとして提示 |
| モジュール | ロードマップ既定の `accounting` モジュール（category: 'erp'、依存: expenses）として実装。`enabled_modules` でランタイム ON/OFF |

## 1. 全体像

```
[現場スマホ]                       [Bract]                              [会計ソフト]
 領収書を撮影 ──→ Vision AI 抽出 ──→ 経費（編集可能ドラフト→確定）        freee / 弥生
                                      │ Phase B: 確定 → 仕訳ドラフト生成      ↑
                                      │ Phase C: 科目推定（ルール優先）        │
                                      └ Phase D: CSV エクスポート ────────────┘
```

仕訳（journal_entries）は「会計ソフトに渡す前の**中間表現**」。将来内製会計に進む場合も同じ土台を使える
（が、現時点では進まないことを決定済み）。

## 2. Phase A — 領収書画像 → 経費起票

**既存資産（ほぼ揃っている）**: クイックランチャーの AI 作成は画像入力対応済み
（`QuickAiInput.image`、Gemini/Anthropic は Vision 対応、Groq は日本語ガードあり）。
経費は TYPED_SPECS 実装済み（REQ-0066 で追加）。

追加分:

1. **expenses にレシート項目を追加**（冪等 migration・全 Neon 適用）:
   - `vendor` text（支払先）
   - `tax_rate` numeric（税率 %。8/10 の混在レシートは合計額の主たる税率を入れ、明細分割は備考）
   - `invoice_reg_no` text（インボイス登録番号 T+13桁。**形式チェックのみ**、真正性検証はしない）
   - いずれも nullable（base/他業種に無害）
2. **抽出プロンプトの経費特化**: 領収書画像のとき 日付/金額（税込）/支払先/税率/登録番号 を抽出。
   few-shot に領収書例を追加（C6 の誤分類対策の延長）。
3. **モバイル動線**: クイックランチャー AI 作成は既にモバイル対応（FAB→AI作成→カメラ撮影は
   `<input type="file" accept="image/*" capture>` 相当の既存実装を流用）。レシート撮影→確認→作成の
   3 タップを E2E ケース化。
4. **プロバイダ前提**: Vision は Gemini / Anthropic のみ。Groq 設定時は既存ガードの文言どおり
   設定変更を案内（追加実装なし）。

**受け入れ基準**: 実レシート画像 5 種（コンビニ/タクシー/飲食/Amazon 明細/手書き）で
金額・日付・支払先が正しくドラフトに入る。誤抽出は確認画面で編集して作成できる。

## 3. Phase B — 仕訳基盤（中間表現）

新テーブル（すべて冪等 migration・全 Neon 適用・nullable/DEFAULT 設計）:

| テーブル | 主な列 | 備考 |
|---|---|---|
| `chart_of_accounts` | code, name, account_type(資産/負債/純資産/収益/費用), tax_category_default, sort_order, is_active | 初期 seed は中小向け標準科目（freee 標準に寄せる） |
| `journal_entries` | entry_date, description, status('draft'\|'confirmed'\|'exported'), source_type('expense'\|'manual'), source_id, total_amount | 確定後の編集不可。修正は反対仕訳（赤伝）のみ |
| `journal_lines` | entry_id FK, side('debit'\|'credit'), account_id FK, amount, tax_rate, tax_category, memo | **貸借一致は DB でなくアプリ層 + 確定時検証**で強制 |

- 経費の確定（または一覧からの一括操作）→ 仕訳ドラフト自動生成
  （借方=科目推定の費用科目 / 貸方=現金 or 未払金。支払手段は経費に持たせず確定時に選択）。
- `accounting` モジュールとして registry 登録、`/journal` 一覧（draft/confirmed タブ）、canDo(read/create/update) を尊重。
- 仕訳の手入力（manual）も最小フォームで可能にする（連携前の調整用。日常入力の主役にはしない）。

## 4. Phase C — 科目推定＋月次集計

- **決定的ルール優先**: `account_mappings`（vendor 正規化キー × expense category → account_id, tax_category）を
  確定のたびに upsert（学習）。次回から同じ支払先は AI を呼ばず即決。
- 初見のみ AI に科目候補を 1 つ推定させる（chart_of_accounts のホワイトリストに無い回答は破棄→「未分類」）。
- 月次集計ビュー: 科目×月のクロス集計（確定済みのみ）。会計ソフトに渡す前の現場確認用で、試算表は名乗らない。

## 5. Phase D — 会計ソフト CSV 連携

- エクスポート対象: confirmed の仕訳（期間指定）。出力後 status='exported'（再出力は可・履歴に残す）。
- 形式: **freee（取引インポート）/ 弥生会計（仕訳日記帳）** の 2 形式から開始。
  - 科目名・税区分コードは `export_account_aliases`（account_id × 形式 → 先方の科目名/税区分コード）で変換。
  - 文字コード（弥生は Shift_JIS）・日付形式の差は formatter で吸収。
- `export_logs`（期間、形式、件数、実行者）。ダウンロードは server action からストリーム返却。

## 6. 消費税の扱い（決定）

- Bract は**計算しない**。保持するのは「税率（数値）」「税区分（連携先コードに変換可能な内部区分）」のみ。
- 8%/10% 混在・軽減税率の明細分割は対象外（備考に残して会計ソフト側で調整）。
- インボイス登録番号は**保持と形式チェックのみ**（国税庁 API 照合はやらない）。

## 7. 実装順とゲート

| Phase | 規模感 | 前提 |
|---|---|---|
| A | 小（migration 1 本＋抽出強化＋E2E） | Vision プロバイダ（Gemini or Anthropic キー） |
| B | 中（テーブル 3＋モジュール登録＋/journal） | A |
| C | 小〜中（mappings＋集計ビュー） | B |
| D | 中（formatter 2 形式＋alias 管理） | B（C 無しでも「未分類」のまま出せる） |

各 Phase で通常の検証ゲート（3 業種ビルド / vitest / check:schema 全 Neon / E2E）。
マイグレーション適用は既存運用どおり**ユーザーが実行**（冪等 SQL を用意、DO $ ブロック禁止）。

## 8. 未決（実装時に確認）

- chart_of_accounts の初期 seed の科目粒度（freee 標準ほぼそのまま、で開始予定）
- レシート画像そのものの保存（添付基盤 #129 の画像添付と合流するか、Phase A では保存しないか）
- 経費の承認フロー（ADR-0022 の approval レイヤー対象に含めるか）
