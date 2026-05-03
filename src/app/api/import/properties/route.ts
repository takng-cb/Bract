import { db } from '@/lib/db'
import { properties, accounts, contacts } from '@/lib/schema'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csvUtils'

/** 有効な数値文字列なら数値を返す。空・"NaN"・非数値は null */
function safeNum(v: string | undefined): number | null {
  const s = v?.trim()
  if (!s) return null
  const n = Number(s)
  return isFinite(n) ? n : null
}

/** 有効な数値文字列なら文字列数値を返す（numeric型用）。空・"NaN"・非数値は null */
function safeNumStr(v: string | undefined): string | null {
  const n = safeNum(v)
  return n !== null ? String(n) : null
}

type PropertyRecord = {
  product_category: string
  name:             string
  property_type:    string
  transaction_type: string
  status:           string
  address:          string | null
  area:             string | null
  price:            string | null
  floor:            number | null
  total_floors:     number | null
  built_year:       number | null
  account_id:       string | null
  contact_id:       string | null
  chimoku:          string | null
  structure:        string | null
  rights_status:    string | null
  description:      string | null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  const [accountsData, contactsData] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name      }).from(accounts),
    db.select({ id: contacts.id, name: contacts.full_name }).from(contacts),
  ])
  const accountMap = new Map(accountsData.map((a) => [a.name, a.id]))
  const contactMap = new Map(contactsData.map((c) => [c.name, c.id]))

  // ヘッダ: カテゴリ(0), 件名(1), 物件種別(2), 取引種別(3), ステータス(4),
  //         所在地(5), 面積(6), 価格(7), 所在階(8), 総階数(9), 築年(10),
  //         取引先名(11), 担当者名(12), 地目(13), 構造(14), 権利状況(15), 備考(16)
  const dataRows = rows.slice(1)
  const records: PropertyRecord[] = dataRows.flatMap((cols, i) => {
    const name = cols[1]?.trim()
    if (!name) return []
    const rawCat = cols[0]?.trim() ?? ''
    const isRE   = rawCat !== 'その他商品' && rawCat !== 'other'

    // 数値バリデーション：無効値を警告なしで null に変換（NaN・非数値を安全に処理）
    return [{
      product_category: isRE ? 'real_estate' : 'other',
      name,
      property_type:    cols[2]?.trim() || 'その他',
      transaction_type: cols[3]?.trim() || (isRE ? '売買' : 'その他'),
      status:           cols[4]?.trim() || (isRE ? '募集中' : '提案中'),
      address:          isRE ? (cols[5]?.trim() || null) : null,
      area:             isRE ? safeNumStr(cols[6]) : null,
      price:            safeNumStr(cols[7]),
      floor:            isRE ? safeNum(cols[8]) : null,
      total_floors:     isRE ? safeNum(cols[9]) : null,
      built_year:       isRE ? safeNum(cols[10]) : null,
      account_id:       cols[11]?.trim() ? (accountMap.get(cols[11].trim()) ?? null) : null,
      contact_id:       cols[12]?.trim() ? (contactMap.get(cols[12].trim()) ?? null) : null,
      chimoku:          isRE ? (cols[13]?.trim() || null) : null,
      structure:        isRE ? (cols[14]?.trim() || null) : null,
      rights_status:    isRE ? (cols[15]?.trim() || null) : null,
      description:      cols[16]?.trim() || null,
    }]
  })

  if (records.length === 0) {
    return NextResponse.json({ error: '有効なデータ行がありません（件名が必須）' }, { status: 400 })
  }

  try {
    await db.insert(properties).values(records)
    return NextResponse.json({ imported: records.length })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    // よくあるDBエラーをわかりやすいメッセージに変換
    if (msg.includes('invalid input syntax for type integer')) {
      return NextResponse.json(
        { error: '数値列（所在階・総階数・築年）に数値以外の値が含まれています。CSVを確認してください。' },
        { status: 400 },
      )
    }
    if (msg.includes('invalid input syntax for type numeric')) {
      return NextResponse.json(
        { error: '数値列（面積・価格）に数値以外の値が含まれています。CSVを確認してください。' },
        { status: 400 },
      )
    }
    if (msg.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { error: '関連レコードが見つかりません。取引先名・担当者名がCRM上の名前と一致しているか確認してください。' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: `インポートに失敗しました: ${msg}` }, { status: 500 })
  }
}
