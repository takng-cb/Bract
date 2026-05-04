import { createSupabaseServerClient } from '@/lib/supabase-server'
import { provisionUser } from '@/lib/userRole'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Google OAuth 経由のログイン後もプロビジョニング
    if (data.user) {
      await provisionUser(data.user.id, data.user.email ?? '')
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
