# Neon DB 接続不可・遅延時の対応

## 症状の見分け

| 症状 | 推定原因 |
|---|---|
| 全ページが 500 / loading 永続 | Neon DB 全停止 |
| 特定 SELECT だけ timeout | クエリ自体が重い / インデックス不足 |
| 朝一・休日明けに数秒の遅延 | Neon Auto-suspend からの起動待ち |
| `column does not exist` | schema↔DB 不整合（[`vercel-deploy-failure.md`](vercel-deploy-failure.md) A） |

## チェックリスト

1. **Neon Console を開く** — https://console.neon.tech/
   - 対象プロジェクト（real-estate / auto-body / base）の Status を確認
   - "Operational" 以外なら Neon 側障害
2. **Neon Status Page を確認** — https://neonstatus.com/
   - 全体障害 / リージョン (ap-southeast-1) 障害の有無
3. **Compute hour 残量** — Neon Console → Usage（Issue #17 で監視自動化予定）
   - Free plan で 191.9 時間/月を超えると突然停止
4. **接続テスト** — ローカルから
   ```bash
   npx tsx scripts/check-schema-vs-db.ts
   ```
   接続できなければ DATABASE_URL のホスト名・credentials が正しいか確認

## 障害パターン別対応

### A. Neon 側全体障害

- 顧客に「Neon (DB プロバイダ) 側の障害で復旧待ち」を即時連絡（Sev1）
- Neon Status Page の復旧 ETA を共有
- 自前で対応できる手段は無し、Vercel deploy も意味なし

### B. Compute hour 上限到達

- Neon Console の Billing から一時的に Launch plan ($19/month) にアップグレードして復旧
- 復旧後に [`incident-severity.md`](incident-severity.md) Sev2 として記録
- Issue #17 監視整備を加速

### C. クエリパフォーマンス

- 該当 SELECT を `EXPLAIN ANALYZE` で確認
- インデックス不足ならマイグレ追加 (`supabase/migrations/<ts>_<index>.sql`)
- 全 Neon にマイグレ適用（AGENTS.md「DB マイグレーション運用」）

### D. schema 不整合

→ [`vercel-deploy-failure.md`](vercel-deploy-failure.md) パターン A 参照

## バックアップからの復旧

データ損失が疑われる場合（誤 DELETE、テーブル DROP 等）:

1. Neon Console → Branches → PITR で過去 24 時間内の任意の時点に巻き戻し
2. または `scripts/snapshot-db.ts` の最新 dump から手動で INSERT 復旧（Issue #24 で自動化）

詳細: [`docs/legal/sla.md`](../legal/sla.md) の RPO 24h 規定

## 関連 Issue

- #17 Neon compute hour 監視
- #24 バックアップ運用整備
- #23 SLA / runbook（本 runbook の親）
