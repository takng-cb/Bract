/**
 * Magic Link / OAuth コールバックルート
 * Supabase が認証後に ?code=xxx でリダイレクトしてくるのを受け取り、
 * セッションに交換してアプリ内ページへ転送する。
 */
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
