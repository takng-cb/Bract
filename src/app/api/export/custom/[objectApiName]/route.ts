/**
 * GET /api/export/custom/[objectApiName]
 *
 * カスタムオブジェクトのレコードを CSV でエクスポートする。
 * ヘッダーは book_fields の label を使用。
 * account_id / contact_id フィールドは名前も一緒にエクスポートする。
 */
import { db } from '@/lib/db'
import { book_records, book_definitions, book_fields, accounts, contacts } from '@/lib/schema'
import { eq, asc, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csvUtils'
import { requireApiBookRead } from '@/lib/apiAuth'
import { parseFilterParams, applyFilters } from '@/lib/filterUtils'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ objectApiName: string }> },
) {
  const { objectApiName } = await params
  // 認証＋ブック Read 権限＋外部ユーザー遮断（REQ-0083/0084）
  const auth = await requireApiBookRead(objectApiName)
  if (auth instanceof NextResponse) return auth

  // エクスポートのフィルタ指定（REQ-0052）: 一覧と同じ f パラメータ
  const filterRaw = req.nextUrl.searchParams.getAll('f')
  const conditions = parseFilterParams(filterRaw)

  // オブジェクト定義取得
  const objRows = await db
    .select({ id: book_definitions.id, label: book_definitions.label })
    .from(book_definitions)
    .where(eq(book_definitions.api_name, objectApiName))
    .limit(1)
  if (objRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const obj = objRows[0]

  // フィールド定義取得（section 以外）
  const fields = await db
    .select()
    .from(book_fields)
    .where(eq(book_fields.object_id, obj.id))
    .orderBy(asc(book_fields.sort_order), asc(book_fields.created_at))
  const dataFields = fields.filter((f) => f.field_type !== 'section' && f.is_visible)

  // レコード取得
  const allRecords = await db
    .select()
    .from(book_records)
    .where(eq(book_records.object_id, obj.id))

  // フィルタ適用（REQ-0052）: 一覧と同様、data jsonb を flatten した行オブジェクトに対して判定する
  // （フィルタの field key は book_fields の api_name = 一覧ページの filterFields と一致）
  const records = conditions.length > 0
    ? allRecords.filter((rec) =>
        applyFilters([{ id: rec.id, ...rec.data } as Record<string, unknown>], conditions).length > 0,
      )
    : allRecords

  // account_id / contact_id フィールドのIDを収集してまとめてDBルックアップ
  const accountIdFields = dataFields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id'))
  const contactIdFields = dataFields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id'))

  const accountIds = new Set<string>()
  const contactIds = new Set<string>()

  for (const rec of records) {
    const data = rec.data
    for (const f of accountIdFields) {
      const v = String(data[f.api_name] ?? '').trim()
      if (v) accountIds.add(v)
    }
    for (const f of contactIdFields) {
      const v = String(data[f.api_name] ?? '').trim()
      if (v) contactIds.add(v)
    }
  }

  const [accountRows, contactRows] = await Promise.all([
    accountIds.size > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, [...accountIds]))
      : Promise.resolve([]),
    contactIds.size > 0
      ? db.select({ id: contacts.id, name: contacts.full_name }).from(contacts).where(inArray(contacts.id, [...contactIds]))
      : Promise.resolve([]),
  ])
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))
  const contactMap = new Map(contactRows.map((c) => [c.id, c.name]))

  // CSV ヘッダー
  // account_id / contact_id フィールドには「(名前)」列も追加
  const headers: string[] = ['ID']
  for (const f of dataFields) {
    headers.push(f.label)
    if (accountIdFields.some((af) => af.id === f.id)) headers.push(`${f.label}（名前）`)
    if (contactIdFields.some((cf) => cf.id === f.id)) headers.push(`${f.label}（名前）`)
  }

  // CSV 行
  const rows = records.map((rec) => {
    const data = rec.data
    const cells: (string | number | null | undefined)[] = [rec.id]
    for (const f of dataFields) {
      const val = data[f.api_name]
      const strVal = val == null ? '' : String(val)
      cells.push(strVal)
      if (accountIdFields.some((af) => af.id === f.id)) {
        cells.push(accountMap.get(strVal) ?? '')
      }
      if (contactIdFields.some((cf) => cf.id === f.id)) {
        cells.push(contactMap.get(strVal) ?? '')
      }
    }
    return cells
  })

  const csv = buildCsv(headers, rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${objectApiName}.csv"`,
    },
  })
}
