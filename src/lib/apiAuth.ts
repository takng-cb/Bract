/**
 * API Route Handler 用の認可ヘルパ。
 *
 * ミドルウェア（src/proxy.ts）が全パスでログインを強制しているが、
 * ロール（editor/viewer）はチェックしないため、書き込み系 API は
 * ここで明示的にロールを確認する（defense in depth として認証も再確認）。
 *
 * 使い方:
 *   const denied = await requireApiEditor()
 *   if (denied) return denied
 */
import { NextResponse } from 'next/server'
import { getSupabaseUser, canEdit } from '@/lib/auth'

/** 認証必須（エクスポート等の読み取り API）。未ログインなら 401 を返す。 */
export async function requireApiUser(): Promise<NextResponse | null> {
  const user = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

/** 編集権限必須（インポート等の書き込み API）。未ログイン 401 / viewer は 403。 */
export async function requireApiEditor(): Promise<NextResponse | null> {
  const user = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEdit())) {
    return NextResponse.json({ error: 'Forbidden: この操作には編集権限が必要です' }, { status: 403 })
  }
  return null
}
