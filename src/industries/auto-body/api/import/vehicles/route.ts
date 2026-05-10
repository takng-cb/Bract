import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { vehicles } from '@/industries/auto-body/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { parseCsvWithHeaders } from '@/lib/csvUtils'
import { syncVehicleToCustomRecord } from '@/industries/auto-body/lib/vehicleCustomRecordSync'
import { VEHICLE_STATUSES } from '@/industries/auto-body/lib/autoBodyService'

const STATUS_SET = new Set<string>(VEHICLE_STATUSES)

function s(v: string | undefined | null): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}
function n(v: string | undefined | null): string | null {
  const x = s(v)
  if (!x) return null
  const num = Number(x)
  return Number.isFinite(num) ? String(num) : null
}
function i(v: string | undefined | null): number | null {
  const x = s(v)
  if (!x) return null
  const num = Number(x)
  return Number.isFinite(num) ? Math.round(num) : null
}
function d(v: string | undefined | null): string | null {
  const x = s(v)
  if (!x) return null
  // YYYY-MM-DD or YYYY/MM/DD or 2026/5/10 等を正規化
  const m = x.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
}

export async function POST(req: NextRequest) {
  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const textInput = formData.get('text') as string | null

  let text: string
  if (file)              text = await file.text()
  else if (textInput)    text = textInput
  else return NextResponse.json({ error: 'ファイルまたはテキストが必要です' }, { status: 400 })

  const rows = parseCsvWithHeaders(text)
  if (rows.length === 0) return NextResponse.json({ error: 'データがありません' }, { status: 400 })

  // 取引先名 → id 解決用
  const accountsData = await db.select({ id: accounts.id, name: accounts.name }).from(accounts)
  const accountMap   = new Map(accountsData.map((a) => [a.name, a.id]))

  let inserted = 0, updated = 0
  const errors: string[] = []

  for (const row of rows) {
    const id    = s(row['ID'])
    const maker = s(row['メーカー'])
    const model = s(row['車種'])
    if (!id && (!maker || !model)) continue

    const statusRaw = s(row['状態'])
    const status = statusRaw && STATUS_SET.has(statusRaw) ? statusRaw : '在庫'

    const supplierName = s(row['仕入元'])
    const supplierId = supplierName ? (accountMap.get(supplierName) ?? null) : null
    const buyerName = s(row['売却先'])
    const buyerId = buyerName ? (accountMap.get(buyerName) ?? null) : null

    const baseRecord = {
      year:                 i(row['年式']),
      mileage:              i(row['走行距離(km)']),
      color:                s(row['色']),
      license_plate:        s(row['ナンバー']),
      vin:                  s(row['車台番号']),
      status,
      purchase_date:        d(row['仕入日']),
      purchase_price:       n(row['仕入価格']),
      supplier_account_id:  supplierId,
      sale_price:           n(row['希望売価']),
      sold_date:            d(row['売却日']),
      sold_price:           n(row['売却価格']),
      buyer_account_id:     buyerId,
      next_inspection_date: d(row['次回車検期日']),
      description:          s(row['備考']),
    }

    try {
      if (id) {
        const updateRec = {
          ...baseRecord,
          ...(maker ? { maker } : {}),
          ...(model ? { model } : {}),
        }
        const [row2] = await db.update(vehicles).set({ ...updateRec, updated_at: new Date() }).where(eq(vehicles.id, id)).returning()
        if (row2) {
          await syncVehicleToCustomRecord({
            id: row2.id, maker: row2.maker, model: row2.model,
            year: row2.year, mileage: row2.mileage, color: row2.color,
            license_plate: row2.license_plate, vin: row2.vin, status: row2.status,
            owner_id: row2.owner_id,
          })
        }
        updated++
      } else {
        if (!maker || !model) { errors.push('メーカー・車種が空の行をスキップしました'); continue }
        const [row2] = await db.insert(vehicles).values({
          ...baseRecord,
          maker,
          model,
        }).returning()
        await syncVehicleToCustomRecord({
          id: row2.id, maker: row2.maker, model: row2.model,
          year: row2.year, mileage: row2.mileage, color: row2.color,
          license_plate: row2.license_plate, vin: row2.vin, status: row2.status,
          owner_id: row2.owner_id,
        })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
