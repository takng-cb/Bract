# 仕様：レコード承認（Approvals）

> 生きた仕様。確定済みの内容を反映する。経緯は REQ-0023 / REQ-0037 / ADR-0022 / #85 を参照。
> ステータス：**Phase1+2 実装済み**（全ブック＋ステータス遷移トリガー。Phase3 承認待ち一覧は未）。
>
> Phase1 実装メモ（2026-06-11）:
> - スキーマ：`approvals` / `approval_decisions`（migration `20260611180000_approvals.sql`）
> - 設定保存：system_settings `approval_config:<book_api>`（本仕様の ApprovalConfig JSON）
> - ルール評価：`src/lib/approvalRules.ts`（純関数・unit test 付き）。多段 step / any・all / user・role 承認者はデータモデルとして実装済み
> - UI：レコード詳細の承認セクション（申請/承認/差戻し/取消/履歴）
> - 編集ロック：承認待ち中は expenses の update/delete action が拒否＋詳細ページの編集 UI 非表示
> - 通知は #25（Discord 基盤）側で対応（本機能では未実装）
>
> Phase2 実装メモ（2026-06-11・REQ-0037）:
> - **ステータス遷移トリガー**：ルールに `transition: { field, from?, to? }`（空=任意）。
>   StageBar のステータス変更は `requestStatusChange`（actions/approvals.ts）を経由し、
>   遷移ルールにマッチすると変更を保留して承認待ちを作成（approvals.transition jsonb、
>   migration `20260611210000_approvals_transition.sql`）。最終承認で変更を自動適用（change_logs 記録込み）。
> - **全ブック対応**：loadRecordValues / applyFieldChange が全 typed ブック（TABLE_BY_API）＋カスタムブック（data JSON）に対応。
>   対象 7 詳細ページ（取引先/商談/整備/車両/物件/スタッフ/案件）に承認セクション設置（経費は Phase1 から）。
> - **設定エディタ v2**（/admin/objects）：ブック選択 × 複数ルール × トリガー（手動/遷移）× 条件 × 多段ステップ。
>   保存は ApprovalConfig JSON を `sanitizeApprovalConfig` で厳格検証。
> - 編集ロックの範囲：経費は全編集ロック。他ブックは Phase2 時点では「承認待ち中のステータス再変更」をロック
>   （フィールド編集の全面ロックは今後の課題）。

## 目的

各種レコードに「必要に応じた承認」を付与する（例：高額経費、商談の値引き、整備見積）。
レコード側にスキーマ列を足さず、**汎用 approval レイヤー**として横断的に提供する。

## スコープと基本方針（確定）

| 論点 | 決定 |
|---|---|
| 適用範囲 | **全ブックで設定可能**（typed ブック・カスタムブック問わずブック単位で ON/OFF） |
| ルーティング | **条件ベース**。金額に限らず**ブックの任意フィールド**を条件にできる。順序付きルールを上から評価し、最初にマッチしたルートを採用 |
| 段数 | **多段（最初から）**。申請 → step1 → step2 … の順序付き。step ごとに承認者と「全員/いずれか」を指定 |
| 承認者 | **指定方式**（`approver` ロールは新設しない）。ブック/ルート/step ごとにユーザーまたは既存ロールを指定 |
| 編集制約 | 承認待ち中は**当該レコードを編集ロック**（差戻しで解除）。承認後の変更は再申請扱い |
| 取消・再申請 | 却下後の再申請は可。承認済みの取消は admin のみ |
| 通知 | 申請/結果をアプリ内＋Discord（既存通知基盤） |
| 監査 | `approvals` に各 step の決定履歴 ＋ `change_logs` 併用 |

## データモデル（案）

### `approvals`（申請インスタンス）
polymorphic で任意レコードに紐づく。

| 列 | 内容 |
|---|---|
| `id` | PK |
| `object_type` | 対象ブック（object_definitions の api_name / typed テーブル名） |
| `object_id` | 対象レコード id |
| `status` | `pending` / `approved` / `rejected`（= 差戻し）/ `cancelled` |
| `requested_by` | 申請者 user id |
| `current_step` | 進行中の step 番号 |
| `route_snapshot` | 申請時点で確定したルート（step 構成・承認者）の JSON スナップショット |
| `requested_at` / `decided_at` | 日時 |
| `comment` | 申請コメント |

### `approval_decisions`（各 step の判定履歴）
| 列 | 内容 |
|---|---|
| `id` | PK |
| `approval_id` | FK → approvals |
| `step` | step 番号 |
| `approver_id` | 判定した承認者 |
| `decision` | `approved` / `rejected` |
| `comment` / `decided_at` | コメント・日時 |

### 承認設定（`approval_configs` or object_definitions メタ）
ブック単位の有効化＋ルール定義。

```jsonc
{
  "enabled": true,
  "rules": [                       // 上から評価、最初にマッチしたものを採用
    {
      "when": { "all": [           // 任意フィールドの条件（all / any）
        { "field": "amount", "op": ">=", "value": 100000 },
        { "field": "type",   "op": "=",  "value": "値引き" }
      ]},
      "steps": [                   // 多段
        { "approvers": ["user:..."], "mode": "any" },
        { "approvers": ["role:admin"], "mode": "all" }
      ]
    }
    // マッチするルールが無ければ承認不要（そのまま確定）
  ]
}
```

条件 `op`：`= != > >= < <= in contains`（フィールド型に応じて）。

## フロー

1. 申請：レコード詳細で「承認を申請」。設定のルールを評価し、マッチしたルートを `route_snapshot` に固定して `approvals` を作成（`status=pending, current_step=1`）。マッチ無し＝承認不要。
2. 各 step：その step の承認者に通知。`mode=any` は1人、`mode=all` は全員の承認で次 step へ。最終 step 承認で `status=approved`。
3. 差戻し：いずれかの承認者が却下 → `status=rejected`、申請者へ通知、編集ロック解除。
4. 再申請：差戻し/却下後に再度申請可（新しい `approvals` 行）。
5. 取消：承認済みの取消は admin のみ。

## UI

- レコード詳細：承認バッジ（未申請/承認待ち step n/承認済/差戻し）＋権限に応じた「申請」「承認」「差戻し」ボタン。承認待ち中は編集 UI をロック表示。
- 「自分が承認すべき」一覧：ナビ項目＋ダッシュボードウィジェット（#22/#105 のウィジェット機構を流用）。

## 段階実装

- **Phase1**：単一ブック（例：経費）で単純条件＋実質単段ルートを通し、`approvals` 基盤・バッジ・申請/承認 UI・通知を確立。
- **Phase2**：多段・複数条件、全ブックの設定 UI（ブック設定にルールエディタ）。
- **Phase3**：承認待ち一覧/ウィジェットの高度化、監査ビュー。

## 関連
- REQ-0023 / ADR-0022 / #85
- 流用基盤：polymorphic 関連, `change_logs`, 通知(Discord), ロール(admin/editor/viewer), ダッシュボードウィジェット(#22/#105)
