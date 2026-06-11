/**
 * Products CSV import — inventory モジュール (Issue #48)
 * 列: ID,SKU,商品名,カテゴリ,単位,売価,原価,発注しきい値,備考
 *
 * upsert は SKU をキーに判定する（SKU は unique）:
 *   - 既存 SKU → 更新
 *   - 新規 SKU → 追加（商品名必須）
 * accounts import の parse/構造を踏襲。
 */
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
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

  let inserted = 0
  let updated  = 0
  const errors: string[] = []

  const intOrNull = (v: string | undefined): number | null => {
    if (!v || v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n) : null
  }
  const numStrOrNull = (v: string | undefined): string | null => {
    if (!v || v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? String(n) : null
  }

  for (const row of rows) {
    const sku  = row['SKU']?.trim()
    const name = row['商品名']?.trim()
    if (!sku && !name) continue  // どちらもなければスキップ

    const record = {
      name:          name || undefined,
      category:      row['カテゴリ'] || null,
      unit:          row['単位']     || null,
      unit_price:    numStrOrNull(row['売価']),
      cost_price:    numStrOrNull(row['原価']),
      reorder_level: intOrNull(row['発注しきい値']) ?? 0,
      description:   row['備考']     || null,
    }

    try {
      if (!sku) { errors.push('SKU が空の行をスキップしました'); continue }

      const existing = await db.select({ id: products.id })
        .from(products).where(eq(products.sku, sku)).limit(1)

      if (existing.length > 0) {
        // 既存 SKU → 更新（商品名が空なら既存名を維持）
        const { name: _n, ...updateData } = record
        await db.update(products)
          .set({ ...updateData, ...(record.name ? { name: record.name } : {}), updated_at: new Date() })
          .where(eq(products.sku, sku))
        updated++
      } else {
        // 新規 SKU → 追加（商品名必須）
        if (!record.name) { errors.push(`商品名が空のためスキップ（SKU: ${sku}）`); continue }
        await db.insert(products).values({ ...record, sku, name: record.name })
        inserted++
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return NextResponse.json({ imported: inserted, updated, errors })
}
