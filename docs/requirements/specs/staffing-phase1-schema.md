# 仕様：人材手配 Phase 1 — スキーマ＋マスタ設計

> Phase 1（認証＋スキーマ＋マスタ）の設計。`specs/staffing.md` の §4 を実装レベルに具体化したもの。
> 方針：既存 staffing テーブル（`accounts`/`staff`/`assignments`/`assignment_staff`）を**拡張**し、不足分（`outreach`/`invoices`/`events`）を**新規**追加。
> 規律（CLAUDE.md / AGENTS.md 準拠）：
> - `src/lib/schema.ts` 一本に統合。追加カラムは **nullable または DEFAULT** で base 無害化。
> - マイグレーションは `supabase/migrations/<ts>_<name>.sql` に冪等（`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`）で記述し、全 Neon に適用。
> 関連：ADR-0007（モジュール）, ADR-0008（Drizzle）, ADR-0010（単価=固定・変更可）, ADR-0011（リマインド外）。

## 1. 認証・ロール
- Supabase Auth（既存）。ログインは運営スタッフのみ。
- 権限は既存 `users.role`（admin/editor/viewer）流用（B5）。`requireEditor`/`requireAdmin` をそのまま使用。

## 2. テーブル設計

### 2.1 accounts（クライアント＆紹介会社）— 拡張
既存：`account_role`（'client'|'supplier'|'both'）, name, phone, address, owner_id 等。
追加カラム（nullable）：
| カラム | 型 | 用途 |
|---|---|---|
| `line_type` | text | 'individual'|'official'（LINE 種別） |
| `specialties` | jsonb | 紹介会社の得意領域（タグ配列） |
| `contact_person` | text | 主担当者名（簡易。詳細は contacts 流用可） |

### 2.2 staff（人材／talents）— ほぼ既存のまま
既存：belong_account_id（=紹介会社、null=自社）, name, skills(jsonb), default_hourly_rate, status 等。
追加（nullable）：
| カラム | 型 | 用途 |
|---|---|---|
| `default_fixed_rate` | numeric | 案件固定単価の既定値（ADR-0010） |
| `is_repeat` | boolean DEFAULT false | リピート人材フラグ（B2：保存する） |

### 2.3 assignments（案件／job_orders）— 拡張
既存：assignment_no, client_account_id, service_date, service_start_time/end_time, service_location, service_type, staff_count_required, status, client_total_fee, internal_memo, owner_id。
マッピング：`work_date=service_date`, `headcount=staff_count_required`, `location=service_location`, `client_rate=client_total_fee`（発注単価）。
追加（nullable）：
| カラム | 型 | 用途 |
|---|---|---|
| `role` | text | 募集職種・役割 |
| `raw_message` | text | 貼付した LINE 原文（クイック登録の出所保持） |
| `client_contact_id` | uuid | （既存にあれば流用）窓口担当 |

ステータス（4フェーズの進行）：`受付 / 打診中 / 候補集約 / 確定 / 実施 / 完了`。
既存 default `'予約'` から移行。base 無害化のため値はアプリ側の定数で管理し、DB はテキストのまま。

### 2.4 outreach（打診／RFQ）— 新規
複数の紹介会社へ打診し、返答状況を管理（既存に無い概念）。
| カラム | 型 | 備考 |
|---|---|---|
| `id` | uuid PK | |
| `assignment_id` | uuid FK → assignments(cascade) | |
| `agency_account_id` | uuid FK → accounts(set null) | 紹介会社 |
| `status` | text DEFAULT '打診済' | 打診済/返信待ち/候補あり/該当なし |
| `sent_at` | timestamptz | |
| `notes` | text | |
| `created_at` | timestamptz DEFAULT now() | |

### 2.5 assignment_staff（候補／candidates）— 拡張
既存：assignment_id, staff_id, service_hours, hourly_rate, cost_per_hour, status('予約' 等)。
追加（nullable）：
| カラム | 型 | 用途 |
|---|---|---|
| `agency_account_id` | uuid FK → accounts | どの紹介会社からの候補か |
| `proposed_rate` | numeric | 提示単価（案件固定。ADR-0010） |
| `talent_name` | text | staff 未登録時の候補名（talent_id=null 可） |
| `candidate_status` | text DEFAULT '候補' | 候補/確定/辞退 |

> 粗利 = assignments.client_total_fee − assignment_staff.proposed_rate（確定候補）。**確定単価から都度再計算**（ADR-0010）。生成列にせずアプリ/ビューで計算し、後からの単価変更に追従。

### 2.6 invoices（売上・請求）— 新規
| カラム | 型 | 備考 |
|---|---|---|
| `id` | uuid PK | |
| `assignment_id` | uuid FK → assignments | |
| `candidate_id` | uuid FK → assignment_staff(set null) | 確定候補 |
| `billing_amount` | numeric | 請求額＝発注単価 |
| `payment_amount` | numeric | 支払額＝提示単価 |
| `margin` | numeric | 粗利（= billing − payment。変更時に再計算） |
| `billing_status` | text DEFAULT '未請求' | 未請求/請求済/入金待ち 等 |
| `payment_status` | text DEFAULT '未払' | 未払/支払済 等 |
| `billed_at` / `paid_at` | timestamptz | |
| `created_at` | timestamptz DEFAULT now() | |

### 2.7 events（予定）— 新規（任意・自動通知なし）
リマインドは MVP 外（ADR-0011）。予定の記録/表示のみ。reminder 系列は将来用に nullable で確保。
| カラム | 型 | 備考 |
|---|---|---|
| `id` | uuid PK | |
| `assignment_id` | uuid FK → assignments(null可) | |
| `type` | text | 打合せ/案件実施/返信期限/その他 |
| `title` | text | |
| `start_at` / `end_at` | timestamptz | |
| `reminder_offsets` | jsonb（nullable・将来用） | 例 ['P1D','PT2H'] |
| `reminded` | boolean DEFAULT false（将来用） | |
| `created_at` | timestamptz DEFAULT now() | |

## 3. マスタ管理（CRUD 画面）
- クライアント / 紹介会社：`accounts`（account_role で絞り込み）。既存 accounts CRUD を流用＋追加項目。
- 人材：`staff` CRUD（既存）。

## 4. マイグレーション方針
- 1 ファイルに Phase 1 分をまとめる：`supabase/migrations/<ts>_staffing_phase1.sql`（冪等）。
- 全運用 Neon（base/real-estate/auto-body/将来の staffing 顧客）に適用 → `check:schema` 緑を確認。
- `src/lib/schema.ts` を同時更新（Drizzle 型一本化）。

## 5. Phase 1 の完了条件
- 上記スキーマが全 Neon に適用済み・`check:schema` 緑。
- accounts(client/supplier) / staff の CRUD が動く。
- 3業種 + base のビルドが緑（既存への悪影響なし）。
- 記録：REQ/ADR を更新し、Issue に検証結果。

## 6. 次フェーズへの接続
- Phase 2：assignments ボード＋詳細＋outreach/candidates（単価比較・粗利）。
- Phase 3：クイック登録（contracts.ts ＝ 本スキーマの create/update 入力コントラクト）。
