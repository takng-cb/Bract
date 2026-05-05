import { db } from '@/lib/db'
import { contacts, accounts } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'

export async function GET() {
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
      .orderBy(desc(contacts.created_at))

    const headers = ['ID', '氏名', '役職', '部署', 'メール', '電話番号', '誕生日', '取引先名', 'メモ', '登録日']
    const rows = data.map((r) => [
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
