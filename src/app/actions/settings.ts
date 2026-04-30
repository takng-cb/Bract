'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function updatePassword(
  _: string | null,
  formData: FormData
): Promise<string | null> {
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm') as string

  if (!password || password.length < 6) return 'error:パスワードは6文字以上で入力してください'
  if (password !== confirm) return 'error:パスワードが一致しません'

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return `error:パスワードの更新に失敗しました（${error.message}）`

  return 'success'
}
