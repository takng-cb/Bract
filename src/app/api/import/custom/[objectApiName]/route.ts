/**
 * POST /api/import/custom/[objectApiName]
 *
 * カスタムオブジェクトのレコードを CSV からインポートする。
 * - ID 列あり → 既存レコードを更新
 * - ID 列なし or 空 → 新規挿入
 * - 「取引先名」「担当者名」列でアカウント/コンタクト名から ID を逆引き
 */
import { db } from '@/lib/db'
import {
  custom_records, object_definitions, field_definitions,
  accounts, contacts,
} from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'
import { logImport, toUserFriendlyError } from '@/lib/importLogger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ objectApiName: string }> },
) {
  // 認証確認
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { objectApiName } = await params
  const formData = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null

  let text: string
  if (file)            text = await file.text()
  else if (textInput)  text = textInput
  else return NextResponse.json({ error: 'ファイルまたはテキストが必要です' }, { status: 400 })

  // オブジェクト定義取得
  const objRows = await db
    .select({ id: object_definitions.id })
    .from(object_definitions)
    .where(eq(object_definitions.api_name, objectApiName))
    .limit(1)
  if (objRows.length === 0) return NextResponse.json({ error: 'オブジェクトが見つかりません' }, { status: 404 })
  const objectId = objRows[0].id

  // フィールド定義取得（label → api_name マップ）
  const fields = await db
    .select()
    .from(field_definitions)
    .where(eq(field_definitions.object_id, objectId))
    .orderBy(asc(field_definitions.sort_order))
  const labelToField = new Map(fields.filter((f) => f.field_type !== 'section').map((f) => [f.label, f]))

  // 取引先・担当者の名前→IDマップ（エクスポートした「（名前）」列からのインポートに対応）
  const [accountsData, contactsData] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name }).from(accounts),
    db.select({ id: contacts.id, name: contacts.full_name }).from(contacts),
  ])
  const accountNameToId = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactNameToId = new Map(contactsData.map((c) => [c.name, c.id]))

  // account_id / contact_id フィールドの api_name セット
  const accountIdApiNames = new Set(
    fields.filter((f) => f.api_name === 'account_id' || f.api_name.endsWith('_account_id')).map((f) => f.api_name)
  )
  const contactIdApiNames = new Set(
    fields.filter((f) => f.api_name === 'contact_id' || f.api_name.endsWith('_contact_id')).map((f) => f.api_name)
  )

  const rows = parseCsvWithHeaders(text)
  if (rows.length === 0) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  let inserted = 0
  let updated  = 0
  const userErrors: string[] = []
  const rawErrors:  string[] = []

  for (const row of rows) {
    const id   = row['ID']?.trim()
    const name = row['物件名 / 件名']?.trim() ?? row['件名']?.trim() ?? row['名前']?.trim()

    // ID も名前もない行はスキップ
    if (!id && !name) continue

    // CSVヘッダー（label）→ api_name でデータを組み立て
    const data: Record<string, unknown> = {}
    for (const [label, value] of Object.entries(row)) {
      if (label === 'ID') continue
      // 「（名前）」付き列は ID 解決に使うためスキップ
      if (label.endsWith('（名前）')) continue

      const field = labelToField.get(label)
      if (!field) continue

      const trimmed = value?.trim()
      if (!trimmed) continue

      // 型変換
      if (field.field_type === 'number') {
        const n = Number(trimmed)
        if (isFinite(n)) data[field.api_name] = n
      } else if (field.field_type === 'boolean') {
        data[field.api_name] = trimmed === '1' || trimmed.toLowerCase() === 'true'
      } else {
        data[field.api_name] = trimmed
      }
    }

    // 「（名前）」列から account_id / contact_id を逆引き（名前列が優先）
    for (const apiName of accountIdApiNames) {
      const fieldDef = fields.find((f) => f.api_name === apiName)
      if (!fieldDef) continue
      const nameCol = `${fieldDef.label}（名前）`
      const nameCellVal = row[nameCol]?.trim()
      if (nameCellVal) {
        const resolvedId = accountNameToId.get(nameCellVal)
        if (resolvedId) data[apiName] = resolvedId
      }
    }
    for (const apiName of contactIdApiNames) {
      const fieldDef = fields.find((f) => f.api_name === apiName)
      if (!fieldDef) continue
      const nameCol = `${fieldDef.label}（名前）`
      const nameCellVal = row[nameCol]?.trim()
      if (nameCellVal) {
        const resolvedId = contactNameToId.get(nameCellVal)
        if (resolvedId) data[apiName] = resolvedId
      }
    }

    const label = (data.name as string) ?? id ?? '不明'

    try {
      if (id) {
        // 既存レコード更新
        const existing = await db
          .select({ id: custom_records.id })
          .from(custom_records)
          .where(eq(custom_records.id, id))
          .limit(1)

        if (existing.length > 0) {
          // 既存データとマージ（上書き）
          const current = await db
            .select({ data: custom_records.data })
            .from(custom_records)
            .where(eq(custom_records.id, id))
            .then((r) => r[0])
          let currentData: Record<string, unknown> = {}
          try { currentData = JSON.parse(current.data) } catch { /* ignore */ }
          const merged = { ...currentData, ...data }

          await db.update(custom_records)
            .set({ data: JSON.stringify(merged), updated_at: new Date() })
            .where(eq(custom_records.id, id))
          updated++
        } else {
          // ID 指定で新規挿入
          await db.insert(custom_records).values({
            id,
            object_id: objectId,
            data: JSON.stringify(data),
            owner_id: user.id,
          })
          inserted++
        }
      } else {
        // ID なし → 新規挿入
        if (!data.name) {
          userErrors.push('名前が空の行をスキップしました')
          continue
        }
        await db.insert(custom_records).values({
          object_id: objectId,
          data: JSON.stringify(data),
          owner_id: user.id,
        })
        inserted++
      }
    } catch (e: unknown) {
      const userMsg = toUserFriendlyError(e)
      const rawMsg  = e instanceof Error ? e.message : String(e)
      userErrors.push(`【${label}】${userMsg}`)
      rawErrors.push(`[db_error] ${label}: ${rawMsg}`)
    }
  }

  await logImport({
    route:      `/api/import/custom/${objectApiName}`,
    imported:   inserted,
    updated,
    userErrors,
    rawErrors,
  })

  return NextResponse.json({ imported: inserted, updated, errors: userErrors })
}
