import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Supabase クライアントを作成（セッション更新のため）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')

  // ── 未認証 → ログインページへ ──────────────────────────────────
  if (!session) {
    if (isLoginPage) return response
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── 認証済みでログインページ → ダッシュボードへ ──────────────
  if (isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── セッションタイムアウトチェック ───────────────────────────
  const timeoutMins = parseInt(
    request.cookies.get('crm_timeout')?.value ?? '0', 10
  )
  if (timeoutMins > 0) {
    const lastActive = parseInt(
      request.cookies.get('crm_last_active')?.value ?? '0', 10
    )
    if (lastActive > 0) {
      const elapsed = Date.now() - lastActive
      if (elapsed > timeoutMins * 60 * 1000) {
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
    }
    // 最終アクティブ時刻を更新
    response.cookies.set('crm_last_active', String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
