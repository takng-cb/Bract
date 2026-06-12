# Issue #88 設計ドラフト（未承認・実装前）

> 業務報告を最小手数にする仕組み — 方針すり合わせ資料。
> 作成日: 2026-06-12 / 対象 Issue: [#88]（コメントでオーナー回答済み）
> 関連: #49（AI作成 draft-then-apply / REQ-0022）, #85（承認 / ADR-0022）, #86（AI検索）, ADR-0004（AIはコントラクトファーストの入力補助）, ADR-0012（個人情報をLLMに送る際の安全策）

---

## 1. 課題の整理（誰が・いつ・何を報告するか）

### オーナー回答（Issue コメント）で確定済みの前提

| 論点 | 回答 |
|---|---|
| 報告の種類 | **案件単位の報告**が優先（日報・週報は当面対象外） |
| 一括入力 | **複数案件の報告を音声でまとめて話す**ケースあり → 文字起こしから**案件/商談ごとに分割して登録**したい |
| データモデル | **活動（activities）に内容をためて、その要約をレポートに出力** |
| リマインド | 不要（定期通知は作らない） |
| テンプレ | **ユーザーが追加できる**こと |

### 想定ユースケース

- **U1: 現場担当者の帰社後/移動中の報告** — 「今日は A 社の現場で◯◯、B 案件は△△だった」を音声/走り書きで一括入力 → 案件別の活動として登録。
- **U2: 案件担当者の案件報告** — 案件/商談詳細から「報告を作成」→ 期間内の活動を AI が要約 → テンプレ整形 → コピー/共有。
- **U3:（将来）管理者・顧客向けの期間レポート** — 週次/顧客別の要約出力（Issue 本文の D 案、今回スコープ外）。

### 現状の手数（課題）

活動の入力経路は ①`/activities/new`（ActivityForm）②詳細ページの ActivityStream インライン composer（`quickCreateActivity`）③クイック操作の AI 作成（`quickAi.ts`、活動1件ずつ）。いずれも **1 件ずつ・関連先を手で選ぶ** 前提で、複数案件分の報告は N 回の操作が必要。報告書化は `summarizeOpportunity/Property`（AISummaryButton）があるが商談/物件のみで、テンプレ固定・案件（assignments）非対応。

---

## 2. 既存資産（再利用前提の棚卸し）

| 資産 | 場所 | 流用ポイント |
|---|---|---|
| 活動＋多態 junction | `src/lib/schema.ts` `activities` / `activity_related_records`（`related_object_api` = 'account'/'contact'/'opportunity'/'assignment'/book api） | 報告の一次データ置き場。**新テーブル不要** |
| AI 抽出（draft-then-apply） | `src/app/actions/quickAi.ts` `quickAiExtract`/`quickAiCreate`（活動 spec・linkable・インジェクション対策プロンプト込み） | 単票抽出 → **複数件抽出に拡張** |
| 関連先横断検索 | `quickAi.ts` `quickRelatedSearch`（取引先/人物/商談） | AI が出した案件名 → 実レコード解決。**assignments を追加するだけ** |
| 期間要約 | `src/lib/ai/summarize.ts` `summarizeActivitiesAndTasks`（objectApi+recordId+期間 → 整形 → callAI） | 案件報告レポートの心臓部。**objectApi='assignment' を渡せばほぼ動く** |
| AI 基盤 | `src/lib/ai/client.ts`（callAI, vision 対応）, `rateLimit.ts`, `featureFlag.ts`, prompts は system_settings 管理 | そのまま利用 |
| ウィザード UI | `QuickLauncher.tsx`（グローバル）, `StaffingQuickWizard` + `quickRegister.ts`（貼付→抽出→確認→apply の完成形） | 一括報告ウィザードの UI/フロー雛形 |
| 出力先 | `src/lib/notifications/discord.ts`（best-effort webhook）, 承認 `approvals`（多態・#85） | 報告の送信/承認連携は**任意のオプション** |

---

## 3. 設計案の比較（2.5 案）

### 案A: 一括報告インボックス（フリーテキスト/音声 → AI が案件別に分割 → 複数活動を draft-then-apply）

- **UX**: 「報告する」1 箱（テキスト or ブラウザ音声入力）→ AI が報告を案件/商談ごとに分割し `{関連先候補, 活動種別, 件名, 内容, 日時}` の**複数ドラフト**を提示 → ユーザーが関連先を確定/補正（`quickRelatedSearch` 候補）→ 一括登録（既存 `activities` INSERT + junction）。
- **実装規模**: 中。`quickAiExtract` の複数レコード版 server action ＋確認 UI（StaffingQuickWizard 流儀）。音声は Web Speech API（クライアントのみ、追加コストなし。現状リポに実装なし＝新規）。
- **再利用度**: 高（quickAi のプロンプト/JSON 抽出/レート制限/権限チェック、quickRelatedSearch、活動 create をすべて流用）。
- **適合**: オーナー要望の「複数案件の一括音声報告 → 分割登録」に直撃。

### 案B: テンプレ選択式の案件報告（活動の期間集約 → AI 要約レポート）

- **UX**: 案件（assignments）/商談詳細に「報告を作成」→ 期間＋テンプレ選択 → その期間の活動・ToDo を集約して AI がテンプレ書式で要約 → 画面表示・編集 → コピー/（任意）Discord 送信/保存。
- **実装規模**: 小。`summarizeActivitiesAndTasks` に objectApi='assignment' を通し、テンプレ（=システムプロンプト断片）を渡すだけ。テンプレ保存に `report_templates` テーブル 1 本（後述）。
- **再利用度**: 最高（AISummaryButton の UX 拡張）。
- **限界**: 入力側の手数は減らない（活動が貯まっている前提）。

### 案C: 外部入力チャネル（LINE/メール転送 → 取り込み）

- **UX**: LINE や メールを専用アドレス/webhook に転送 → 案A と同じ分割 → ただし非同期（取り込みトレイで後から確認）。
- **実装規模**: 大（受信エンドポイント、認証・なりすまし対策、未確認トレイの新画面、運用監視）。
- **再利用度**: 中。**今回は見送り推奨**（案A の入力箱が PWA/モバイルで開ければ大半のニーズを満たす。将来 #88 派生 Issue で）。

### 比較まとめ

| | 入力の手数削減 | 出力（報告書） | 規模 | 既存再利用 |
|---|---|---|---|---|
| 案A | ◎（一括・音声） | —（活動を作るまで） | 中 | 高 |
| 案B | △ | ◎（テンプレ要約） | 小 | 最高 |
| 案C | ◎ | — | 大 | 中 |

---

## 4. 推奨案と理由

**推奨: 案B ＋ 案A の組み合わせ（B を Phase 1、A を Phase 2）。C は見送り。**

オーナーの確定方針「**活動にためて、要約をレポート出力**」は、入力（A）と出力（B）の両輪で初めて成立する。両案とも既存資産の薄い拡張で済み、かつ:

- **draft-then-apply 原則（CLAUDE.md / ADR-0004）に完全整合**: 案A は AI 出力を必ず確認画面に出し、apply 層（server action）が `requirePermission` ＋バリデーションを通して INSERT。AI が DB を直接触る箇所はゼロ。案B は読み取り専用（要約生成のみ）で、保存はユーザー操作。
- **新規エンティティ最小**: 一次データは既存 `activities`。新規は `report_templates`（＋任意で `reports`）のみ。
- **業種非依存**: activities / junction / quickAi は共通層なので `src/app/actions/` ＋ `src/components/` に置く（業種ガード不要）。案件＝assignments は staffing モジュールだが、`isModuleEnabled('staffing')` 分岐で対応（ペア確認: 商談・物件・整備でも同 UI が動くこと）。

### データモデル（追加分）

```
report_templates:  id, name, body(プロンプト/書式), owner_id(null=共有), created_at, updated_at
reports(任意/Phase1.5): id, template_id, target_object_api, target_record_id,
                        period_from, period_to, body(確定本文), created_by, created_at
```

- migration は冪等（IF NOT EXISTS）で書き、**全 Neon（base / real-estate / auto-body）に適用**（AGENTS.md 大原則）。
- テンプレが 0 件でも動くよう、コード側にデフォルトテンプレ 1 本をフォールバック内蔵。

---

## 5. 段階実装の Phase 分割（各 Phase 単独リリース可能）

### Phase 1: 案件単位の報告レポート生成（案B・最小形）
- 案件（assignments）/商談詳細に「報告を作成」ボタン → 期間＋テンプレ選択 → AI 要約 → 表示・編集・コピー。
- 実装: `summarizeActivitiesAndTasks` を objectApi='assignment' で呼ぶ server action（`requireEditor`＋`ensureAIFeatureEnabled`）、`report_templates` テーブル＋簡易な追加 UI（一覧＋新規のみ。本格管理は Phase 3）、AISummaryButton 拡張 or 専用モーダル。
- **保存なし（その場生成）で出す**。コピー/印刷で完結 → 単独リリース可。

### Phase 2: 一括報告インボックス（案A）
- グローバル「報告する」入口（QuickLauncher に1項目追加 or `/report` ページ）。テキスト一括入力 → AI 分割 → 複数活動ドラフト確認 → 一括 apply。
- 実装: `quickAiExtract` の複数件版（JSON 形式 `{items:[{related_hint, type, subject, body, occurred_at}], note}`）、`quickRelatedSearch` に assignments 追加、確認 UI（行ごとに関連先 picker・削除可）。
- 音声は **Web Speech API をテキストボックスへの入力手段として実装**（録音保存なし）。非対応ブラウザはテキストのみ＝機能劣化で済む。

### Phase 3: テンプレ管理＋レポート保存
- 設定画面にテンプレ CRUD（個人/共有）、`reports` テーブルで生成履歴の保存・再表示、（任意）Discord 送信ボタン。

各 Phase で検証ゲート（3 業種 build / check:schema / smoke / industry-guard）を通す。

---

## 6. 未決事項（ユーザーに決めてもらう論点）

1. **「案件」の範囲**: 報告の関連先は assignments（人材手配）＋ opportunities（商談）で良いか。整備（maintenance_records）や物件も Phase 1 から対象にするか。
2. **Phase 1 のレポートは保存するか**: その場生成＋コピーのみで開始してよいか（保存・履歴は Phase 3 へ後ろ倒しの提案）。
3. **音声入力の方式**: Web Speech API（無料・ブラウザ依存、Chrome/Edge ◎・iOS Safari △）で開始してよいか。精度不足なら Whisper API 等を後付け検討。
4. **一括登録の最大件数/ガード**: 1 回の報告から作る活動数の上限（例: 10 件）と、関連先が解決できなかった項目の扱い（未紐づけで作る or 登録スキップ）。
5. **テンプレの共有範囲**: 個人テンプレと全員共有テンプレの 2 層で良いか。共有テンプレの編集権限は admin のみか。
6. **出力先**: 画面表示＋コピーで開始 → Discord 送信は Phase 3、PDF/承認(#85)連携は別 Issue、で良いか。
7. **入口の置き場所**: 一括報告（Phase 2）はグローバル QuickLauncher 内の 1 ステップにするか、独立ページ（モバイル PWA からワンタップ）にするか。

---

## 7. 採用時の記録（実装着手時に実施）

- `docs/requirements/requirements-log.md` に REQ 追記（次番: **REQ-0057〜**）。
- `docs/requirements/decisions.md` に本ドラフトの決定版を ADR 追記（次番: **ADR-0025**）。
- Issue #88 に本ドラフトの結論と未決事項の回答を反映してから feature ブランチ作成（`feature/report-*` → develop）。
