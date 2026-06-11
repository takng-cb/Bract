'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getSystemSetting } from '@/lib/systemSettings'
import { isRegisteredUser } from '@/lib/userRole'

export async function signIn(_: string | null, formData: FormData): Promise<string | null> {
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return 'メールアドレスまたはパスワードが正しくありません'

  // 招待制（REQ-0033）: 管理者が追加したユーザーのみログイン可（自動登録は廃止）
  if (data.user && !(await isRegisteredUser(data.user.id))) {
    await supabase.auth.signOut()
    return 'このアカウントは登録されていません。システム管理者にユーザー追加を依頼してください。'
  }

  // セッションタイムアウト設定をCookieに保存（ミドルウェアが参照する）
  const timeoutMins = await getSystemSetting('session_timeout_minutes')
  const cookieStore = await cookies()
  if (parseInt(timeoutMins, 10) > 0) {
    cookieStore.set('crm_timeout', timeoutMins, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    })
    cookieStore.set('crm_last_active', String(Date.now()), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24,
    })
  } else {
    cookieStore.delete('crm_timeout')
    cookieStore.delete('crm_last_active')
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete('crm_timeout')
  cookieStore.delete('crm_last_active')
  redirect('/login')
}

/**
 * パスワードリセットメール送信
 * 成功・失敗どちらも 'sent' を返す（メールアドレスの存在を漏らさないため）
 */
export async function requestPasswordReset(
  _: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = (formData.get('email') as string).trim()
  if (!email) return 'メールアドレスを入力してください'

  // リクエストホストからリダイレクト先URLを構築
  const h = await headers()
  const host  = h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const redirectTo = `${proto}://${host}/auth/callback?next=/reset-password`

  const supabase = await createSupabaseServerClient()
  await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  // 成功・失敗を区別しない（存在しないアドレスでも同じメッセージ）
  return 'sent'
}

/**
 * 新しいパスワードへの更新
 * 成功時 'success'、失敗時エラーメッセージを返す
 */
export async function updatePassword(
  _: string | null,
  formData: FormData,
): Promise<string | null> {
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm')  as string

  if (password !== confirm) return 'パスワードが一致しません'
  if (password.length < 8)  return 'パスワードは8文字以上で設定してください'

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return 'パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。再度リセットを申請してください。'
  return 'success'
}
