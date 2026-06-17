import { db } from '@/lib/db'
import { contacts, accounts } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'
import { requireApiBookRead } from '@/lib/apiAuth'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

export async function GET(request: Request) {
  // 認証＋ブック Read 権限＋外部ユーザー遮断（REQ-0083/0084）
  const auth = await requireApiBookRead('contacts')
  if (auth instanceof NextResponse) return auth
  const scopeWhere = auth.scope === 'own' && auth.scopeEnforced ? eq(contacts.owner_id, auth.userId) : undefined

  // エクスポートのフィルタ指定（REQ-0052）: 一覧と同じ f パラメータ
  const filterRaw = new URL(request.url).searchParams.getAll('f')
  const conditions = parseFilterParams(filterRaw)

  try {
    const data = await db.select({
      id:          contacts.id,
      full_name:   contacts.full_name,
      title:       contacts.title,
      department:  contacts.department,
      email:       contacts.email,
      phone:       contacts.phone,
      birthday:    contacts.birthday,
      description: contacts.description,
      created_at:  contacts.created_at,
      accounts:    { name: accounts.name },
    })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.account_id, accounts.id))
      .where(scopeWhere)
      .orderBy(desc(contacts.created_at))

    const filtered = conditions.length > 0
      ? (applyFilters(data as unknown as Record<string, unknown>[], conditions) as unknown as typeof data)
      : data

    const headers = ['ID', '氏名', '役職', '部署', 'メール', '電話番号', '誕生日', '取引先名', 'メモ', '登録日']
    const rows = filtered.map((r) => [
      r.id,
      r.full_name,
      r.title ?? '',
      r.department ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.birthday ? new Date(r.birthday).toLocaleDateString('ja-JP') : '',
      r.accounts?.name ?? '',
      r.description ?? '',
      r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '',
    ])

    return new NextResponse(buildCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="contacts.csv"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
