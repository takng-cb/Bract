# 本番リリース手順 — Neon 立て直し版（チェックリスト）

> 「Neon を新規に立て直して本番リリースする」ためのチェックリスト。
> 既存の詳細手順は [`deployment-runbook.md`](./deployment-runbook.md)、ユーザー登録の運用は [`user-management-guide.md`](./user-management-guide.md)、判定基準は AGENTS.md「リリース判定 go/no-go」。
> 2026-06-11 時点：main は check:schema ゲートにより、未適用 Neon へのデプロイを自動でブロックする
> （＝マイグレ適用が終わるまで本番は現行のまま安全）。

## 0. 前提・現在地

- main には `opportunity_products`（#5）と `roles/role_permissions/users.role_id`（RBAC, ADR-0023）を含む全スキーマが入っている。dev（`ep-autumn-king`）は適用・検証済み。
- 本番用には**業種ごとに新 Neon を1つずつ**作成する（1社=1 Vercel project + 1 Neon、ADR-0003）。

## 1. Neon の作成（業種ごと）

- [ ] Neon console で新 project（または新 branch）を作成し、接続文字列（pooler URL）を控える。
- [ ] リージョンは既存と同じ `ap-southeast-1` を推奨。

## 2. スキーマ＋シードの投入（業種ごと）

この worktree の `.env.local` の `DATABASE_URL` を**新 Neon に差し替えて**から実行（終わったら dev に戻す）：

```powershell
# 1) 全マイグレーションを時系列順に適用（すべて冪等）
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
  npx tsx scripts/apply-migration.ts ("supabase/migrations/" + $_.Name)
}

# 2) 組み込みブック定義（object_definitions / field_definitions）
npx tsx scripts/seed-metadata.ts

# 3) （auto-body のみ）整備パッケージ等の業種マスタ
npx tsx scripts/seed-maintenance-templates.ts

# 4) 整合確認（51+ テーブルが一致すること）
npm run check:schema
```

- [ ] real-estate 用 Neon: 適用済み
- [ ] auto-body 用 Neon: 適用済み
- [ ] （任意）base 用 Neon: 適用済み

### データ移行（旧 Neon から引き継ぐ場合）
- [ ] 旧 Neon を `npx tsx scripts/snapshot-db.ts` でバックアップ
- [ ] `pg_dump --data-only` → 新 Neon に restore（テーブルは作成済みなので data-only）

## 3. アプリ初期設定（業種ごと・新 DB に対して）

- [ ] **licenses 行の投入**（tenant_key='default'）。`features.enabled_modules` / `entitled_modules` をプランに合わせて設定
      （未設定の間は互換シムで `NEXT_PUBLIC_INDUSTRY` の業種モジュールが有効になる）。
- [ ] **初期管理者の作成（運営側オペレーション）**：招待制（REQ-0033）のため自動登録は無い。
      `npx tsx scripts/create-admin-user.ts <email> <password>` で最初の admin を作成
      （.env.local に対象 Neon の DATABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要）。
      以降のユーザー追加は admin がアプリ内「システム設定 → ユーザー管理」で行う。
      管理者が追加したユーザーは、同じメールの Google アカウントでログインすると自動で紐づく
      （以降は Google ログイン可）。未登録アカウントのログインは拒否される。
- [ ] **RBAC ロール設計**：/admin/roles で顧客組織に合わせたロール（例: 営業/経理/工場）を作成し、ブック×CRUD を設定。

## 4. Supabase（Auth）設定 — #44 の解消（必須）

Google ログインが localhost に飛ぶ問題。**1回やれば全業種に効く**（Auth は共有）：

```powershell
# https://supabase.com/dashboard/account/tokens でトークン発行してから
$env:SUPABASE_ACCESS_TOKEN="sbp_xxx"; npx tsx scripts/apply-auth-redirect-urls.ts
```
- [ ] 適用後、本番ドメインで「Google でログイン」→ /dashboard 到達を確認

## 5. Vercel の接続

- [ ] 各 Vercel project が **新リポ `takng-cb/Bract` の main** を監視していることを確認（旧 Bract-CRM のままなら付け替え。Issue #18）。
- [ ] env を新 Neon に更新：`DATABASE_URL`、`NEXT_PUBLIC_INDUSTRY`、`NEXT_PUBLIC_APP_URL`、Supabase キー、（AI 使用時）API キー。
- [ ] Redeploy → `vercel-build` の check:schema が緑になりデプロイが通ることを確認。

## 6. リリース前検証

- [ ] `npm run lint` / `npm run test`（ローカル、main）
- [ ] スモーク：`scripts/smoke-test.ts`（本番 URL に対して 200/redirect 確認）
- [ ] Playwright E2E：`npm run test:e2e`（3ロール auth / CRUD / 業種シナリオ）
      ※ RBAC 導入につき「viewer が書き込み不可」「カスタムロールの read 制限でナビ/検索から消える」シナリオを追加すること（未追加）。
- [ ] 実機チェックリスト（AGENTS.md「検証チェックリスト」§2）＋今回の新機能:
  - /admin/roles（ロール作成→割当→制限が効く）
  - 商談詳細の「商品」セクション（明細追加・合計）
  - /admin/objects（ブック/モジュール管理）・/settings/system（提供者/管理者分離）
  - グローバル検索・関連レコード Picker（オンデマンド検索）
  - モバイル：レコード詳細ヘッダ／ステッパー型ステータスバー

## 7. 運用の付け替え（リリース直前）

- [ ] **バックアップ**：`.github/workflows/backup.yml`（日次 pg_dump→artifact 30日保持）の Secrets
      `DATABASE_URL_REAL_ESTATE / DATABASE_URL_AUTO_BODY / DATABASE_URL_BASE` を新 Neon に更新し、
      workflow_dispatch で手動1回実行して成功を確認（#24）。月1リストア・リハーサルは手動。
- [ ] **デプロイ失敗通知**：Vercel webhook（`/api/webhooks/vercel`）の宛先と secret を本番 project に設定（#25）。
- [ ] **障害連絡経路**：SLA・通報窓口の合意（#23）。
- [ ] **法務**：docs/legal/ のレビュー完了確認。
- [ ] `npm audit` で high 0 件を確認。

## 8. 切り替え・後片付け

- [ ] DNS/ドメイン（app.bract-crm.com 等）を新 project に向ける（使う場合）。
- [ ] 旧 Neon は2週間程度は読み取り専用で保持→問題なければ削除。
- [ ] release tag（`git tag v1.0.0 && git push --tags`）。
- [ ] AGENTS.md「接続先 Neon 一覧」とこの手順書のホスト名を新 Neon に更新。
