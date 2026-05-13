# Vercel デプロイ失敗時の対応

`main` への push で Vercel Production deploy が失敗した時の対応手順。

## 検知

- 現状（Issue #25 完了前）: Vercel Dashboard の Deployments タブで手動確認 / GitHub の commit ステータス
- 将来: Slack 通知（Issue #25）/ GitHub Actions の status check failure

## 想定される失敗パターンと対応

### パターン A: `vercel-build` の `check:schema` 失敗

```
Error: schemaOnly に <table> の <column> が存在しません
```

**原因**: `src/lib/schema.ts` に追加したカラムが対象 Neon にマイグレ未適用。

**対応**:
1. ローカルで該当 Neon を指す `.env.local` を用意
2. `npx tsx scripts/snapshot-db.ts` で事前バックアップ
3. `npx tsx scripts/apply-migration.ts supabase/migrations/<file>.sql` で適用
4. `npm run check:schema` で検証
5. Vercel の deployment 画面から **Redeploy** を実行

詳細: AGENTS.md「DB マイグレーション運用」

### パターン B: `next build` で TypeScript / webpack エラー

```
Type error: ...
Module not found: ...
```

**対応**:
1. ローカルで `npm run build` を再現
2. 直近の commit を `git log -p` で確認、原因 commit を特定
3. 修正コミットを作成 or `git revert <hash>` で打ち消し
4. main に push

### パターン C: Next.js / React の runtime hydration 不全（Issue #20 系）

ビルドは成功するが、本番でページがレンダリングされない or skeleton が外れない。

→ [`hydration-bug.md`](hydration-bug.md) を参照

### パターン D: Neon DB 接続失敗

`check:schema` が DB 接続できずに timeout。

→ [`neon-db-down.md`](neon-db-down.md) を参照

## ロールバック

deploy 失敗状態が長引きそうな場合、Vercel Dashboard で **直前の成功 deployment を Promote** する:

1. Vercel Dashboard → Deployments
2. 最後の成功 deploy を選択
3. "Promote to Production" をクリック

これで顧客への影響は最小化。原因調査は並行で進める。

## 顧客への連絡

- Sev2 相当 → 1 時間以内に「現在障害対応中」の連絡
- 復旧後に「原因 / 修正内容 / 再発防止策」を共有

詳細: [`incident-severity.md`](incident-severity.md)
