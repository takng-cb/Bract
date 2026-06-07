# Bract — AI 入力補助（コントラクトファースト / draft-then-apply）設計

> 「時代は AI なので LLM 起点で行動できる形に」という要件に対する、**安全で段階的な**設計。
> 全体像は [`docs/erp-architecture.md`](./erp-architecture.md) §5 を参照。

---

## 1. 方針：まずは「入力補助」、LLM は DB を直接触らない

LLM を**自律実行エージェント**にするのではなく、**構造化データを作る入力補助**として導入する。
LLM の出力は必ず **人の確認**と **決定論的な apply 層のバリデーション**を通ってから DB に反映される（human-in-the-loop）。

```
[ユーザー入力(自由文/名刺/議事録/メール)]
        │
        ▼
[プロンプト生成]  対象モジュールの「入力コントラクト(JSON schema)」でラップ
        │          "次の情報を、この schema に厳密準拠する JSON にして"
        ▼
[LLM]  schema 準拠の構造化データ(JSON/CSV)を生成
        │
        ▼
[プレビュー UI]  ユーザーが確認・修正（差分表示、項目編集）
        │
        ▼
[apply 層]  既存の server action / import パイプラインで検証 → DB 反映
            ★ ここが最終ゲート。LLM は直接 INSERT/UPDATE しない
```

### この設計の利点
- **安全**：不正・幻覚データは apply 層のバリデーションで弾かれる。承認するまで DB は変わらない。
- **低リスクで価値が出る**：危険な実行系を新設せず、**既存の CSV インポート機能の前段に LLM を足すだけ**で PoC 可能。
- **将来に延びる**：同じコントラクトを MCP ツールとして公開すれば、そのまま L2（外部エージェント）へ無改修拡張できる。

---

## 2. コントラクト = AI / UI / インポートの共通の真実

各モジュール（オブジェクト）について、**create/update の入力形**を1か所で型付き宣言する。これを「入力コントラクト」と呼ぶ。

```ts
// src/modules/<id>/contracts.ts（イメージ。実装時に zod 等を選定）
export const accountContract = defineContract({
  object: 'accounts',
  fields: {
    name:        { type: 'string',  required: true,  label: '取引先名' },
    industry:    { type: 'string',  required: false, label: '業種' },
    phone:       { type: 'string',  required: false, label: '電話', pattern: /…/ },
    owner_id:    { type: 'ref',     required: false, label: '担当', refObject: 'users' },
    // …
  },
  // LLM 用の追加ヒント（曖昧語の正規化規則、列挙値の候補 等）
  llmHints: { /* … */ },
})
```

1つのコントラクトが**4役**をこなす:

| 役割 | 使われ方 |
|---|---|
| ① LLM 出力の制約 | JSON schema 化して「この形で出せ」と指示。構造化出力 / function-calling の引数 schema にも転用可 |
| ② apply バリデーション | 受け取った JSON/CSV を同じ schema で検証してから DB 反映 |
| ③ CSV インポート/エクスポート | 既存 `src/app/api/import/*` `src/app/api/export/*` の列定義として共有 |
| ④ （将来）UI フォーム生成 | フォームの項目・必須・型を schema から導出（重複削減） |

> **既存資産との接続**：Bract には既にオブジェクトごとの CSV import/export と、
> `object_definitions` / `field_definitions`（メタ定義）がある。コントラクトはこれらと整合させ、
> 可能な範囲で `field_definitions` から自動導出する（二重管理を避ける）。

---

## 3. apply パイプライン（最終ゲート）

LLM 出力 → 確定の経路は、**新規の書き込み経路を作らず**、既存の検証済み経路に合流させる。

```
LLM 生成 JSON/CSV
   → コントラクト検証（型・必須・列挙・参照整合）
   → 既存 import パイプライン or 対象モジュールの server action(createXxx/updateXxx)
   → 既存の権限チェック(requireEditor 等) と監査ログ(audit_log) を通過
   → DB 反映
```

- **権限**：apply はログイン中ユーザーの権限で実行（LLM が権限を昇格しない）。
- **監査**：`audit_log` に「AI 補助で生成 → ユーザー◯◯が承認」と記録できるよう、アクター情報を残す。
- **冪等/プレビュー**：apply 前に必ず差分プレビュー。一括（CSV）は行単位でエラー表示。

---

## 4. ユースケース例（PoC 候補）

| ユースケース | 入力 | 対象コントラクト | 出力 |
|---|---|---|---|
| 名刺 → 取引先+人物 | 名刺画像/テキスト | accounts + contacts | 2レコードの JSON（関連付き） |
| 議事録 → 活動履歴+ToDo | 会議メモ | activities + tasks | 活動1件 + フォローToDo数件 |
| メール本文 → 商談更新 | 受信メール | opportunities(update) | ステージ/金額の更新 JSON |
| 表データ貼付 → 一括インポート | スプレッドシート断片 | 任意オブジェクト | CSV（既存 import に投入） |

> 最初の実装対象は **「名刺/議事録 → CRM レコード生成」**（crm-core/sales のコントラクトのみで成立し、既存 import 経路に乗せやすい）。

---

## 5. 段階（無改修で延ばす）

| レベル | 内容 | 状態 |
|---|---|---|
| **L1 入力補助** | コントラクト駆動の draft-then-apply | **今回の主眼**（ロードマップ Phase 7） |
| L2 外部エージェント | コントラクトを **MCP ツール**として公開 → 外部 LLM(Claude 等)が操作 | 将来。コントラクトがあるため機械的に公開可能 |
| L3 自律エージェント | スケジュール/イベント起動で提案・下書き・自動処理 | 将来。L1/L2 の上に runtime を足す |

L1 で作る「コントラクト」と「apply 層」は L2/L3 でもそのまま中核として再利用される。**だから今コントラクトを正しく置くことが最重要**。

---

## 6. 実装で詰める点（次セッション以降）
- コントラクト DSL の選定（zod / valibot / 独自）と `field_definitions` からの自動導出範囲。
- LLM プロバイダ（既存 `src/lib/ai/providers/` の Groq/Gemini/Anthropic）と構造化出力(JSON mode/function calling)の対応。
- プレビュー UI のコンポーネント（差分表示・行編集・一括承認）。
- コスト/レート管理（複数社運用時の従量・上限）。ライセンス機構で計量可能にする。
