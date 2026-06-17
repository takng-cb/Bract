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
import { isExternalUser, canDo, recordScope, type RecordScope, SCOPE_ENFORCED_BOOKS } from '@/lib/permissions'

/** 認証必須（エクスポート等の読み取り API）。未ログイン 401 / 外部ユーザー 403。 */
export async function requireApiUser(): Promise<NextResponse | null> {
  const user = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 外部ユーザー（REQ-0084）はデータ API を一切使えない（deny-by-default）
  if (await isExternalUser()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/** 編集権限必須（インポート等の書き込み API）。未ログイン 401 / 外部・viewer は 403。 */
export async function requireApiEditor(): Promise<NextResponse | null> {
  const user = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isExternalUser()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await canEdit())) {
    return NextResponse.json({ error: 'Forbidden: この操作には編集権限が必要です' }, { status: 403 })
  }
  return null
}

/** エクスポート等の読み取り API 用コンテキスト（許可時）。 */
export type ApiReadContext = {
  userId: string
  /** book のレコードスコープ（'own' は owner_id = me のみ） */
  scope: RecordScope
  /** スコープ強制対象（owner_id を持つ）book か */
  scopeEnforced: boolean
}

/**
 * ブック Read 権限を要する読み取り API のガード（REQ-0083/0084・ADR-0023/0029）。
 * 401（未ログイン）/ 403（外部ユーザー・ブック Read 権限なし）を返すか、許可時は ApiReadContext。
 * 呼び出し側は scope==='own' かつ scopeEnforced のとき owner_id = userId で絞り込むこと。
 */
export async function requireApiBookRead(bookApi: string): Promise<NextResponse | ApiReadContext> {
  const user = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isExternalUser()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await canDo(bookApi, 'read'))) {
    return NextResponse.json({ error: 'Forbidden: このブックの閲覧権限がありません' }, { status: 403 })
  }
  return {
    userId: user.id,
    scope: await recordScope(bookApi, 'read'),
    scopeEnforced: SCOPE_ENFORCED_BOOKS.includes(bookApi),
  }
}
