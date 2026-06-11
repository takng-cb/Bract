import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isRegisteredUser } from '@/lib/userRole'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // 招待制（REQ-0033）: 管理者が追加したユーザーのみログイン可。
    // 未登録の Google アカウント等は即サインアウトして /login に案内を出す。
    // ※ 管理者がメール＋パスワードで追加したユーザーが同じメールの Google で
    //    ログインした場合、Supabase が検証済みメール同士を自動リンクするため
    //    同一ユーザー ID となり、ここを通過できる（=Google 紐づけ完了）。
    if (data.user && !(await isRegisteredUser(data.user.id))) {
      await supabase.auth.signOut()
      const url = new URL('/login', origin)
      url.searchParams.set('reason', 'not_registered')
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
