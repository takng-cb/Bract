import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッション確認
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // 未ログイン → /login にリダイレクト
  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ログイン済みで /login → /dashboard にリダイレクト
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── セッションタイムアウトチェック ────────────────────────────
  if (user) {
    const timeoutMins = parseInt(
      request.cookies.get('crm_timeout')?.value ?? '0', 10
    )
    if (timeoutMins > 0) {
      const lastActive = parseInt(
        request.cookies.get('crm_last_active')?.value ?? '0', 10
      )
      if (lastActive > 0 && (Date.now() - lastActive) > timeoutMins * 60 * 1000) {
        // タイムアウト：サインアウトしてログインページへ
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('reason', 'timeout')
        const redirect = NextResponse.redirect(url)
        redirect.cookies.delete('crm_last_active')
        redirect.cookies.delete('crm_timeout')
        return redirect
      }
      // 最終アクティブ時刻を更新
      supabaseResponse.cookies.set('crm_last_active', String(Date.now()), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
