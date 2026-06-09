'use server'
/**
 * クイック操作ウィザード — 汎用 AI 作成（REQ-0022 / draft-then-apply）
 *
 * カスタムオブジェクト（custom_records ＋ field_definitions 駆動）のブックに対して、
 * 自由入力テキスト or 画像から各フィールド値を AI 抽出し、編集可能なドラフトを返す。
 * 確定値は `quickAiCreate` で custom_records に INSERT する。
 *
 * 安全方針：
 * - typed テーブル（accounts / maintenance_records 等）は対象外（個別スキーマの誤投入を避ける）。
 *   typed ブックは専用ウィザード（あれば）か手動入力に誘導する（UI 側で分岐）。
 * - AI は DB を直接触らず、抽出→確認→apply の draft-then-apply を厳守。
 */
import { db } from '@/lib/db'
import { custom_records, accounts, contacts } from '@/lib/schema'
import { properties } from '@/industries/real-estate/schema'
import { ilike } from 'drizzle-orm'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getObjectDef, getFieldDefs, parseFieldOptions } from '@/lib/objectMetadata'
import { callAI } from '@/lib/ai/client'
import { createAccount } from '@/app/actions/accounts'
import { createContact } from '@/app/actions/contacts'
import { createVehicle } from '@/industries/auto-body/actions/vehicles'
import { createPart } from '@/industries/auto-body/actions/parts'
import { createProperty } from '@/industries/real-estate/actions/properties'

/**
 * typed CRM コアブックの AI 作成スペック（#49）。
 * field_definitions を持たない typed テーブル（accounts/contacts）に、
 * 抽出対象フィールドと作成処理（既存 create アクション）を定義して AI 作成を可能にする。
 */
type TypedField = { apiName: string; label: string; fieldType: string; options?: string[] }
type TypedSpec = {
  label: string
  fields: TypedField[]
  create: (values: Record<string, string>) => Promise<{ recordHref: string }>
}

function fd(values: Record<string, string>, map: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(map)) f.set(k, values[v] ?? '')
  return f
}

const TYPED_SPECS: Record<string, TypedSpec> = {
  accounts: {
    label: '取引先',
    fields: [
      { apiName: 'name',        label: '取引先名（会社名）', fieldType: 'text' },
      { apiName: 'phone',       label: '電話番号',           fieldType: 'text' },
      { apiName: 'website',     label: 'Webサイト',          fieldType: 'text' },
      { apiName: 'address',     label: '住所',               fieldType: 'text' },
      { apiName: 'industry',    label: '業種',               fieldType: 'text' },
      { apiName: 'type',        label: '取引先種別',         fieldType: 'text' },
      { apiName: 'description', label: '備考',               fieldType: 'textarea' },
    ],
    async create(v) {
      const id = await createAccount(fd(v, {
        name: 'name', phone: 'phone', website: 'website', address: 'address',
        industry: 'industry', type: 'type', description: 'description',
      }))
      return { recordHref: `/accounts/${id}` }
    },
  },
  contacts: {
    label: '人物',
    fields: [
      { apiName: 'full_name',   label: '氏名',     fieldType: 'text' },
      { apiName: 'title',       label: '役職',     fieldType: 'text' },
      { apiName: 'department',  label: '部署',     fieldType: 'text' },
      { apiName: 'email',       label: 'メール',   fieldType: 'text' },
      { apiName: 'phone',       label: '電話番号', fieldType: 'text' },
      { apiName: 'description', label: '備考',     fieldType: 'textarea' },
    ],
    async create(v) {
      const f = fd(v, {
        full_name: 'full_name', title: 'title', department: 'department',
        email: 'email', phone: 'phone', description: 'description',
      })
      f.set('contact_type', 'business')
      const id = await createContact(f)
      return { recordHref: `/contacts/${id}` }
    },
  },
  vehicles: {
    label: '車両（在庫）',
    fields: [
      { apiName: 'maker',         label: 'メーカー', fieldType: 'text' },
      { apiName: 'model',         label: '車種',     fieldType: 'text' },
      { apiName: 'year',          label: '年式',     fieldType: 'number' },
      { apiName: 'color',         label: '色',       fieldType: 'text' },
      { apiName: 'mileage',       label: '走行距離(km)', fieldType: 'number' },
      { apiName: 'license_plate', label: 'ナンバー', fieldType: 'text' },
      { apiName: 'vin',           label: '車台番号', fieldType: 'text' },
      { apiName: 'description',   label: '備考',     fieldType: 'textarea' },
    ],
    async create(v) {
      const id = await createVehicle(fd(v, {
        maker: 'maker', model: 'model', year: 'year', color: 'color',
        mileage: 'mileage', license_plate: 'license_plate', vin: 'vin', description: 'description',
      }))
      return { recordHref: `/vehicles/${id}` }
    },
  },
  parts: {
    label: '部品',
    fields: [
      { apiName: 'part_number', label: '品番',     fieldType: 'text' },
      { apiName: 'name',        label: '部品名',   fieldType: 'text' },
      { apiName: 'category',    label: 'カテゴリ', fieldType: 'text' },
      { apiName: 'unit_price',  label: '単価',     fieldType: 'number' },
      { apiName: 'description', label: '備考',     fieldType: 'textarea' },
    ],
    async create(v) {
      const id = await createPart(fd(v, {
        part_number: 'part_number', name: 'name', category: 'category',
        unit_price: 'unit_price', description: 'description',
      }))
      return { recordHref: `/parts/${id}` }
    },
  },
  properties: {
    label: '物件・商品',
    fields: [
      { apiName: 'name',             label: '物件名',   fieldType: 'text' },
      { apiName: 'address',          label: '住所',     fieldType: 'text' },
      { apiName: 'property_type',    label: '物件種別', fieldType: 'text' },
      { apiName: 'transaction_type', label: '取引種別', fieldType: 'text' },
      { apiName: 'description',      label: '備考',     fieldType: 'textarea' },
    ],
    async create(v) {
      const id = await createProperty(fd(v, {
        name: 'name', address: 'address', property_type: 'property_type',
        transaction_type: 'transaction_type', description: 'description',
      }))
      return { recordHref: `/properties/${id}` }
    },
  },
}

export type QuickAiField = {
  apiName: string
  label: string
  fieldType: string
  value: string
  /** select 型の選択肢 */
  options?: string[]
}

export type QuickAiDraft = {
  fields: QuickAiField[]
  /** AI が補足した注意点（曖昧さなど） */
  note?: string
}

export type QuickAiImage = { mediaType: string; dataBase64: string }
export type QuickAiInput = { text?: string; image?: QuickAiImage; url?: string }

/** AI 作成に対応するブックか（custom_records ベース or typed CRM コア） */
export async function quickAiSupported(apiName: string): Promise<boolean> {
  if (TYPED_SPECS[apiName]) return true
  const obj = await getObjectDef(apiName)
  return Boolean(obj && !obj.is_builtin)
}

/**
 * 自由入力／画像／URL から、ブックの各フィールド値を抽出して編集可能ドラフトを返す。
 * typed CRM コア（accounts/contacts）と カスタムオブジェクトの両方に対応（#49 / REQ-0022）。
 */
export async function quickAiExtract(apiName: string, input: QuickAiInput): Promise<QuickAiDraft> {
  if (!(await canEdit())) throw new Error('権限がありません')

  // 対象フィールド仕様（typed spec or field_definitions）
  let label: string
  let specFields: TypedField[]
  const typed = TYPED_SPECS[apiName]
  if (typed) {
    label = typed.label
    specFields = typed.fields
  } else {
    const obj = await getObjectDef(apiName)
    if (!obj) throw new Error(`ブック "${apiName}" が見つかりません`)
    if (obj.is_builtin) throw new Error('このブックは AI 作成に未対応です（手動入力をご利用ください）')
    const fdefs = await getFieldDefs(obj.id)
    if (fdefs.length === 0) throw new Error('このブックには入力フィールドが定義されていません')
    label = obj.label
    specFields = fdefs.map((f) => ({ apiName: f.api_name, label: f.label, fieldType: f.field_type, options: parseFieldOptions(f) }))
  }

  // URL が指定されたら本文テキストを取得して材料に加える（Webサイト/会社情報）
  let text = input.text?.trim() ?? ''
  if (input.url?.trim()) {
    const fetched = await fetchUrlText(input.url.trim())
    text = [text, fetched].filter(Boolean).join('\n\n---（Webサイト本文）---\n')
  }
  if (!text && !input.image) throw new Error('テキスト・画像・URL のいずれかを入力してください')

  const fieldSpec = specFields.map((f) => {
    const optStr = f.options?.length ? `（選択肢: ${f.options.join(' / ')}）` : ''
    return `- ${f.apiName}: ${f.label}（型: ${f.fieldType}）${optStr}`
  }).join('\n')

  const system = [
    `あなたは日本語の業務データ抽出アシスタントです。`,
    `「${label}」レコードの各フィールドを、与えられた情報（テキスト・名刺等の画像・Webサイト本文）から抽出します。`,
    `出力は厳密な JSON のみ。前後に説明文やコードフェンスを付けないこと。`,
    `形式: {"fields": {"<api_name>": "<値の文字列>", ...}, "note": "<曖昧な点があれば短く。無ければ空文字>"}`,
    `ルール:`,
    `- 値が読み取れないフィールドは空文字 "" にする（推測で埋めない）。`,
    `- date 型は YYYY-MM-DD、number 型は数字のみ、boolean 型は "true"/"false"、select 型は選択肢のいずれかに正規化する。`,
    `- 対象フィールド以外のキーは出力しない。`,
    ``,
    `対象フィールド:`,
    fieldSpec,
  ].join('\n')

  const user = input.image
    ? (text ? `次の画像と補足テキストから抽出してください。\n補足:\n${text}` : `次の画像（名刺等）から抽出してください。`)
    : `次のテキストから抽出してください。\n---\n${text}`

  const result = await callAI({
    system, user,
    images: input.image ? [input.image] : undefined,
    maxTokens: 1500, temperature: 0.1, timeoutMs: 45000,
  })

  const parsed = extractJson(result.text)
  const valueMap = (parsed?.fields ?? {}) as Record<string, unknown>
  const draftFields: QuickAiField[] = specFields.map((f) => {
    const raw = valueMap[f.apiName]
    return { apiName: f.apiName, label: f.label, fieldType: f.fieldType, value: raw == null ? '' : String(raw), options: f.options }
  })

  return {
    fields: draftFields,
    note: typeof parsed?.note === 'string' && parsed.note.trim() ? parsed.note.trim() : undefined,
  }
}

/** 確定値でレコードを作成。typed は既存 create アクション、custom は custom_records。 */
export async function quickAiCreate(apiName: string, values: Record<string, string>): Promise<{ recordHref: string }> {
  if (!(await canEdit())) throw new Error('権限がありません')

  const typed = TYPED_SPECS[apiName]
  if (typed) return typed.create(values)

  const obj = await getObjectDef(apiName)
  if (!obj) throw new Error(`ブック "${apiName}" が見つかりません`)
  if (obj.is_builtin) throw new Error('このブックは AI 作成に未対応です')

  const fields = await getFieldDefs(obj.id)
  const data: Record<string, unknown> = {}
  for (const f of fields) data[f.api_name] = coerceValue(f.field_type, values[f.api_name] ?? null)

  const owner_id = (await getCurrentUserId()) ?? null
  const [rec] = await db.insert(custom_records)
    .values({ object_id: obj.id, data, owner_id })
    .returning({ id: custom_records.id })

  return { recordHref: `/objects/${apiName}/${rec.id}` }
}

export type QuickAiDup = { id: string; label: string; href: string }

/**
 * AI/手動 作成前の重複候補（REQ-0018）。自然キー（取引先=名称 / 人物=氏名 / 物件=物件名）の
 * 部分一致候補を返す。候補があれば UI 側で「既存を開く / それでも作成」を提示する。
 */
export async function quickAiDupCandidates(apiName: string, values: Record<string, string>): Promise<QuickAiDup[]> {
  if (!(await canEdit())) return []
  const like = (s: string) => `%${s.trim()}%`
  if (apiName === 'accounts' && values.name?.trim()) {
    const rows = await db.select({ id: accounts.id, name: accounts.name }).from(accounts)
      .where(ilike(accounts.name, like(values.name))).limit(5)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/accounts/${r.id}` }))
  }
  if (apiName === 'contacts' && values.full_name?.trim()) {
    const rows = await db.select({ id: contacts.id, name: contacts.full_name }).from(contacts)
      .where(ilike(contacts.full_name, like(values.full_name))).limit(5)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/contacts/${r.id}` }))
  }
  if (apiName === 'properties' && values.name?.trim()) {
    const rows = await db.select({ id: properties.id, name: properties.name }).from(properties)
      .where(ilike(properties.name, like(values.name))).limit(5)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/properties/${r.id}` }))
  }
  return []
}

/** URL の HTML を取得し、本文テキストへ粗く変換（script/style 除去・タグ除去） */
async function fetchUrlText(url: string): Promise<string> {
  let u: URL
  try { u = new URL(url) } catch { throw new Error('URL の形式が正しくありません') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('http(s) の URL を指定してください')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(u.toString(), { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 BractBot' } })
    if (!res.ok) throw new Error(`Webサイト取得に失敗しました (HTTP ${res.status})`)
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim()
    return text.slice(0, 6000) // トークン節約
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Webサイト取得がタイムアウトしました')
    throw e
  } finally { clearTimeout(timer) }
}

// ── helpers ────────────────────────────────────────────────────────
function coerceValue(fieldType: string, raw: string | null): unknown {
  if (raw === null || raw.trim() === '') return null
  const s = raw.trim()
  switch (fieldType) {
    case 'number':  { const n = Number(s); return isFinite(n) ? n : null }
    case 'boolean': return s === 'on' || s === 'true' || s === '1'
    default:        return s
  }
}

/** AI 応答から JSON オブジェクトを頑健に取り出す（コードフェンス混入に耐える） */
function extractJson(text: string): { fields?: Record<string, unknown>; note?: string } | null {
  const trimmed = text.trim()
  const candidates: string[] = []
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  const brace = trimmed.match(/\{[\s\S]*\}/)
  if (brace) candidates.push(brace[0])
  candidates.push(trimmed)
  for (const c of candidates) {
    try { return JSON.parse(c) } catch { /* try next */ }
  }
  return null
}
