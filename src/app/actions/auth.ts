'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSystemSetting } from '@/lib/systemSettings'

export async function signIn(_: string | null, formData: FormData): Promise<string | null> {
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return 'メールアドレスまたはパスワードが正しくありません'

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
