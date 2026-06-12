# Issue #87 設計ドラフト（未承認・実装前）

AI検索 Phase2/3 — 横断セマンティック検索 ＋ レコードQA(RAG)
作成: 2026-06-12 / 対象リポ: takng-cb/Bract / 関連: PR #86（v1）, #49（AI基盤）, ADR-0012/0013, ADR-0023(RBAC)

---

## 1. ゴールの整理

| 機能 | 何ができるか | 例 | 出力 |
|---|---|---|---|
| **Phase2: セマンティック検索** | 語句が一致しなくても「意味が近い」レコードを横断で発見 | 「外壁の傷の修理」→ 整備レコード「バンパー擦過傷 板金塗装」 | レコード一覧（リンク） |
| **Phase3: レコードQA (RAG)** | 複数レコードを文脈に集めて自然文で**回答** | 「A社との直近のやりとりは？」→ 活動/商談を要約し出典リンク付きで回答 | 文章＋出典リンク |

区別: Phase2 は「**見つける**」（結果はあくまでレコードへの導線、AI は並べるだけ）。Phase3 は「**答える**」（AI が文章を生成するためハルシネーション対策＝出典必須が前提）。Phase3 の検索部は Phase2 をそのまま再利用する（Phase2 が土台）。

なお既存資産との関係:
- **グローバル検索**（`src/app/actions/search.ts` + `searchWhere.ts`、Topbar）: 全テキストカラム ILIKE。完全一致系はこれが最速・最安 → **置き換えず併存**。
- **AI検索 v1**（`src/app/actions/aiSearch.ts`、QuickLauncher の `aiSearch` ステップ）: 自然文→単一ブックのフィルタ条件（draft-then-apply）。構造化条件（金額・日付・ステージ）はこちらが正確 → 併存。

## 2. アーキテクチャ案の比較

### 案A: pgvector ＋ Gemini embeddings（Issue 記載の構成）
- Neon に `CREATE EXTENSION IF NOT EXISTS vector`（Neon は pgvector 公式サポート）。
- 新テーブル `record_embeddings(book_api text, record_id uuid, content_hash text, embedding vector(768), updated_at)`。主要項目を連結した「検索用テキスト」を `gemini-embedding-001` で埋め込み。
- 検索: クエリを埋め込み → コサイン近傍 top-k（HNSW index）→ ブック単位で `canDo(book,'read')` フィルタ → 一覧。
- 長所: 曖昧クエリへの再現率が最も高い。日本語品質も gemini-embedding-001 は多言語で良好。Phase3 の土台にそのまま使える。
- 短所: 埋め込みの**鮮度管理**（書込フックの全経路網羅＋バックフィル）という新しい運用部品が増える。embedding API は **Gemini のみ**（Groq/Anthropic に embedding API なし）→ プロバイダ抽象に非対称が入る。

### 案B: 埋め込みなし — LLM が構造化検索を組み立てる（v1 の横断拡張）
- v1 の `SEARCH_FIELDS` を全ブックに広げ、LLM に「どのブックを・どの条件/キーワードで」検索するか出力させ、既存の `textColumnsWhere` / FilterColumnResolver の SQL で実行。
- 長所: **インフラ追加ゼロ**（マイグレ不要・鮮度問題なし・DB にベクトル列なし）。実装は v1 の延長で小さい。コストは 1 クエリ 1 LLM 呼び出しのみ。
- 短所: 結局 ILIKE なので「語句が違うが意味が近い」は LLM の**言い換え生成**（類義語展開）頼みで再現率に限界。レイテンシ（LLM 1往復 2〜5秒）が毎検索かかる。Issue の目的（セマンティック）を本質的には満たさない。Phase3 の検索品質もここがボトルネックに。

### 案C: ハイブリッド（推奨）= 案A のベクトル検索 ＋ 既存 ILIKE の融合
- ベクトル近傍と ILIKE 完全一致を並走させ、RRF（Reciprocal Rank Fusion）等で統合して 1 つの結果に。クエリ埋め込みは LLM 補完より速い（〜数百ms）。
- 長所: 型番・電話番号・固有名詞（ILIKE が強い）と曖昧表現（ベクトルが強い）の両取り。検索 UI は Topbar 検索の拡張として自然に出せる。
- 短所: 案A と同じ鮮度・運用負荷はそのまま。融合ロジック分の実装が少し増える。

### 比較表

| 観点 | 案A (vector のみ) | 案B (LLM→SQL) | 案C (ハイブリッド) |
|---|---|---|---|
| 曖昧クエリ精度 | ◎ | △ | ◎ |
| 固有名詞・型番精度 | △（ベクトルは弱い） | ◎ | ◎ |
| 検索レイテンシ | ○（embed 1回） | △（LLM 1往復） | ○ |
| ランニングコスト | ○（下記試算） | ○（LLM 呼び出しのみ） | ○ |
| 運用負荷（鮮度・バックフィル） | △ | ◎（なし） | △ |
| 実装規模 | 中 | 小 | 中＋α |
| Phase3 (RAG) の土台 | ◎ | △ | ◎ |

### 埋め込みの鮮度（案A/C 共通）
- **書込時同期更新を基本**とする: 各ブックの create/update server action 末尾で `upsertEmbedding(book, id)`。失敗してもレコード保存は成功させる（フェイルオープン、`content_hash` 不一致で後追い検知）。Vercel serverless のため常駐ワーカーは不可。`after()`（Next.js のレスポンス後実行）でレイテンシ影響を回避。
- **取りこぼし回収**: `scripts/backfill-embeddings.ts`（content_hash が NULL/不一致の行を一括再埋め込み）。初期投入もこれで実施。定期実行は当面手動（将来 Vercel Cron。ADR-0011 は「リマインド用 Cron 不要」の決定であり Cron 自体の禁止ではない）。
- 書込経路は server action に集約済み（AI も draft-then-apply で同経路）なので、フック箇所は各ブックの action ＋ 汎用 book_records action に限定できる。

### コスト試算（gemini-embedding-001、$0.15/1M 入力トークン、1$=150円想定）
| レコード数 | 初期バックフィル（1件 ≈ 300 tokens） | 月次更新 10%＋検索 3,000 回/月 |
|---|---|---|
| 1万件 | 3M tokens ≈ **約70円（1回きり）** | 約10円/月 |
| 10万件 | 30M tokens ≈ 約700円 | 約80円/月 |
| 100万件 | 300M tokens ≈ 約7,000円 | 約800円/月 |

→ コストは実質無視できる規模。支配的なのは Phase3 の生成側（後述）と Neon のストレージ/Compute（768 次元 float で 1 行 ≈ 3KB、10万件で ≈ 300MB ＋ HNSW index）。次元は MRL 縮約で **768** を採用（3072 はストレージ・index 構築負荷に見合わない）。

### 個人情報の扱い（ADR-0012 との整合）
- ADR-0012 は「クイック登録の本文を LLM へ送る（サーバー側のみ・必要分のみ・学習不使用・東京リージョン優先・外部保持最小）」を採用済み。埋め込み生成は **DB 上のレコード本文を網羅的・継続的に外部送信**する点でスコープが広がるため、**ADR-0012 を拡張する新 ADR を起こす**（Supersede ではなく追加）。
- 安全策は同方針を踏襲: サーバー側のみ送信／検索用テキストは主要項目に限定（フィールド allowlist、口座番号等の機微カラムは連結対象から除外）／embedding API は生成 API 同様ステートレス・学習不使用設定／ベクトル自体は自社 Neon（東京）に保存され外部保持なし。
- Phase3 の RAG はヒットしたレコード本文をプロンプトに入れる＝クイック登録と同型であり ADR-0012 の枠内。ただし「ユーザーが read 権限を持つレコードのみ文脈に入れる」を必須ガードとする。

## 3. 推奨案: **案C（ハイブリッド）**、ただし embedding 基盤は案A をそのまま内包

理由:
1. Issue の目的「語句が違っても見つかる」は埋め込みなし（案B）では達成できない。一方ベクトル単独（案A）は CRM で頻出の型番・人名・電話番号検索に弱く、既存 ILIKE 併用が実質必須。
2. コストは試算どおり微小で、運用負荷（鮮度）は書込フック＋バックフィルスクリプトの定型で抑え込める。
3. Phase3 の RAG 検索器としてもハイブリッドが最良（固有名詞を含む質問が多いため）。
4. 案B の「LLM による構造化条件化」は v1 として既に存在しており、捨てずに併存する＝案B の長所は既に確保済み。

embedding プロバイダは当面 **Gemini 固定**（`AIProvider` に optional `embed()` を追加し実装は gemini のみ。テナントの補完プロバイダが groq/anthropic でも、`ai_api_key_gemini` があればセマンティック検索可。なければ機能を自動非表示＝graceful degradation）。

## 4. Phase 分割（各 Phase 単独リリース可能）

### Phase 2a: 埋め込み基盤（挙動非変更・UI なし）
- マイグレ `*_pgvector_record_embeddings.sql`: `CREATE EXTENSION IF NOT EXISTS vector;` ＋ `CREATE TABLE IF NOT EXISTS record_embeddings(...)` ＋ `CREATE INDEX IF NOT EXISTS ... USING hnsw (embedding vector_cosine_ops)`。**冪等・DO $$ 禁止**（`apply-migration.ts` が `;` 分割実行のため）・**全 Neon（real-estate / auto-body / base / dev）に適用**。
- schema.ts に drizzle の `vector()` 型（drizzle-orm 0.45 で対応済み）で宣言。`scripts/check-schema-vs-db.ts` が vector 型と extension を扱えるか検証し、必要なら対応（vercel-build ゲートを壊さない）。
- `src/lib/ai/embeddings.ts`: 検索用テキスト構築（ブック別 allowlist、custom book は data JSON の text 値連結）＋ `upsertEmbedding` ＋ 各 server action へのフック。`scripts/backfill-embeddings.ts`。
- ライセンス: `features.ai_search`（既存 hasFeature 系）でゲート。
- リリース判定: 全 Neon で check:schema 緑・3 業種ビルド・バックフィル完走。**ユーザー可視の変化なし**で安全に main へ。

### Phase 2b: セマンティック検索 UI
- server action `semanticSearch(q)`: 認証 → `ensureFeature('ai_search')` → `assertAiRateLimit()` → クエリ埋め込み → 近傍 top-k（ブック横断）＋既存 `globalSearch` の ILIKE を RRF 融合 → `canDo(book,'read')` でグループ除外（globalSearch と同じ ADR-0023 方式）→ SearchGroup 互換で返す。
- UI: Topbar 検索に「AI で意味検索」行を追加（通常結果の下に遅延表示）or QuickLauncher の search モードに「横断」を追加。類似度の低いヒットは閾値で落とし「関連かも」表示。
- v1（フィルタ変換）はそのまま併存。

### Phase 3: レコードQA（RAG）
- フロー: 質問 → （任意で LLM によるクエリ書き換え/対象ブック推定）→ Phase2 ハイブリッド検索 top-N → read 権限フィルタ → ヒットレコード＋紐づく活動/タスク（related_records junction）を整形してプロンプトへ → `callAI` で回答生成（**出典 ID の引用を強制**、出典のない文は表示しない）→ 回答＋出典リンクカード。
- UI は **チャット型ではなく「検索結果＋AI 要約パネル」** から始める（状態管理・会話履歴の複雑さを回避。チャット化は需要を見て）。
- コスト: 1 質問 ≈ 文脈 5〜10K tokens（gemini-2.5-flash で 1 円未満/質問）。既存レート制限（20回/分/ユーザー）を適用、必要なら QA 用に別枠。
- リリース判定: ハルシネーション検査（出典なし回答が出ないこと）、権限テスト（read 不可ブックの内容が回答に混入しないこと）を E2E に追加。

## 5. 未決事項（ユーザー判断が必要）

1. **対象ブック範囲**: 全ブック（custom book 含む）か、まずコア＋業種ブックに限定か。wiki_pages（長文）を含めるか（チャンク分割が要るのは実質 wiki だけ）。
2. **embedding 送信の新 ADR**: ADR-0012 拡張（全レコード主要項目の継続的送信）を承認するか。機微カラム除外 allowlist の粒度。
3. **embedding プロバイダ Gemini 固定**の方針可否（Groq/Anthropic のみのテナントでは AI 検索が無効になる）。鍵は既存 DB 設定（`ai_api_key_gemini`）か env（ADR-0013 系）か。
4. **再埋め込みの方式**: 書込時同期（`after()`）のみで開始 → Cron 追加は後日、で良いか。
5. **UI の置き場所**: Topbar 検索への統合 vs QuickLauncher vs 専用ページ（/search）。Phase3 を「検索結果＋要約」型で始めることの可否。
6. **削除レコードの掃除**: delete action フックで都度削除か、バックフィル時の孤児掃除で十分か。
7. **dev Neon 先行運用**（ADR-0014）: Phase2a をまず dev 環境のみで回し、本番 2 Neon への適用はバックフィル手順確立後とするか。
8. **ライセンス区分**: `ai_search` を `ai_summary` と別フィーチャーにするか統合するか（課金プラン設計に影響）。

---
*本ドラフトはレビュー用。承認後、REQ/ADR 起票 → feature ブランチ（develop 起点）で Phase2a から着手。*
