/**
 * 商談の「商品」セクションで紐付け先にできるブックの設定（REQ-0034）。
 *
 * - どのブックを商品候補にするかは system_settings の `opportunity_product_books`
 *   （JSON 配列の book api 名）で管理者が設定する（/admin/books の設定カード）。
 * - 既定は ['products', 'parts']（従来挙動）。
 * - 選択された各ブックのレコードを Picker 用オプション（label / 単価の自動補完つき）に変換する。
 */
import 'server-only'
import { db } from '@/lib/db'
import { products, parts, vehicles, book_definitions, book_records } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { asc, eq } from 'drizzle-orm'
import { getSystemSettings } from '@/lib/systemSettings'

export type ProductBookCandidate = { api: string; label: string; builtin: boolean }
export type ProductOptionRow = { value: string; label: string; price: number | null }

const DEFAULT_BOOKS = ['products', 'parts']

/** 組み込みの商品系候補（存在するテーブルに限る） */
const TYPED_CANDIDATES: ProductBookCandidate[] = [
  { api: 'products',   label: '商品',       builtin: true },
  { api: 'parts',      label: '部品',       builtin: true },
  { api: 'vehicles',   label: '車両（在庫）', builtin: true },
  { api: 'properties', label: '物件・商品', builtin: true },
]

/** 設定可能な候補ブック一覧（typed ＋ 全カスタムブック） */
export async function getProductBookCandidates(): Promise<ProductBookCandidate[]> {
  const customs = await db
    .select({ api_name: book_definitions.api_name, label: book_definitions.label })
    .from(book_definitions)
    .where(eq(book_definitions.is_builtin, false))
    .orderBy(asc(book_definitions.sort_order), asc(book_definitions.label))
  return [
    ...TYPED_CANDIDATES,
    ...customs.map((c) => ({ api: c.api_name, label: c.label, builtin: false })),
  ]
}

/** 現在設定されている商品候補ブックの api 配列 */
export async function getOpportunityProductBooks(): Promise<string[]> {
  const settings = await getSystemSettings(['opportunity_product_books'])
  try {
    const arr = JSON.parse(settings.opportunity_product_books)
    if (Array.isArray(arr) && arr.every((x) => typeof x === 'string') && arr.length > 0) return arr
  } catch { /* fall through */ }
  return DEFAULT_BOOKS
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 設定されたブック群から Picker 用オプションを構築（label は「ブック名 / レコード名」） */
export async function getProductPickerOptions(): Promise<ProductOptionRow[]> {
  const books = await getOpportunityProductBooks()
  const candidates = await getProductBookCandidates()
  const labelByApi = new Map(candidates.map((c) => [c.api, c.label]))

  const out: ProductOptionRow[] = []
  for (const api of books) {
    const bookLabel = labelByApi.get(api) ?? api
    if (api === 'products') {
      const rows = await db.select({ id: products.id, name: products.name, unit_price: products.unit_price })
        .from(products).orderBy(asc(products.name))
      out.push(...rows.map((r) => ({ value: `products:${r.id}`, label: `${bookLabel} / ${r.name}`, price: numOrNull(r.unit_price) })))
    } else if (api === 'parts') {
      const rows = await db.select({ id: parts.id, name: parts.name, unit_price: parts.unit_price })
        .from(parts).orderBy(asc(parts.name))
      out.push(...rows.map((r) => ({ value: `parts:${r.id}`, label: `${bookLabel} / ${r.name}`, price: numOrNull(r.unit_price) })))
    } else if (api === 'vehicles') {
      const rows = await db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate, sale_price: vehicles.sale_price })
        .from(vehicles).orderBy(asc(vehicles.maker))
      out.push(...rows.map((r) => ({
        value: `vehicles:${r.id}`,
        label: `${bookLabel} / ${[r.maker, r.model].filter(Boolean).join(' ')}${r.license_plate ? `（${r.license_plate}）` : ''}`,
        price: numOrNull(r.sale_price),
      })))
    } else if (api === 'properties') {
      const rows = await db.select({ id: properties.id, name: properties.name, price: properties.price })
        .from(properties).orderBy(asc(properties.name))
      out.push(...rows.map((r) => ({ value: `properties:${r.id}`, label: `${bookLabel} / ${r.name}`, price: numOrNull(r.price) })))
    } else {
      // カスタムブック：data.name/title をラベル、data.unit_price/price を単価候補に
      const obj = await db.select({ id: book_definitions.id })
        .from(book_definitions).where(eq(book_definitions.api_name, api)).then((r) => r[0] ?? null)
      if (!obj) continue
      const rows = await db.select({ id: book_records.id, data: book_records.data })
        .from(book_records).where(eq(book_records.object_id, obj.id))
      out.push(...rows.map((r) => {
        const d = (r.data ?? {}) as Record<string, unknown>
        const name = (typeof d.name === 'string' && d.name) || (typeof d.title === 'string' && d.title) || `#${r.id.slice(0, 8)}`
        return { value: `${api}:${r.id}`, label: `${bookLabel} / ${name}`, price: numOrNull(d.unit_price ?? d.price) }
      }))
    }
  }
  return out
}
