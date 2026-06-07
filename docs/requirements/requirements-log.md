# 要件ログ（Requirements Log）

**追記専用。** 要件が出たら即ここに `REQ-NNNN` で記録する（漏れ防止のため判断せずまず追記）。
状態の流れ：`提案` → `合意` → `設計済` → `実装中` → `完了`（または `保留` / `却下`）。

書式：
```
### REQ-NNNN  〈短いタイトル〉
- 日付 / 出所（会話 / ブリーフ §x / Issue #y）
- 内容：何を満たしたいか
- 状態：（現在）
- 関連：ADR-xxxx / #Issue / spec:<module>#<節>
```

---

### REQ-0001  CRM/ERP のモジュール化
- 2026-06-07 / 会話
- 内容：CRM・ERP の機能をモジュール化し、顧客ごとに必要な機能を組み合わせて提供する。
- 状態：合意（設計済）
- 関連：ADR-0001 / spec: erp-architecture

### REQ-0002  モジュールの顧客ごとランタイム ON/OFF
- 2026-06-07 / 会話
- 内容：再ビルドなしで、顧客ごとに機能を有効/無効化できる。不正な有効化は防ぐ。
- 状態：合意（設計済）
- 関連：ADR-0002, ADR-0005 / docs/erp-architecture.md §7,§8

### REQ-0003  複数社展開時の運用・ビルドの軽さ
- 2026-06-07 / 会話
- 内容：社数が増えても運用が破綻せず、未使用機能でビルドが重くならない。
- 状態：合意
- 関連：ADR-0002, ADR-0003 / docs/migration-roadmap.md Phase6

### REQ-0004  AI による入力補助（コピペ→解析→確認→反映）
- 2026-06-07 / 会話 + ブリーフ §5
- 内容：自由文/LINE 本文等を貼り付け、LLM が構造化 → 差分確認 → 承認で反映。自動コミット禁止。
- 状態：合意（設計済）
- 関連：ADR-0004 / docs/ai-input-assistant.md / spec:staffing#クイック登録

### REQ-0005  人材手配業務システム（staffing）一式
- 2026-06-07 / ブリーフ（`sources/staffing-brief.md` に原文保存）
- 内容：案件・打診(RFQ)・候補・活動・予定/リマインド・売上/粗利を一元管理する単一企業向けシステム。
- 状態：合意（要件定義中）
- 関連：ADR-0007, ADR-0008 / docs/staffing-alignment.html / spec:staffing
- 備考：機能詳細はブリーフ原文と spec:staffing を真実とする。本 REQ は親要件。

### REQ-0006  スケジュール＋自動リマインド
- 2026-06-07 / ブリーフ §8
- 内容：予定（打合せ/案件実施/返信期限）に reminder_offsets を持たせ、定期実行で通知。MVP はメール。
- 状態：合意（新規実装）
- 関連：REQ-0005 / spec:staffing#スケジュール

### REQ-0007  売上・粗利・請求管理
- 2026-06-07 / ブリーフ §9
- 内容：粗利＝発注単価−提示単価。請求/入金ステータスと月次集計・ダッシュボード。
- 状態：合意（要拡張）
- 関連：REQ-0005 / spec:staffing#売上

### REQ-0008  Gemini による LINE 本文解析
- 2026-06-07 / ブリーフ §7
- 内容：貼付本文＋文脈から厳密 JSON を生成（intent 判定・相対日付/金額正規化・低信頼時 ambiguities 提示）。鍵はサーバー env のみ。
- 状態：合意（新規実装）
- 関連：REQ-0004, ADR-0004, ADR-0008 / spec:staffing#クイック登録

### REQ-0009  統合版 Bract を実サーバーで動かす
- 2026-06-07 / 会話
- 内容：統合版リポ `takng-cb/Bract` を Vercel + Neon + Supabase の実サーバーにデプロイして稼働させる。
- 状態：**進行中** — dev Neon(`ep-autumn-king`) に schema 投入完了(check:schema 緑・全41表) ＋ Vercel Preview ビルド緑（env 登録後）。
- 関連：ADR-0003, ADR-0014 / docs/deployment-runbook.md
- 備考：
  - dev は専用 Neon。Vercel env に DATABASE_URL/SUPABASE/NEXT_PUBLIC_INDUSTRY=base を登録して通過。
  - **認証は既存 Supabase を共有**（dev も本番も同じ Supabase Auth）。dev ログイン可だが、dev Neon `users` 行が無いと role は既定 `viewer`。admin 化は dev Neon の `users` に該当 Supabase uid の行を追加する。
  - OPEN-D3（将来）：dev 専用 Supabase に分離するか（現状は共有で許容）。

### REQ-0010  「オブジェクト」呼称の変更（脱・Salesforce感）
- 2026-06-08 / 会話
- 内容：`object_definitions` 等で「オブジェクト」と呼ぶ概念の呼称を、Salesforce 感を避けて変更したい。
- 状態：**方針決定＝全面リネーム**（ADR-0017）。**新名称＝「ブック(Book)」**、階層 モジュール>ブック>レコード（ADR-0018）。各ブックは所属モジュールを持ち #10 と統合実装。レコード呼称など細部は確認中。

### REQ-0011  オブジェクト間参照のデータモデル方針
- 2026-06-08 / 会話
- 内容：参照を「項目(フィールド)」で持つか「専用の関係テーブル」で持つか、方針を決める。
- 状態：設計判断中（ADR化予定。既存: `relationship_definitions`/`relationship_values` ＋ 参照項目/FK 列が両方ある）

### REQ-0012  リリース後の画面カスタマイズ性向上
- 2026-06-08 / 会話
- 内容：ユーザーによるダッシュボード変更など、リリース後の画面カスタマイズを強化したい。
- 状態：**決定＝まず「ユーザーごとダッシュボード」を強化**（`user_dashboard_widgets` 拡張）。他画面(一覧/詳細/ナビ)は後続。
- 既存基盤: `user_dashboard_widgets`/`saved_views`/`list_view_settings`/`user_preferences`/`field_definitions`

### REQ-0013  ERP モジュールの作成
- 2026-06-08 / 会話
- 内容：在庫・会計などの ERP モジュールを作る。
- 状態：検討中（着手順は ADR-0009 と要調整＝レジストリ先行か）。関連: docs/module-catalog.md, #9

### REQ-0014  入力の手間を減らす（入力負荷の軽減）
- 2026-06-08 / 会話
- 内容：データ入力が手間という課題を解消したい。
- 状態：検討中。戦略的な解は **AI 入力補助（コントラクトファースト draft-then-apply）を staffing 限定でなく全オブジェクト共通の基盤機能に一般化**すること（REQ-0004/ADR-0004 の拡張）。補助策：インライン編集・一括編集・テンプレ/既定値・CSVインポート（既存）・名刺OCR/音声 等。
- 関連：REQ-0004, ADR-0004 / docs/ai-input-assistant.md

---

## 未決（着手前にユーザー合意が必要）

> すり合わせ資料 `docs/staffing-alignment.html` §10 の論点。合意したら上に REQ/ADR として確定する。

- ~~**OPEN-A4**：進め方＝基盤レジストリ化(Phase1-2)を先か、手配機能を先か。~~ → **決定：B（手配機能を先）。ADR-0009**
- ~~**OPEN-B1**：リマインド既定タイミング~~ → **決定：リマインド機能は一旦なし（MVP外）。ADR-0011**
- ~~**OPEN-B2**：リピート人材を `staff` として保存するか~~ → **決定：保存する（推奨採用）**
- ~~**OPEN-B3**：請求書PDF/会計連携を MVP に含めるか~~ → **保留：MVP外（後回し、CSV で代替）**
- ~~**OPEN-B4**：Gemini 鍵は env 固定か DB 固定か~~ → **決定：Vercel 環境変数で env 固定。ADR-0013**

> ✅ 上記 OPEN（A4/B1-B5/C1-C3）はすべて解消。Phase 1（スキーマ＋マスタ）設計へ進める状態。

## GitHub Issue 対応（takng-cb/Bract・ADR-0015）

| Issue | 内容 | 関連 REQ/ADR |
|---|---|---|
| #9  | [platform] CRM/ERP モジュラー化 (umbrella) | REQ-0001/0002/0003 |
| #10 | [platform] Phase1 モジュールレジストリ基盤 | REQ-0002, ADR-0001 |
| #11 | [platform] Phase2 ランタイム・ゲーティング + /admin/modules（機能ON/OFF） | REQ-0002, ADR-0002/0005 |
| #12 | [platform] Phase3 ビルドプロファイル | REQ-0003, ADR-0002 |
| #13 | [platform] Phase4-6 移設/分割/スキーマ分離 | docs/migration-roadmap |
| #14 | [staffing] 人材手配MVP (umbrella) | REQ-0005, ADR-0007 |
| #15 | [staffing] Phase1 スキーマ+マスタ | REQ-0005, ADR-0008/0010 |
| #16 | [staffing] Phase3 クイック登録(AI) | REQ-0004/0008, ADR-0012/0013 |
| #17 | [ops] dev環境 残作業 | REQ-0009, ADR-0014, OPEN-D3 |
| #18 | [ops] 旧Bract-CRMの扱い・本番移行 | OPEN-D1, ADR-0006 |
| #19 | [chore] 複製残骸クリーンアップ | — |
| #21 | [platform] 「オブジェクト」呼称の全面リネーム | REQ-0010, ADR-0017 |
| #22 | [platform] ダッシュボードのユーザー別カスタマイズ強化 | REQ-0012 |

> 設計PR: #20（feature/erp-modular-design → develop）。Git運用は Gitflow（ADR-0015）。

## 未決（運用・デプロイ）

- **OPEN-D1**：既存 `Bract-CRM`（旧リポ）と本番2デプロイ（real-estate/auto-body）の今後。推奨：旧リポはアーカイブ扱い、新 `Bract` を唯一の真実とし、本番は準備が整い次第 新リポへ寄せる（時期は別途）。
- ~~**OPEN-D2**：統合版の最初の実サーバー化の方式~~ → **決定：統合版は dev 環境として専用 Neon＋専用 Vercel で立てる。ADR-0014**
- ~~**OPEN-B5**：権限区分~~ → **決定：既存ロール（admin/editor/viewer）流用（推奨採用）**
- ~~**OPEN-C1**：単価モデル~~ → **決定：案件固定単価を主・登録後も変更可。時給は任意。ADR-0010**
- ~~**OPEN-C2**：メール送信は Resend でよいか~~ → **保留：B1（リマインドなし）により MVP 不要。ADR-0011**
- ~~**OPEN-C3**：個人情報の LLM 送信ポリシー~~ → **決定：送信を許可（機能上必須）＋安全策。ADR-0012**
