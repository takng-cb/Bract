import { createClient } from '@supabase/supabase-js'

/**
 * Service Role キーを使う管理者用 Supabase クライアント。
 * サーバーサイドのみで使用すること（クライアントに漏れないよう注意）。
 *
 * 必要な環境変数:
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase Dashboard > Settings > API > service_role key
 */
export function createSupabaseAdminClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY が設定されていません。' +
      '.env.local と Vercel の環境変数に追加してください。'
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
