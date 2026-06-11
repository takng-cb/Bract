import { db } from '@/lib/db'
import { accounts, contacts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'
import { requireApiEditor } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  // 編集権限確認（viewer の書き込みを拒否）
  const denied = await requireApiEditor()
  if (denied) return denied

  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null

  let text: string
  if (file) {
    text = await file.text()
  } else if (textInput) {
    text = textInput
  } else {
    return NextResponse.json({ error: 'ファイルまたはテキストが必要です' }, { status: 400 })
  }

  const rows = parseCsvWithHeaders(text)
  if (rows.length === 0) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  // バッチ内の会社名→account_id キャッシュ（同バッチで重複作成しない）
  const accountCache = new Map<string, string>()

  let contactsInserted  = 0
  let accountsCreated   = 0
  const errors: string[] = []

  for (const row of rows) {
    const companyName = row['会社名']?.trim()
    const fullName    = row['氏名']?.trim()

    if (!companyName && !fullName) continue
    if (!fullName) { errors.push('氏名が空の行をスキップしました'); continue }

    try {
      let accountId: string | null = null

      if (companyName) {
        // ① キャッシュ確認（同バッチ内の重複）
        if (accountCache.has(companyName)) {
          accountId = accountCache.get(companyName)!
        } else {
          // ② DB検索
          const existing = await db
            .select({ id: accounts.id })
            .from(accounts)
            .where(eq(accounts.name, companyName))
            .limit(1)

          if (existing.length > 0) {
            // 既存取引先を再利用（上書きしない）
            accountId = existing[0].id
          } else {
            // ③ 新規取引先を作成
            const [created] = await db
              .insert(accounts)
              .values({
                name:     companyName,
                type:     row['種別']?.trim()       || null,
                industry: row['業種']?.trim()       || null,
                phone:    row['電話番号(会社)']?.trim() || null,
                website:  row['Webサイト']?.trim()  || null,
                address:  row['住所']?.trim()       || null,
                status:   'active',
              })
              .returning({ id: accounts.id })
            accountId = created.id
            accountsCreated++
          }

          accountCache.set(companyName, accountId)
        }
      }

      // 担当者を新規登録（ToB 法人担当者として）
      await db.insert(contacts).values({
        full_name:    fullName,
        account_id:   accountId,
        title:        row['役職']?.trim()        || null,
        department:   row['部署']?.trim()        || null,
        email:        row['メール']?.trim()      || null,
        phone:        row['電話番号(個人)']?.trim() || null,
        contact_type: 'business',
      })
      contactsInserted++
    } catch (e) {
      errors.push(`${fullName ?? '不明'}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({
    imported:       contactsInserted,
    accountsCreated,
    errors,
  })
}
