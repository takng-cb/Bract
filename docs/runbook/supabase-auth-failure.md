# Supabase Auth 障害時の対応

## 症状

- 全顧客がログインできない（既存セッションは生きていることもある）
- `/login` で `Invalid login credentials` 以外のエラー
- Server Component で `getSupabaseUser()` が timeout / 例外

## チェックリスト

1. **Supabase Status Page を確認** — https://status.supabase.com/
   - Auth サービスの障害有無 / リージョン障害
2. **Supabase Dashboard を開く** — https://supabase.com/dashboard
   - 該当プロジェクト (`OriginalCRM`) の Auth → Users で挙動確認
3. **環境変数の有効性確認**
   - `NEXT_PUBLIC_SUPABASE_URL` が正しい
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` が rotate されていない
   - `SUPABASE_SERVICE_ROLE_KEY` が rotate されていない
4. **アプリ側のセッション cookie**
   - DevTools → Application → Cookies で `sb-*` 系 cookie の有無

## 障害パターン別対応

### A. Supabase 側全体障害

- 顧客に「認証プロバイダ側の障害で復旧待ち」を即時連絡（Sev1）
- 復旧 ETA を共有

### B. API Key の rotate / 失効

- Supabase Dashboard → Settings → API で現在の key を確認
- Vercel project の Environment Variables を更新 → Redeploy
- 同時にローカル `.env.local` も更新

### C. RLS / ポリシー設定変更による拒否

- Supabase Dashboard → Authentication → Policies で最近の変更を確認
- 直前の設定変更を rollback

### D. メール送信失敗（招待・パスワードリセット）

- Supabase Dashboard → Authentication → Email Templates / Auth Settings → SMTP
- デフォルトの Supabase SMTP は rate limit が低い → 本番運用では SendGrid 等の external SMTP 連携を検討
- 該当顧客には個別に Supabase Admin API で magic link を生成して連絡

## ローカル開発時の暫定 workaround

開発中に Supabase Auth が不安定になった場合:
- DevTools の Application → Cookies で `sb-*` を全消去 → ハードリロード
- それでもダメなら Supabase Admin API でテストユーザーを再作成

## 関連 Issue

- #22 オンボーディングフロー（招待メールの整備が含まれる）
- #26 権限管理テスト
- #23 SLA / runbook（本 runbook の親）
