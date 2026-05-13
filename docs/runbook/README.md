# Bract CRM 障害対応 runbook

本番障害（Sev1〜Sev3）が発生した時の対応手順集。Issue #23 で導入。

## ファイル一覧

| ファイル | 用途 |
|---|---|
| [`incident-severity.md`](incident-severity.md) | 重大度 (Sev) 定義と RTO/RPO 目標 |
| [`vercel-deploy-failure.md`](vercel-deploy-failure.md) | Vercel デプロイ失敗時の対応 |
| [`neon-db-down.md`](neon-db-down.md) | Neon DB 接続不可・遅延時の対応 |
| [`supabase-auth-failure.md`](supabase-auth-failure.md) | Supabase Auth 障害時の対応 |
| [`hydration-bug.md`](hydration-bug.md) | list ページ hydration 不全（Issue #20 系）の暫定対応 |
| [`postmortem-template.md`](postmortem-template.md) | ポストモーテム作成テンプレート |

## 障害発生時の最初の 5 分

1. **重大度を判定** — [`incident-severity.md`](incident-severity.md) で Sev1〜Sev4 のどれかを決める
2. **顧客への一次連絡** — Sev1/Sev2 は即時、Sev3 は 1 営業日以内（[`incident-severity.md`](incident-severity.md) 参照）
3. **該当 runbook を開く** — 上記表から該当の障害種別を選んで対応開始
4. **GitHub Issue を起票** — AGENTS.md「Issue 運用」の症状/原因/修正/検証テンプレで記録
5. **解決後にポストモーテム** — Sev1 / Sev2 は必須、Sev3 は任意

## 補足: 監視 / 自動通知

- Vercel deploy 失敗の自動通知は **Issue #25** で別途整備
- Neon compute hour 上限監視は **Issue #17** で別途整備
- それまでは手動で Vercel Dashboard / Neon Console を確認する

## 関連ドキュメント

- [`../legal/sla.md`](../legal/sla.md) — 顧客への稼働率保証
- AGENTS.md「Issue 運用」 — 障害 Issue の起票テンプレ
